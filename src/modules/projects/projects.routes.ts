import { Router, Response, NextFunction } from 'express';
import { query, paginate, transaction } from '../../config/database';
import { requireAuth, requireRole } from '../../middleware/auth';
import { sendSuccess, sendPaginated, sendError } from '../../utils/response';
import { AuthRequest, parsePagination, Project } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query as Record<string, unknown>);
    const conditions = ['1=1'];
    const values: unknown[] = [];

    if (req.query.status) {
      values.push(req.query.status);
      conditions.push(`status = $${values.length}`);
    }

    const sql = `SELECT * FROM projects WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const result = await paginate<Project>(sql, values, pagination.page, pagination.limit);
    sendPaginated(res, result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [project] = await query<Project>('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!project) throw new AppError('Project not found', 404);
    sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin', 'super_admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, project_code, description, project_type, status, start_date, end_date } = req.body;
    if (!name || !project_code) {
      sendError(res, 'name and project_code are required', 400);
      return;
    }
    const [project] = await query<Project>(
      `INSERT INTO projects (id, name, project_code, description, project_type, status, start_date, end_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [uuidv4(), name, project_code, description ?? null, project_type ?? null, status ?? 'active', start_date ?? null, end_date ?? null]
    );
    sendSuccess(res, project, 'Project created', 201);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin', 'super_admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project = await transaction(async (client) => {
      await client.query('DELETE FROM project_members WHERE project_id = $1', [req.params.id]);
      const result = await client.query(
        'DELETE FROM projects WHERE id = $1 RETURNING *',
        [req.params.id]
      );
      return result.rows[0] as Project | undefined;
    });

    if (!project) throw new AppError('Project not found', 404);
    sendSuccess(res, project, 'Project deleted successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/members', requireRole('admin', 'super_admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { profile_id, role } = req.body;
    if (!profile_id) {
      sendError(res, 'profile_id is required', 400);
      return;
    }

    const [project] = await query<Project>('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!project) throw new AppError('Project not found', 404);

    const [member] = await query(
      `INSERT INTO project_members (project_id, profile_id, role, joined_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (project_id, profile_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [req.params.id, profile_id, role ?? 'member']
    );

    sendSuccess(res, member, 'Project member added', 201);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('admin', 'super_admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name', 'description', 'status', 'start_date', 'end_date', 'project_type'];
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (key in req.body) {
        values.push(req.body[key]);
        fields.push(`${key} = $${values.length}`);
      }
    }

    if (fields.length === 0) {
      sendError(res, 'No valid fields to update', 400);
      return;
    }

    values.push(req.params.id);
    const [project] = await query<Project>(
      `UPDATE projects SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!project) throw new AppError('Project not found', 404);
    sendSuccess(res, project);
  } catch (err) {
    next(err);
  }
});

export default router;
