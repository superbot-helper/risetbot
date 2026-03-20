import { Router, type IRouter } from 'express';
import { queryRows, queryOne, query } from '../lib/db.js';
import { GenerateReportBody } from '../lib/validators.js';
import { type SchemaColumn } from '../lib/agents.js';
import { analyzeWithPandas } from '../agents/analyst.js';
import { generateReport } from '../agents/reporter.js';
import { logActivity } from '../lib/activity.js';
import { logger } from '../lib/logger.js';

const router: IRouter = Router({ mergeParams: true });

/**
 * GET /api/projects/:projectId/reports
 */
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const reports = await queryRows(
    'SELECT * FROM reports WHERE project_id = $1 ORDER BY created_at',
    [projectId]
  );
  res.json(reports);
});

/**
 * POST /api/projects/:projectId/reports
 */
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const body = GenerateReportBody.parse(req.body);

  const report = await queryOne(
    `INSERT INTO reports (project_id, name, file_path) VALUES ($1, $2, $3) RETURNING *`,
    [projectId, body.name, `reports/${projectId}/${body.name.replace(/[^a-z0-9]/gi, '_')}.docx`]
  );

  await logActivity(projectId, 'report', `Laporan "${body.name}" mulai dibuat`);

  generateReportAsync(report.id, projectId, body).catch((e) => {
    logger.error({ error: e, reportId: report.id }, 'Report generation failed');
  });

  res.status(201).json(report);
});

/**
 * Async report generation: analyze data → generate report content.
 */
async function generateReportAsync(
  reportId: string,
  projectId: string,
  options: {
    name: string;
    includeStatistics?: boolean;
    includeSentiment?: boolean;
    includeThemes?: boolean;
    customPrompt?: string | null;
  }
): Promise<void> {
  try {
    const processedFiles = await queryRows(
      "SELECT * FROM knowledge WHERE project_id = $1 AND status = 'done'",
      [projectId]
    );

    const allData: Record<string, unknown>[] = [];
    for (const file of processedFiles) {
      if (file.extracted_data?.rows) {
        allData.push(...file.extracted_data.rows.map((r: any) => ({ ...r, _source: file.file_name })));
      }
    }

    const schemas = await queryRows('SELECT columns FROM schemas WHERE project_id = $1', [projectId]);
    const schema: SchemaColumn[] = schemas.length > 0 ? (schemas[0].columns as SchemaColumn[]) ?? [] : [];

    const project = await queryOne('SELECT name FROM projects WHERE id = $1', [projectId]);
    const projectName = project?.name ?? 'Survey Project';

    const analysisData = await analyzeWithPandas(allData, schema, {
      includeStatistics: options.includeStatistics,
      includeSentiment: options.includeSentiment,
      includeThemes: options.includeThemes,
    });

    // Try to find a template for DOCX generation
    const templates = await queryRows(
      'SELECT file_path FROM templates WHERE project_id = $1 LIMIT 1',
      [projectId]
    );
    const templatePath = templates.length > 0 ? templates[0].file_path as string : undefined;

    const reportResult = await generateReport(
      templatePath,
      analysisData as Record<string, unknown>,
      projectName,
      options.name,
    );

    await query(
      `UPDATE reports SET analysis_data = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(reportResult), reportId]
    );

    await logActivity(projectId, 'report', `Laporan "${options.name}" selesai dibuat`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Report generation failed';
    await logActivity(projectId, 'error', `Error membuat laporan: ${errorMsg}`);
    logger.error({ error: e, reportId }, 'Report generation failed');
  }
}

/**
 * GET /api/projects/:projectId/reports/:id
 */
router.get('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  const report = await queryOne(
    'SELECT * FROM reports WHERE id = $1 AND project_id = $2',
    [id, projectId]
  );
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.json(report);
});

/**
 * GET /api/projects/:projectId/reports/:id/download
 */
router.get('/:id/download', async (req, res) => {
  const { projectId, id } = req.params;
  const report = await queryOne(
    'SELECT * FROM reports WHERE id = $1 AND project_id = $2',
    [id, projectId]
  );
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const data = report.analysis_data as Record<string, unknown> | null;
  const content = (data?.reportContent as string) ?? JSON.stringify(data, null, 2);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, '_')}.txt"`);
  res.send(content);
});

/**
 * DELETE /api/projects/:projectId/reports/:id
 */
router.delete('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  await query('DELETE FROM reports WHERE id = $1 AND project_id = $2', [id, projectId]);
  res.json({ success: true, message: 'Report deleted' });
});

export default router;
