import { Router, type IRouter } from "express";
import multer from "multer";
import { queryRows, queryOne, query } from "../lib/db.js";
import { uploadFileToStorage } from "../lib/pythonService.js";
import { logActivity } from "../lib/activity.js";
import { logger } from "../lib/logger.js";
import { sanitizeFilename, sanitizeText } from "../lib/sanitize.js";

const router: IRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const isDocx =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx");

    if (!isDocx) {
      cb(new Error("Only DOCX files are accepted"));
      return;
    }

    cb(null, true);
  },
});

type TemplateRow = {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  file_name: string | null;
  is_default: boolean | null;
  version: number | null;
  created_at: string;
  updated_at: string | null;
};

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "1" || value.toLowerCase() === "yes";
  }
  return false;
}

function serializeTemplate(template: TemplateRow) {
  return {
    id: template.id,
    projectId: template.project_id,
    name: template.name,
    filePath: template.file_path,
    fileName: template.file_name ?? template.name,
    isDefault: Boolean(template.is_default),
    version: Number(template.version ?? 1),
    createdAt: template.created_at,
    updatedAt: template.updated_at ?? template.created_at,
  };
}

/**
 * GET /api/projects/:projectId/templates
 */
router.get("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;

  const templates = await queryRows<TemplateRow>(
    `
      SELECT *
      FROM templates
      WHERE project_id = $1
      ORDER BY is_default DESC, created_at DESC
    `,
    [projectId],
  );

  res.json(templates.map(serializeTemplate));
});

/**
 * POST /api/projects/:projectId/templates
 * Accepts multipart/form-data:
 * - file: DOCX
 * - name: template name
 * - isDefault: true|false
 */
router.post("/", upload.single("file"), async (req, res) => {
  const projectId = req.params.projectId as string;
  const file = req.file;
  const rawName = typeof req.body?.name === "string" ? req.body.name : "";
  const isDefault = parseBoolean(req.body?.isDefault);

  if (!file) {
    res.status(400).json({ error: "DOCX template file is required" });
    return;
  }

  const safeOriginalName = sanitizeFilename(file.originalname);
  if (!safeOriginalName.toLowerCase().endsWith(".docx")) {
    res.status(400).json({ error: "Only DOCX files are accepted" });
    return;
  }

  const sanitizedName = sanitizeText(
    rawName || safeOriginalName.replace(/\.docx$/i, ""),
    255,
  );

  if (!sanitizedName) {
    res.status(400).json({ error: "Template name is required" });
    return;
  }

  try {
    const stored = await uploadFileToStorage(
      projectId,
      file.buffer,
      safeOriginalName,
      "template",
    );

    if (isDefault) {
      await query(
        `
          UPDATE templates
          SET is_default = false, updated_at = NOW()
          WHERE project_id = $1
        `,
        [projectId],
      );
    }

    const template = await queryOne<TemplateRow>(
      `
        INSERT INTO templates (
          project_id,
          name,
          file_path,
          file_name,
          is_default
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [projectId, sanitizedName, stored.file_path, stored.file_name, isDefault],
    );

    if (!template) {
      res.status(500).json({ error: "Failed to create template record" });
      return;
    }

    await logActivity(
      projectId,
      "template",
      `Template "${template.name}" berhasil diupload`,
    );

    res.status(201).json(serializeTemplate(template));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Template upload failed";

    logger.error(
      {
        projectId,
        fileName: safeOriginalName,
        error: message,
      },
      "Template upload failed",
    );

    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/projects/:projectId/templates/:id
 */
router.get("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  const template = await queryOne<TemplateRow>(
    `
      SELECT *
      FROM templates
      WHERE id = $1 AND project_id = $2
      LIMIT 1
    `,
    [id, projectId],
  );

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.json(serializeTemplate(template));
});

/**
 * POST /api/projects/:projectId/templates/:id/set-default
 */
router.post("/:id/set-default", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  const existing = await queryOne<TemplateRow>(
    `
      SELECT *
      FROM templates
      WHERE id = $1 AND project_id = $2
      LIMIT 1
    `,
    [id, projectId],
  );

  if (!existing) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  await query(
    `
      UPDATE templates
      SET is_default = false, updated_at = NOW()
      WHERE project_id = $1
    `,
    [projectId],
  );

  const updated = await queryOne<TemplateRow>(
    `
      UPDATE templates
      SET is_default = true, updated_at = NOW()
      WHERE id = $1 AND project_id = $2
      RETURNING *
    `,
    [id, projectId],
  );

  await logActivity(
    projectId,
    "template",
    `Template "${existing.name}" dijadikan default`,
  );

  res.json(updated ? serializeTemplate(updated) : null);
});

/**
 * DELETE /api/projects/:projectId/templates/:id
 */
router.delete("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  const existing = await queryOne<TemplateRow>(
    `
      SELECT *
      FROM templates
      WHERE id = $1 AND project_id = $2
      LIMIT 1
    `,
    [id, projectId],
  );

  if (!existing) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  await query(
    `
      DELETE FROM templates
      WHERE id = $1 AND project_id = $2
    `,
    [id, projectId],
  );

  await logActivity(
    projectId,
    "template",
    `Template "${existing.name}" telah dihapus`,
  );

  res.json({ success: true, message: "Template deleted" });
});

export default router;
