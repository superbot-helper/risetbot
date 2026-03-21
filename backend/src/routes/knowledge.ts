import { Router, type IRouter } from "express";
import multer from "multer";
import { queryRows, queryOne, query } from "../lib/db.js";
import { ConfirmExtractionBody } from "../lib/validators.js";
import { uploadFileToStorage } from "../lib/pythonService.js";
import { logActivity } from "../lib/activity.js";
import { logger } from "../lib/logger.js";
import {
  sanitizeFilename,
  sanitizeMultilineText,
  sanitizeOptionalMultilineText,
} from "../lib/sanitize.js";

const router: IRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      cb(new Error("Only PDF files are accepted"));
      return;
    }

    cb(null, true);
  },
});

type KnowledgeRow = {
  id: string;
  project_id: string;
  schema_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | string | null;
  status: string;
  extracted_data: Record<string, unknown> | null;
  version: number | string | null;
  created_at: string;
  updated_at: string;
};

function serializeKnowledge(file: KnowledgeRow) {
  return {
    id: file.id,
    projectId: file.project_id,
    schemaId: file.schema_id,
    fileName: file.file_name,
    filePath: file.file_path,
    fileSize: Number(file.file_size ?? 0),
    status: file.status,
    extractedData: file.extracted_data ?? null,
    version: Number(file.version ?? 1),
    createdAt: file.created_at,
    updatedAt: file.updated_at,
  };
}

function normalizeRows(rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => row as Record<string, unknown>);
}

/**
 * GET /api/projects/:projectId/knowledge
 */
router.get("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;

  const files = await queryRows<KnowledgeRow>(
    `
      SELECT *
      FROM knowledge
      WHERE project_id = $1
      ORDER BY created_at DESC
    `,
    [projectId],
  );

  res.json(files.map(serializeKnowledge));
});

/**
 * GET /api/projects/:projectId/knowledge/export/download
 */
router.get("/export/download", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;

  const files = await queryRows<KnowledgeRow>(
    `
      SELECT *
      FROM knowledge
      WHERE project_id = $1 AND status = 'done'
      ORDER BY created_at ASC
    `,
    [projectId],
  );

  const allRows: Record<string, unknown>[] = [];
  const headers = new Set<string>();

  for (const file of files) {
    const rows = normalizeRows(file.extracted_data?.rows);

    for (const row of rows) {
      const rowWithSource = {
        ...row,
        "File Sumber": file.file_name,
      };

      allRows.push(rowWithSource);
      Object.keys(rowWithSource).forEach((key) => headers.add(key));
    }
  }

  const headerArr = Array.from(headers);
  const csvLines = [headerArr.join(",")];

  for (const row of allRows) {
    const line = headerArr
      .map((header) => {
        const value = row[header] ?? "";
        const text = String(value).replace(/"/g, '""');
        return `"${text}"`;
      })
      .join(",");

    csvLines.push(line);
  }

  const csv = csvLines.join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="survey_data_${projectId}.csv"`,
  );
  res.send(csv);
});

/**
 * POST /api/projects/:projectId/knowledge
 * Accepts multipart/form-data with one or more PDF files.
 */
router.post("/", upload.array("files", 20), async (req, res) => {
  const projectId = req.params.projectId as string;
  const schemaIdRaw =
    typeof req.body?.schemaId === "string" ? req.body.schemaId.trim() : "";
  const schemaId = schemaIdRaw || null;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  if (files.length === 0) {
    res.status(400).json({ error: "At least one PDF file is required" });
    return;
  }

  const createdFiles: ReturnType<typeof serializeKnowledge>[] = [];

  try {
    for (const file of files) {
      const safeOriginalName = sanitizeFilename(file.originalname);

      if (!safeOriginalName.toLowerCase().endsWith(".pdf")) {
        res.status(400).json({ error: "Only PDF files are accepted" });
        return;
      }

      const stored = await uploadFileToStorage(
        projectId,
        file.buffer,
        safeOriginalName,
        "knowledge",
      );

      const inserted = await queryOne<KnowledgeRow>(
        `
          INSERT INTO knowledge (
            project_id,
            schema_id,
            file_name,
            file_path,
            file_size,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 'pending')
          RETURNING *
        `,
        [
          projectId,
          schemaId,
          stored.file_name,
          stored.file_path,
          stored.file_size,
        ],
      );

      if (inserted) {
        createdFiles.push(serializeKnowledge(inserted));
      }
    }

    await logActivity(
      projectId,
      "upload",
      `${createdFiles.length} file survey berhasil diupload`,
    );

    res.status(201).json({ files: createdFiles });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Knowledge upload failed";

    logger.error(
      {
        projectId,
        fileCount: files.length,
        error: message,
      },
      "Knowledge upload failed",
    );

    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/projects/:projectId/knowledge/:id
 */
router.get("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  const file = await queryOne<KnowledgeRow>(
    `
      SELECT *
      FROM knowledge
      WHERE id = $1 AND project_id = $2
      LIMIT 1
    `,
    [id, projectId],
  );

  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.json(serializeKnowledge(file));
});

/**
 * DELETE /api/projects/:projectId/knowledge/:id
 */
router.delete("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  const file = await queryOne<{ file_name: string }>(
    `
      SELECT file_name
      FROM knowledge
      WHERE id = $1 AND project_id = $2
      LIMIT 1
    `,
    [id, projectId],
  );

  if (file) {
    await logActivity(
      projectId,
      "process",
      `File "${file.file_name}" telah dihapus`,
    );
  }

  await query(
    `
      DELETE FROM knowledge
      WHERE id = $1 AND project_id = $2
    `,
    [id, projectId],
  );

  res.json({ success: true, message: "File deleted" });
});

/**
 * POST /api/projects/:projectId/knowledge/:id/confirm
 */
router.post("/:id/confirm", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };
  const body = ConfirmExtractionBody.parse(req.body);

  const file = await queryOne<KnowledgeRow>(
    `
      SELECT *
      FROM knowledge
      WHERE id = $1 AND project_id = $2
      LIMIT 1
    `,
    [id, projectId],
  );

  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  if (body.action === "confirm") {
    const updated = await queryOne<KnowledgeRow>(
      `
        UPDATE knowledge
        SET
          status = 'done',
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id],
    );

    await logActivity(
      projectId,
      "process",
      `Data dari "${file.file_name}" telah dikonfirmasi dan disimpan`,
    );

    res.json(updated ? serializeKnowledge(updated) : null);
    return;
  }

  if (body.action === "reject") {
    const updated = await queryOne<KnowledgeRow>(
      `
        UPDATE knowledge
        SET
          status = 'error',
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id],
    );

    await logActivity(
      projectId,
      "process",
      `Data dari "${file.file_name}" ditolak`,
    );

    res.json(updated ? serializeKnowledge(updated) : null);
    return;
  }

  if (body.action === "edit" && body.editedData) {
    const currentData =
      file.extracted_data && typeof file.extracted_data === "object"
        ? file.extracted_data
        : {};

    const editedRows = normalizeRows(body.editedData?.rows);
    const editedRawText =
      body.editedData?.rawText !== undefined
        ? sanitizeOptionalMultilineText(body.editedData.rawText, 5000)
        : currentData.rawText;

    const editedConfidence =
      typeof body.editedData?.confidence === "number"
        ? body.editedData.confidence
        : currentData.confidence;

    const nextData = {
      ...currentData,
      rows: editedRows,
      rawText:
        typeof editedRawText === "string"
          ? sanitizeMultilineText(editedRawText, 5000)
          : editedRawText,
      confidence: editedConfidence,
    };

    const updated = await queryOne<KnowledgeRow>(
      `
        UPDATE knowledge
        SET
          status = 'done',
          extracted_data = $1,
          version = COALESCE(version, 1) + 1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [JSON.stringify(nextData), id],
    );

    await logActivity(
      projectId,
      "process",
      `Data dari "${file.file_name}" telah diedit dan dikonfirmasi`,
    );

    res.json(updated ? serializeKnowledge(updated) : null);
    return;
  }

  res.status(400).json({ error: "Invalid action" });
});

export default router;
