import { Router, type IRouter } from 'express';
import { queryRows, queryOne, query } from '../lib/db.js';
import { UploadKnowledgeBody, ConfirmExtractionBody } from '../lib/validators.js';
import { extractorAgent, compilerAgent, type SchemaColumn } from '../lib/agents.js';
import { logActivity } from '../lib/activity.js';
import { logger } from '../lib/logger.js';

const router: IRouter = Router({ mergeParams: true });

/**
 * GET /api/projects/:projectId/knowledge
 */
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const files = await queryRows(
    'SELECT * FROM knowledge WHERE project_id = $1 ORDER BY created_at',
    [projectId]
  );
  res.json(files);
});

/**
 * POST /api/projects/:projectId/knowledge
 */
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const body = UploadKnowledgeBody.parse(req.body);

  const file = await queryOne(
    `INSERT INTO knowledge (project_id, schema_id, file_name, file_path, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [projectId, body.schemaId ?? null, body.fileName, `uploads/${projectId}/${body.fileName}`]
  );

  await logActivity(projectId, 'upload', `File "${body.fileName}" berhasil diupload`);

  // Process asynchronously
  processFileAsync(file.id, projectId, body.fileContent, body.schemaId ?? null).catch((e) => {
    logger.error({ error: e, fileId: file.id }, 'Async processing failed');
  });

  res.status(201).json(file);
});

/**
 * Async file processing: extract → compile → await confirmation.
 */
async function processFileAsync(
  fileId: string,
  projectId: string,
  fileContent: string,
  schemaId: string | null
): Promise<void> {
  try {
    await query(
      "UPDATE knowledge SET status = 'extracting', updated_at = NOW() WHERE id = $1",
      [fileId]
    );

    let schema: SchemaColumn[] = [];
    if (schemaId) {
      const schemaRecord = await queryOne('SELECT columns FROM schemas WHERE id = $1', [schemaId]);
      if (schemaRecord) {
        schema = (schemaRecord.columns as SchemaColumn[]) ?? [];
      }
    }

    if (schema.length === 0) {
      schema = [
        { name: 'Responden', type: 'text', aiGuidance: 'Name of the survey respondent' },
        { name: 'Tanggal', type: 'date', aiGuidance: 'Date of survey completion' },
        { name: 'Komentar', type: 'text', aiGuidance: 'Comments and feedback from respondent' },
        { name: 'Skor', type: 'number', aiGuidance: 'Satisfaction score or rating (if present)' },
      ];
    }

    // Decode PDF content
    let pdfText = '';
    try {
      const buffer = Buffer.from(fileContent, 'base64');
      pdfText = buffer.toString('utf-8');
      if (pdfText.includes('%PDF')) {
        // TODO: Replace with actual Python OCR service call
        pdfText = `PDF Document: ${fileId}\n\nSurvey responses extracted from PDF.\n` +
          'Responden: Ahmad Fauzi\nTanggal: 2026-03-20\nSkor: 4\n' +
          'Komentar: Pelayanan sudah cukup baik namun masih perlu peningkatan pada aspek kecepatan.';
      }
    } catch {
      pdfText = `Survey PDF content: ${fileId}`;
    }

    const extraction = await extractorAgent(pdfText, schema);

    await query(
      "UPDATE knowledge SET status = 'compiling', updated_at = NOW() WHERE id = $1",
      [fileId]
    );

    const compiledData = await compilerAgent(extraction, schema);
    extraction.rows = compiledData;

    await query(
      `UPDATE knowledge SET status = 'awaiting_confirmation',
        extracted_data = $1, updated_at = NOW() WHERE id = $2`,
      [
        JSON.stringify({
          rows: extraction.rows,
          rawText: extraction.rawText.substring(0, 500),
          confidence: extraction.confidence,
        }),
        fileId,
      ]
    );

    await logActivity(projectId, 'process', 'Ekstraksi data selesai, menunggu konfirmasi');
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Processing failed';
    await query(
      "UPDATE knowledge SET status = 'error', updated_at = NOW() WHERE id = $1",
      [fileId]
    );
    await logActivity(projectId, 'error', `Error memproses file: ${errorMsg}`);
    logger.error({ error: e, fileId }, 'File processing failed');
  }
}

/**
 * GET /api/projects/:projectId/knowledge/:id
 */
router.get('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  const file = await queryOne(
    'SELECT * FROM knowledge WHERE id = $1 AND project_id = $2',
    [id, projectId]
  );
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.json(file);
});

/**
 * DELETE /api/projects/:projectId/knowledge/:id
 */
router.delete('/:id', async (req, res) => {
  const { projectId, id } = req.params;
  const file = await queryOne(
    'SELECT file_name FROM knowledge WHERE id = $1 AND project_id = $2',
    [id, projectId]
  );
  if (file) {
    await logActivity(projectId, 'process', `File "${file.file_name}" telah dihapus`);
  }
  await query('DELETE FROM knowledge WHERE id = $1 AND project_id = $2', [id, projectId]);
  res.json({ success: true, message: 'File deleted' });
});

/**
 * POST /api/projects/:projectId/knowledge/:id/confirm
 */
router.post('/:id/confirm', async (req, res) => {
  const { projectId, id } = req.params;
  const body = ConfirmExtractionBody.parse(req.body);

  const file = await queryOne(
    'SELECT * FROM knowledge WHERE id = $1 AND project_id = $2',
    [id, projectId]
  );
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  if (body.action === 'confirm') {
    const updated = await queryOne(
      "UPDATE knowledge SET status = 'done', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    await logActivity(projectId, 'process', `Data dari "${file.file_name}" telah dikonfirmasi dan disimpan`);
    res.json(updated);
  } else if (body.action === 'reject') {
    const updated = await queryOne(
      "UPDATE knowledge SET status = 'error', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    await logActivity(projectId, 'process', `Data dari "${file.file_name}" ditolak`);
    res.json(updated);
  } else if (body.action === 'edit' && body.editedData) {
    const currentData = file.extracted_data ?? {};
    const newData = {
      ...currentData,
      rows: body.editedData.rows ?? currentData.rows,
    };
    const updated = await queryOne(
      "UPDATE knowledge SET status = 'done', extracted_data = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [JSON.stringify(newData), id]
    );
    await logActivity(projectId, 'process', `Data dari "${file.file_name}" telah diedit dan dikonfirmasi`);
    res.json(updated);
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

/**
 * GET /api/projects/:projectId/knowledge/export/download
 */
router.get('/export/download', async (req, res) => {
  const { projectId } = req.params;
  const files = await queryRows(
    "SELECT * FROM knowledge WHERE project_id = $1 AND status = 'done'",
    [projectId]
  );

  const allRows: Record<string, unknown>[] = [];
  const headers = new Set<string>();

  for (const file of files) {
    if (file.extracted_data?.rows) {
      for (const row of file.extracted_data.rows) {
        const rowWithSource = { ...row, 'File Sumber': file.file_name };
        allRows.push(rowWithSource);
        Object.keys(rowWithSource).forEach((k) => headers.add(k));
      }
    }
  }

  const headerArr = Array.from(headers);
  const csvLines = [headerArr.join(',')];
  for (const row of allRows) {
    const line = headerArr.map((h) => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
    csvLines.push(line);
  }

  const csv = csvLines.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="survey_data_${projectId}.csv"`);
  res.send(csv);
});

export default router;
