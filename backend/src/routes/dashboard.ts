import { Router, type IRouter } from 'express';
import { queryRows, queryOne } from '../lib/db.js';

const router: IRouter = Router();

/**
 * GET /api/dashboard/stats
 */
router.get('/stats', async (_req, res) => {
  const [projects, surveys, processed, reports, active] = await Promise.all([
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM projects'),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM knowledge'),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM knowledge WHERE status = 'done'"),
    queryOne<{ count: string }>('SELECT COUNT(*) as count FROM reports'),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM knowledge WHERE status IN ('processing', 'extracting', 'compiling')"),
  ]);

  res.json({
    totalProjects: Number(projects?.count ?? 0),
    totalSurveys: Number(surveys?.count ?? 0),
    processedSurveys: Number(processed?.count ?? 0),
    totalReports: Number(reports?.count ?? 0),
    activeProcessing: Number(active?.count ?? 0),
  });
});

/**
 * GET /api/dashboard/activity
 */
router.get('/activity', async (_req, res) => {
  const activities = await queryRows(
    `SELECT a.id, a.project_id as "projectId", p.name as "projectName",
            a.action as type, a.details, a.created_at as "createdAt"
     FROM activity_log a
     LEFT JOIN projects p ON a.project_id = p.id
     ORDER BY a.created_at DESC
     LIMIT 20`
  );

  res.json(activities.map((a: any) => ({
    ...a,
    projectName: a.projectName ?? 'Unknown Project',
    description: a.details?.description ?? a.action,
  })));
});

export default router;
