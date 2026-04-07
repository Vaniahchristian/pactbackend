import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import * as authService from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../types';
import { emailService } from '../../services/email.service';

export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('phone').optional().isMobilePhone('any'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    sendError(res, errors.array()[0].msg as string, 422);
    return false;
  }
  return true;
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    if (!validate(req, res)) return;
    const result = await authService.register(req.body);
    sendSuccess(res, result, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    if (!validate(req, res)) return;
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      sendError(res, 'refreshToken is required', 400);
      return;
    }
    const tokens = await authService.refreshSession(refreshToken);
    sendSuccess(res, tokens);
  } catch (err) {
    next(err);
  }
}

export async function requestReset(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    if (!email) {
      sendError(res, 'email is required', 400);
      return;
    }
    const otp = await authService.requestPasswordReset(email);
    if (otp) {
      // Send email in background — don't await so response is fast
      emailService
        .sendPasswordReset(email, otp)
        .catch((err) => console.error('Failed to send reset email', err));
    }
    // Always respond success
    sendSuccess(res, null, 'If that email is registered, a reset code has been sent.');
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      sendError(res, 'email, otp, and newPassword are required', 400);
      return;
    }
    if (newPassword.length < 8) {
      sendError(res, 'Password must be at least 8 characters', 422);
      return;
    }
    await authService.resetPasswordWithOtp(email, otp, newPassword);
    sendSuccess(res, null, 'Password reset successful');
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      sendError(res, 'currentPassword and newPassword are required', 400);
      return;
    }
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      sendError(res, 'refreshToken is required', 400);
      return;
    }
    await authService.revokeRefreshToken(refreshToken, req.user!.id);
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, req.user);
  } catch (err) {
    next(err);
  }
}
