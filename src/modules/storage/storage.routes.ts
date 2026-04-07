import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth';
import { uploadLimiter } from '../../middleware/rateLimiter';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
import { AuthRequest, parsePagination, StorageObject } from '../../types';
import { uploadFile, getSignedUrl, deleteFile } from './storage.service';
import { query, paginate } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

async function getStorageBucketId(): Promise<string> {
  const [bucket] = await query<{ id: string }>(
    'SELECT id FROM storage_buckets WHERE name = $1',
    [env.minio.bucket]
  );

  if (bucket) {
    return bucket.id;
  }

  const [newBucket] = await query<{ id: string }>(
    `INSERT INTO storage_buckets (id, name, privacy, created_at)
     VALUES ($1, $2, 'private', NOW()) RETURNING id`,
    [uuidv4(), env.minio.bucket]
  );
  return newBucket.id;
}

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const values: unknown[] = [];
    const conditions = [];

    if (!['admin', 'super_admin'].includes(req.user!.role)) {
      values.push(req.user!.id);
      conditions.push('uploaded_by = $1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM storage_objects ${whereClause} ORDER BY created_at DESC`;
    const result = await paginate<StorageObject>(sql, values, pagination.page, pagination.limit);
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [object] = await query<StorageObject>('SELECT * FROM storage_objects WHERE id = $1', [req.params.id]);
    if (!object) {
      sendError(res, 'Object not found', 404);
      return;
    }

    if (object.uploaded_by !== req.user!.id && !['admin', 'super_admin'].includes(req.user!.role)) {
      sendError(res, 'Not authorized to view this object', 403);
      return;
    }

    const signedUrl = await getSignedUrl(object.key);
    sendSuccess(res, { ...object, signed_url: signedUrl });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/upload',
  uploadLimiter,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        sendError(res, 'No file provided', 400);
        return;
      }

      const folder = (req.query.folder as string) ?? 'uploads';
      const { key, url, size } = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folder
      );

      const bucketId = await getStorageBucketId();
      const [object] = await query<StorageObject>(
        `INSERT INTO storage_objects (id, bucket_id, key, name, mime_type, size, url, metadata, uploaded_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8, NOW()) RETURNING *`,
        [uuidv4(), bucketId, key, req.file.originalname, req.file.mimetype, size, key, req.user!.id]
      );

      sendSuccess(res, { ...object, signed_url: url }, 'File uploaded', 201);
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [object] = await query<StorageObject>('SELECT key, uploaded_by FROM storage_objects WHERE id = $1', [req.params.id]);
    if (!object) {
      sendError(res, 'File not found', 404);
      return;
    }
    if (object.uploaded_by !== req.user!.id && !['admin', 'super_admin'].includes(req.user!.role)) {
      sendError(res, 'Not authorized to delete this file', 403);
      return;
    }

    await deleteFile(object.key);
    await query('DELETE FROM storage_objects WHERE id = $1', [req.params.id]);
    sendSuccess(res, null, 'File deleted');
  } catch (err) {
    next(err);
  }
});

export default router;
