import { Router, type IRouter } from 'express';
import { queryRows, queryOne, query } from '../lib/db.js';
import { SendChatMessageBody } from '../lib/validators.js';
import { chatbotAgent, type SchemaColumn } from '../lib/agents.js';
import { logActivity } from '../lib/activity.js';
import { logger } from '../lib/logger.js';

const router: IRouter = Router({ mergeParams: true });

/**
 * GET /api/projects/:projectId/chat
 */
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const messages = await queryRows(
    'SELECT * FROM chat_history WHERE project_id = $1 ORDER BY created_at',
    [projectId]
  );
  res.json(messages);
});

/**
 * POST /api/projects/:projectId/chat
 */
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const body = SendChatMessageBody.parse(req.body);

  // Save user message
  await query(
    'INSERT INTO chat_history (project_id, role, message) VALUES ($1, $2, $3)',
    [projectId, 'user', body.message]
  );

  await logActivity(projectId, 'chat', `Pertanyaan baru: "${body.message.substring(0, 50)}..."`);

  // SSE stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const processedFiles = await queryRows(
      "SELECT * FROM knowledge WHERE project_id = $1 AND status = 'done'",
      [projectId]
    );

    const surveyData: Record<string, unknown>[] = [];
    for (const file of processedFiles) {
      if (file.extracted_data?.rows) {
        surveyData.push(...file.extracted_data.rows.map((r: any) => ({ ...r, _source: file.file_name })));
      }
    }

    const schemas = await queryRows('SELECT columns FROM schemas WHERE project_id = $1', [projectId]);
    const schema: SchemaColumn[] = schemas.length > 0 ? (schemas[0].columns as SchemaColumn[]) ?? [] : [];

    const history = await queryRows(
      'SELECT role, message FROM chat_history WHERE project_id = $1 ORDER BY created_at',
      [projectId]
    );
    const chatHistoryFormatted = history.slice(-20).map((m: any) => ({
      role: m.role,
      content: m.message,
    }));

    res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Sedang menganalisis data...' })}\n\n`);

    const { answer, sources } = await chatbotAgent(body.message, surveyData, schema, chatHistoryFormatted);

    // Stream the answer character by character
    for (const chunk of answer.split('')) {
      res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
    }

    // Save assistant message
    await query(
      'INSERT INTO chat_history (project_id, role, message, sources) VALUES ($1, $2, $3, $4)',
      [projectId, 'assistant', answer, sources.length > 0 ? JSON.stringify(sources) : null]
    );

    res.write(`data: ${JSON.stringify({ type: 'done', sources })}\n\n`);
    res.end();
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Chat failed';
    logger.error({ error: e, projectId }, 'Chat failed');
    res.write(`data: ${JSON.stringify({ type: 'error', content: `Error: ${errorMsg}` })}\n\n`);
    res.end();
  }
});

/**
 * DELETE /api/projects/:projectId/chat
 */
router.delete('/', async (req, res) => {
  const { projectId } = req.params;
  await query('DELETE FROM chat_history WHERE project_id = $1', [projectId]);
  res.json({ success: true, message: 'Chat history cleared' });
});

export default router;
