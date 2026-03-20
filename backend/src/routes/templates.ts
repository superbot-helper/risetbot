import { Router, type IRouter } from 'express';
import { queryRows, queryOne, query } from '../lib/db.js';

const router: IRouter = Router({ mergeParams: true });

/**
 * GET /api/projects/:projectId/templates
 */
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const templates = await queryRows(
    'SELECT * FROM templates WHERE project_id = $1 ORDER BY created_at',
    [projectId]
  );
  res.json(templates);
});

/**
 * POST /api/projects/:projectId/templates
 * Accepts JSON body with name and file_path.
 * TODO: Switch to multipart/form-data upload for actual DOCX files.
 */
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const { name, filePath, isDefault } = req.body;

  if (!name || !filePath) {
    res.status(400).json({ error: 'name and filePath are required' });
    return;
  }

  if (isDefault) {
    await query(
      'UPDATE templates SET is_default = false WHERE project_id = $1',
      [projectId]
    );
  }

  const template = await queryOne(
    `INSERT INTO templates (project_id, name, file_path, is_default)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [projectId, name, filePath, isDefault ?? false]
  );
  res.status(201).json(template);
});

/**
 * GET /api/projects/:projectId/templates/:id
 */
router.get('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  const template = await queryOne(
    'SELECT * FROM templates WHERE id = $1 AND project_id = $2',
    [id, projectId]
  );
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(template);
});

/**
 * DELETE /api/projects/:projectId/templates/:id
 */
router.delete('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  await query(
    'DELETE FROM templates WHERE id = $1 AND project_id = $2',
    [id, projectId]
  );
  res.json({ success: true, message: 'Template deleted' });
});

export default router;
