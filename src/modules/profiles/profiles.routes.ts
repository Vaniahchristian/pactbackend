import { Router, Response, NextFunction } from 'express';
import * as service from './profiles.service';
import { requireAuth, requireRole } from '../../middleware/auth';
import { sendSuccess, sendPaginated, sendError } from '../../utils/response';
import { AuthRequest, parsePagination } from '../../types';

const router = Router();

// All routes require auth
router.use(requireAuth);

// Get all profiles — admin/manager only
router.get('/', requireRole('admin', 'super_admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const str = (v: unknown) => (Array.isArray(v) ? (v[0] as string) : (v as string | undefined));
    const result = await service.getProfiles({
      ...pagination,
      hub_id: str(req.query.hub_id),
      role: str(req.query.role),
      status: str(req.query.status),
      search: str(req.query.search),
    });
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
});

// Get own profile
router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await service.getProfileById(req.user!.id);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
});

// Update own profile
router.patch('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await service.updateProfile(req.user!.id, req.body);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
});

// Update FCM token (called from mobile app)
router.post('/me/fcm-token', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token) {
      sendError(res, 'token is required', 400);
      return;
    }
    await service.updateFcmToken(req.user!.id, token);
    sendSuccess(res, null, 'FCM token updated');
  } catch (err) {
    next(err);
  }
});

// Get profile by ID
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await service.getProfileById(req.params['id'] as string);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
});

// Admin update any profile
router.patch('/:id', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await service.adminUpdateProfile(req.params['id'] as string, req.body);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
});

export default router;
