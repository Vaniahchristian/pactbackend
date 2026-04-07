import { Router, Response, NextFunction } from 'express';
import * as service from './notifications.service';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AuthRequest, parsePagination } from '../../types';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const status = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
    const result = await service.getNotifications(req.user!.id, {
      ...pagination,
      status: status as string | undefined,
    });
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await service.getUnreadCount(req.user!.id);
    sendSuccess(res, { count });
  } catch (err) {
    next(err);
  }
});

router.post('/mark-all-read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await service.markAllAsRead(req.user!.id);
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await service.markAsRead(req.user!.id, req.params['id'] as string);
    sendSuccess(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
});

export default router;
