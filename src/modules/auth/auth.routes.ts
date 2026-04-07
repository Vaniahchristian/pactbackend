import { Router } from 'express';
import * as controller from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Public
router.post('/register', authLimiter, controller.registerValidation, controller.register);
router.post('/login', authLimiter, controller.loginValidation, controller.login);
router.post('/refresh', controller.refresh);
router.post('/reset-password/request', authLimiter, controller.requestReset);
router.post('/reset-password/confirm', authLimiter, controller.resetPassword);

// Authenticated
router.get('/me', requireAuth, controller.me);
router.post('/change-password', requireAuth, controller.changePassword);
router.post('/logout', requireAuth, controller.logout);

export default router;
