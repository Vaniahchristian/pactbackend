import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { sendError } from '../utils/response';
import { AuthRequest } from '../types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  hub_id?: string;
  state_id?: string;
  type: 'access' | 'refresh';
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 'Missing or invalid Authorization header', 401);
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    if (payload.type !== 'access') {
      sendError(res, 'Invalid token type', 401);
      return;
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      hub_id: payload.hub_id,
      state_id: payload.state_id,
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendError(res, 'Token expired', 401);
    } else {
      sendError(res, 'Invalid token', 401);
    }
  }
}

/** Role-based access control — pass allowed roles */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Not authenticated', 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, `Access denied. Required roles: ${roles.join(', ')}`, 403);
      return;
    }
    next();
  };
}

export function generateTokens(payload: Omit<JwtPayload, 'type'>): {
  accessToken: string;
  refreshToken: string;
} {
  const accessToken = jwt.sign(
    { ...payload, type: 'access' },
    env.jwt.secret,
    { expiresIn: env.jwt.accessExpiresIn } as jwt.SignOptions
  );
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn } as jwt.SignOptions
  );
  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
}
