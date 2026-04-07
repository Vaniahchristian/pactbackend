import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: Record<string, unknown>
): void {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  error: string,
  statusCode = 400
): void {
  res.status(statusCode).json({ success: false, error });
}

export function sendPaginated<T>(
  res: Response,
  result: { data: T[]; total: number; page: number; limit: number; totalPages: number }
): void {
  res.status(200).json({
    success: true,
    data: result.data,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
  });
}
