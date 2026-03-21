import { Router, type IRouter } from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, queryOne } from "../lib/db.js";
import { logActivity } from "../lib/activity.js";
import { logger } from "../lib/logger.js";
import { extractFromPDF } from "../agents/extractor.js";
import { compileData } from "../agents/compiler.js";
import { startWorkflowTrace } from "../lib/observability.js";
import { type SchemaColumn } from "../lib/agents.js";

const router: IRouter = Router();

const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

type PipelineEvent = {
  type: "agent_start" | "agent_complete" | "agent_error" | "done";
  agent: string;
  message: string;
  progress: number;
};

type KnowledgeRow = {
  id: string;
  project_id: string;
  schema_id: string | null;
  file_name: string;
  file_path: string;
  status: string;
  extracted_data: Record<string, unknown> | null;
  version: number | null;
};

function sendEvent(res: any, event: PipelineEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function resolveStoredPath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const normalized = filePath.replace(/^\.\//, "");
  return path.resolve(PROJECT_ROOT, normalized);
}

async function loadSchemaColumns(
  schemaId: string | null,
  projectId: string,
): Promise<SchemaColumn[]> {
  if (schemaId) {
    const schemaRecord = await queryOne<{ columns: SchemaColumn[] }>(
      "SELECT columns FROM schemas WHERE id = $1 AND project_id = $2",
      [schemaId, projectId],
    );

    if (schemaRecord?.columns?.length) {
      return schemaRecord.columns;
    }
  }

  const defaultSchema = await queryOne<{ columns: SchemaColumn[] }>(
    `
      SELECT columns
      FROM schemas
      WHERE project_id = $1
      ORDER BY is_default DESC, updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [projectId],
  );

  if (defaultSchema?.columns?.length) {
    return defaultSchema.columns;
  }

  return [
    {
      name: "Responden",
      type: "text",
      aiGuidance: "Nama responden yang mengisi survey",
    },
    {
      name: "Tanggal",
      type: "date",
      aiGuidance: "Tanggal pengisian survey bila tersedia",
    },
    {
      name: "Komentar",
      type: "text",
      aiGuidance: "Komentar atau saran responden",
    },
    {
      name: "Skor",
      type: "number",
      aiGuidance: "Skor atau nilai kepuasan jika ada",
    },
  ];
}

/**
 * POST /api/agents/process/stream
 * Starts knowledge processing and streams agent progress via SSE.
 */
router.post("/process/stream", async (req, res) => {
  const projectId = String(req.body?.projectId || "").trim();
  const knowledgeId = String(req.body?.knowledgeId || "").trim();
  const requestedSchemaId = req.body?.schemaId
    ? String(req.body.schemaId).trim()
    : undefined;

  if (!projectId || !knowledgeId) {
    res.status(400).json({
      error: "projectId and knowledgeId are required",
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const trace = startWorkflowTrace("Knowledge Processing Pipeline", {
    projectId,
    metadata: {
      knowledgeId,
      requestedSchemaId: requestedSchemaId ?? null,
    },
  });

  try {
    const file = await queryOne<KnowledgeRow>(
      `
        SELECT *
        FROM knowledge
        WHERE id = $1 AND project_id = $2
        LIMIT 1
      `,
      [knowledgeId, projectId],
    );

    if (!file) {
      sendEvent(res, {
        type: "agent_error",
        agent: "Supervisor",
        message: "File knowledge tidak ditemukan",
        progress: 0,
      });
      sendEvent(res, {
        type: "done",
        agent: "Supervisor",
        message: "Pipeline gagal",
        progress: 100,
      });
      res.end();
      return;
    }

    const schemaId = requestedSchemaId || file.schema_id;
    const schema = await loadSchemaColumns(schemaId, projectId);

    const absolutePath = resolveStoredPath(file.file_path);
    const fileBuffer = await fs.readFile(absolutePath);
    const fileContent = fileBuffer.toString("base64");

    await query(
      `
        UPDATE knowledge
        SET
          status = 'extracting',
          schema_id = COALESCE($2, schema_id),
          updated_at = NOW()
        WHERE id = $1
      `,
      [knowledgeId, schemaId ?? null],
    );

    sendEvent(res, {
      type: "agent_start",
      agent: "Supervisor",
      message: "Pipeline dimulai",
      progress: 5,
    });

    sendEvent(res, {
      type: "agent_start",
      agent: "Extractor",
      message: "Membaca PDF dan menjalankan OCR...",
      progress: 20,
    });

    const extraction = await extractFromPDF(fileContent, file.file_name, schema, {
      projectId,
      traceId: trace?.traceId,
    });

    sendEvent(res, {
      type: "agent_complete",
      agent: "Extractor",
      message: `Ekstraksi selesai (${extraction.rows.length} baris ditemukan)`,
      progress: 65,
    });

    await query(
      `
        UPDATE knowledge
        SET status = 'compiling', updated_at = NOW()
        WHERE id = $1
      `,
      [knowledgeId],
    );

    sendEvent(res, {
      type: "agent_start",
      agent: "Compiler",
      message: "Menstandarkan hasil ekstraksi...",
      progress: 75,
    });

    const compiledRows = await compileData(
      {
        rows: extraction.rows,
        rawText: extraction.rawText,
        pageCount: extraction.pageCount,
        confidence: extraction.confidence,
      },
      schema,
      {
        projectId,
        traceId: trace?.traceId,
      },
    );

    await query(
      `
        UPDATE knowledge
        SET
          status = 'awaiting_confirmation',
          extracted_data = $2,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        knowledgeId,
        JSON.stringify({
          rows: compiledRows,
          rawText: extraction.rawText.slice(0, 2000),
          confidence: extraction.confidence,
          pageCount: extraction.pageCount,
          schemaId: schemaId ?? null,
        }),
      ],
    );

    await logActivity(
      projectId,
      "process",
      `Ekstraksi file "${file.file_name}" selesai dan menunggu konfirmasi`,
    );

    trace?.update({
      status: "awaiting_confirmation",
      fileName: file.file_name,
      rowCount: compiledRows.length,
      confidence: extraction.confidence,
    });

    sendEvent(res, {
      type: "agent_complete",
      agent: "Compiler",
      message: "Data berhasil disusun dan siap direview",
      progress: 92,
    });

    sendEvent(res, {
      type: "agent_complete",
      agent: "Supervisor",
      message: "Pipeline selesai, menunggu verifikasi user",
      progress: 100,
    });

    sendEvent(res, {
      type: "done",
      agent: "Supervisor",
      message: "Selesai",
      progress: 100,
    });

    res.end();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Pipeline processing failed";

    await query(
      `
        UPDATE knowledge
        SET status = 'error', updated_at = NOW()
        WHERE id = $1 AND project_id = $2
      `,
      [knowledgeId, projectId],
    );

    await logActivity(
      projectId,
      "error",
      `Gagal memproses knowledge "${knowledgeId}": ${errorMessage}`,
    );

    trace?.update({
      status: "error",
      error: errorMessage,
    });

    logger.error(
      {
        projectId,
        knowledgeId,
        traceId: trace?.traceId,
        error: errorMessage,
      },
      "Streaming knowledge pipeline failed",
    );

    sendEvent(res, {
      type: "agent_error",
      agent: "Supervisor",
      message: errorMessage,
      progress: 100,
    });

    sendEvent(res, {
      type: "done",
      agent: "Supervisor",
      message: "Pipeline gagal",
      progress: 100,
    });

    res.end();
  }
});

export default router;
