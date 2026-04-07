import { Router, Response, NextFunction } from 'express';
import { query, paginate, transaction } from '../../config/database';
import { requireAuth, requireRole } from '../../middleware/auth';
import { sendSuccess, sendPaginated, sendError } from '../../utils/response';
import { AuthRequest, Wallet, parsePagination } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(requireAuth);

// Get own wallet
router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [wallet] = await query<Wallet>(
      'SELECT * FROM wallets WHERE user_id = $1',
      [req.user!.id]
    );
    if (!wallet) throw new AppError('Wallet not found', 404);
    sendSuccess(res, wallet);
  } catch (err) {
    next(err);
  }
});

// Get wallet transactions
router.get('/me/transactions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const sql = `SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC`;
    const result = await paginate(sql, [req.user!.id], pagination.page, pagination.limit);
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
});

// Submit withdrawal request
router.post('/me/withdrawal', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, currency, request_reason } = req.body;
    if (!amount || amount <= 0) {
      sendError(res, 'Invalid amount', 400);
      return;
    }

    const [wallet] = await query<Wallet>('SELECT * FROM wallets WHERE user_id = $1', [req.user!.id]);
    if (!wallet) throw new AppError('Wallet not found', 404);

    const amountCents = Math.round(amount * 100);
    if (wallet.balance_cents < amountCents) {
      sendError(res, 'Insufficient balance', 400);
      return;
    }

    const [request] = await query(
      `INSERT INTO withdrawal_requests (id, user_id, wallet_id, amount, currency, status, request_reason, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW()) RETURNING *`,
      [uuidv4(), req.user!.id, wallet.id, amountCents, currency ?? 'USD', request_reason ?? null]
    );
    sendSuccess(res, request, 'Withdrawal request submitted', 201);
  } catch (err) {
    next(err);
  }
});

// Admin: get all wallets
router.get('/', requireRole('admin', 'super_admin', 'finance'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const result = await paginate<Wallet>(
      `SELECT w.*, p.full_name, p.email FROM wallets w LEFT JOIN profiles p ON p.id = w.user_id ORDER BY w.created_at DESC`,
      [],
      pagination.page,
      pagination.limit
    );
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
