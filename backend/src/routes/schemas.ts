import { Router, type IRouter } from 'express';
import { queryRows, queryOne, query } from '../lib/db.js';
import { CreateSchemaBody, UpdateSchemaBody, AutoGenerateSchemaBody } from '../lib/validators.js';
import { autoGenerateSchemaAgent } from '../lib/agents.js';

const router: IRouter = Router({ mergeParams: true });

/**
 * GET /api/projects/:projectId/schemas
 */
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const schemas = await queryRows(
    'SELECT * FROM schemas WHERE project_id = $1 ORDER BY created_at',
    [projectId]
  );
  res.json(schemas);
});

/**
 * POST /api/projects/:projectId/schemas/auto-generate
 */
router.post('/auto-generate', async (req, res) => {
  const body = AutoGenerateSchemaBody.parse(req.body);
  const result = await autoGenerateSchemaAgent(body.sampleText, body.surveyType);
  res.json(result);
});

/**
 * POST /api/projects/:projectId/schemas
 */
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const body = CreateSchemaBody.parse(req.body);

  if (body.isDefault) {
    await query(
      "UPDATE schemas SET is_default = false WHERE project_id = $1",
      [projectId]
    );
  }

  const schema = await queryOne(
    `INSERT INTO schemas (project_id, name, description, columns)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [projectId, body.name, body.description ?? null, JSON.stringify(body.columns)]
  );
  res.status(201).json(schema);
});

/**
 * GET /api/projects/:projectId/schemas/:id
 */
router.get('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  const schema = await queryOne(
    'SELECT * FROM schemas WHERE id = $1 AND project_id = $2',
    [id, projectId]
  );
  if (!schema) {
    res.status(404).json({ error: 'Schema not found' });
    return;
  }
  res.json(schema);
});

/**
 * PATCH /api/projects/:projectId/schemas/:id
 */
router.patch('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  const body = UpdateSchemaBody.parse(req.body);

  if (body.isDefault) {
    await query("UPDATE schemas SET is_default = false WHERE project_id = $1", [projectId]);
  }

  const sets: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let idx = 1;

  if (body.name !== undefined) { sets.push(`name = $${idx++}`); params.push(body.name); }
  if (body.description !== undefined) { sets.push(`description = $${idx++}`); params.push(body.description); }
  if (body.columns !== undefined) { sets.push(`columns = $${idx++}`); params.push(JSON.stringify(body.columns)); }
  if (body.isDefault !== undefined) { sets.push(`is_default = $${idx++}`); params.push(body.isDefault); }

  params.push(id, projectId);

  const schema = await queryOne(
    `UPDATE schemas SET ${sets.join(', ')} WHERE id = $${idx++} AND project_id = $${idx} RETURNING *`,
    params
  );
  if (!schema) {
    res.status(404).json({ error: 'Schema not found' });
    return;
  }
  res.json(schema);
});

/**
 * DELETE /api/projects/:projectId/schemas/:id
 */
router.delete('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  await query('DELETE FROM schemas WHERE id = $1 AND project_id = $2', [id, projectId]);
  res.json({ success: true, message: 'Schema deleted' });
});

export default router;
