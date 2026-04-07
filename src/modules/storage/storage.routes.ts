import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth';
import { uploadLimiter } from '../../middleware/rateLimiter';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../types';
import { uploadFile, getSignedUrl, deleteFile } from './storage.service';
import { query } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

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

router.use(requireAuth);

// Upload a file
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

      // Index in document_index table
      const [doc] = await query(
        `INSERT INTO document_index (id, file_name, file_url, file_size, file_type, category, uploaded_at, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING *`,
        [uuidv4(), req.file.originalname, key, size, req.file.mimetype, folder, req.user!.id]
      );

      sendSuccess(res, { ...doc, signed_url: url }, 'File uploaded', 201);
    } catch (err) {
      next(err);
    }
  }
);

// Get signed URL for a stored key
router.get('/signed-url', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = req.query;
    if (!key) {
      sendError(res, 'key is required', 400);
      return;
    }
    const url = await getSignedUrl(key as string);
    sendSuccess(res, { url });
  } catch (err) {
    next(err);
  }
});

// Delete file
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [doc] = await query<{ file_url: string; uploaded_by: string }>(
      'SELECT file_url, uploaded_by FROM document_index WHERE id = $1',
      [req.params.id]
    );
    if (!doc) {
      sendError(res, 'File not found', 404);
      return;
    }
    if (doc.uploaded_by !== req.user!.id && !['admin', 'super_admin'].includes(req.user!.role)) {
      sendError(res, 'Not authorized to delete this file', 403);
      return;
    }
    await deleteFile(doc.file_url);
    await query('DELETE FROM document_index WHERE id = $1', [req.params.id]);
    sendSuccess(res, null, 'File deleted');
  } catch (err) {
    next(err);
  }
});

export default router;
