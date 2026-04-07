import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { pool } from '../../config/database';
import { JwtPayload } from '../../middleware/auth';

let io: SocketServer;

/** Map userId → Set of socket IDs for targeted delivery */
const userSockets = new Map<string, Set<string>>();

export function initRealtime(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: {
      origin: env.cors.origins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
      (socket as Socket & { user: JwtPayload }).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as Socket & { user: JwtPayload }).user;
    logger.debug('Socket connected', { userId: user.sub, socketId: socket.id });

    // Track user → socket mapping
    if (!userSockets.has(user.sub)) {
      userSockets.set(user.sub, new Set());
    }
    userSockets.get(user.sub)!.add(socket.id);

    // Join user's personal room and hub room
    socket.join(`user:${user.sub}`);
    if (user.hub_id) socket.join(`hub:${user.hub_id}`);

    socket.on('disconnect', () => {
      const sockets = userSockets.get(user.sub);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(user.sub);
      }
      logger.debug('Socket disconnected', { userId: user.sub, socketId: socket.id });
    });

    // Allow client to join entity-specific rooms (e.g., a chat room)
    socket.on('join:room', (room: string) => {
      socket.join(room);
    });

    socket.on('leave:room', (room: string) => {
      socket.leave(room);
    });
  });

  // Listen to Postgres NOTIFY for real-time DB events
  setupPostgresListen();

  return io;
}

/** Emit to a specific user (all their connected devices) */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (io) io.to(`user:${userId}`).emit(event, data);
}

/** Emit to all users in a hub */
export function emitToHub(hubId: string, event: string, data: unknown): void {
  if (io) io.to(`hub:${hubId}`).emit(event, data);
}

/** Emit to a specific room */
export function emitToRoom(room: string, event: string, data: unknown): void {
  if (io) io.to(room).emit(event, data);
}

/** Broadcast to everyone */
export function broadcast(event: string, data: unknown): void {
  if (io) io.emit(event, data);
}

/** Set up Postgres LISTEN/NOTIFY channel for push-based DB events */
async function setupPostgresListen(): Promise<void> {
  try {
    const client = await pool.connect();

    // Listen on the pact_events channel — your triggers should NOTIFY this
    await client.query('LISTEN pact_events');

    client.on('notification', (msg) => {
      if (!msg.payload) return;
      try {
        const payload = JSON.parse(msg.payload) as {
          event: string;
          table: string;
          record: Record<string, unknown>;
          recipient_id?: string;
          hub_id?: string;
        };

        if (payload.recipient_id) {
          emitToUser(payload.recipient_id, payload.event, payload.record);
        } else if (payload.hub_id) {
          emitToHub(payload.hub_id, payload.event, payload.record);
        } else {
          broadcast(payload.event, payload.record);
        }
      } catch (err) {
        logger.error('Failed to parse Postgres notification', { err });
      }
    });

    client.on('error', (err) => {
      logger.error('Postgres LISTEN client error', { err });
    });

    logger.info('Postgres LISTEN/NOTIFY active on channel: pact_events');
  } catch (err) {
    logger.warn('Failed to set up Postgres LISTEN — realtime DB events unavailable', { err });
  }
}
