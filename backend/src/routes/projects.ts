import { Router, type IRouter } from "express";
import { queryRows, queryOne, query } from "../lib/db.js";
import { CreateProjectBody, UpdateProjectBody } from "../lib/validators.js";
import { logActivity } from "../lib/activity.js";
import {
  sanitizeOptionalMultilineText,
  sanitizeText,
} from "../lib/sanitize.js";

const router: IRouter = Router();

/**
 * GET /api/projects
 */
router.get("/", async (_req, res) => {
  const projects = await queryRows(
    `SELECT p.*,
       (SELECT COUNT(*) FROM knowledge k WHERE k.project_id = p.id)::int as "knowledgeCount",
       (SELECT COUNT(*) FROM reports r WHERE r.project_id = p.id)::int as "reportCount",
       (SELECT COUNT(*) FROM knowledge k WHERE k.project_id = p.id AND k.status = 'done')::int as "processedCount"
     FROM projects p
     ORDER BY p.updated_at DESC`,
  );

  res.json(projects);
});

/**
 * POST /api/projects
 */
router.post("/", async (req, res) => {
  const body = CreateProjectBody.parse(req.body);

  const name = sanitizeText(body.name, 255);
  const description = sanitizeOptionalMultilineText(body.description, 3000);

  if (!name) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  const project = await queryOne(
    `INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *`,
    [name, description],
  );

  if (!project) {
    res.status(500).json({ error: "Failed to create project" });
    return;
  }

  await logActivity(
    project.id,
    "upload",
    `Project "${project.name}" berhasil dibuat`,
  );

  res.status(201).json({
    ...project,
    knowledgeCount: 0,
    reportCount: 0,
    processedCount: 0,
  });
});

/**
 * GET /api/projects/:id
 */
router.get("/:id", async (req, res) => {
  const id = req.params.id as string;

  const project = await queryOne(
    `SELECT p.*,
       (SELECT COUNT(*) FROM knowledge k WHERE k.project_id = p.id)::int as "knowledgeCount",
       (SELECT COUNT(*) FROM reports r WHERE r.project_id = p.id)::int as "reportCount",
       (SELECT COUNT(*) FROM knowledge k WHERE k.project_id = p.id AND k.status = 'done')::int as "processedCount"
     FROM projects p WHERE p.id = $1`,
    [id],
  );

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(project);
});

/**
 * PATCH /api/projects/:id
 */
router.patch("/:id", async (req, res) => {
  const id = req.params.id as string;
  const body = UpdateProjectBody.parse(req.body);

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let idx = 1;

  if (body.name !== undefined) {
    const name = sanitizeText(body.name, 255);
    if (!name) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }

    sets.push(`name = $${idx++}`);
    params.push(name);
  }

  if (body.description !== undefined) {
    const description =
      body.description === null
        ? null
        : sanitizeOptionalMultilineText(body.description, 3000);

    sets.push(`description = $${idx++}`);
    params.push(description);
  }

  params.push(id);

  const project = await queryOne(
    `UPDATE projects SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params,
  );

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(project);
});

/**
 * DELETE /api/projects/:id
 */
router.delete("/:id", async (req, res) => {
  const id = req.params.id as string;

  await query("DELETE FROM projects WHERE id = $1", [id]);

  res.json({ success: true, message: "Project deleted" });
});

/**
 * GET /api/projects/:id/stats
 */
router.get("/:id/stats", async (req, res) => {
  const id = req.params.id as string;

  const [total, processed, pending, errors, reports] = await Promise.all([
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM knowledge WHERE project_id = $1",
      [id],
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM knowledge WHERE project_id = $1 AND status = 'done'",
      [id],
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM knowledge WHERE project_id = $1 AND status = 'pending'",
      [id],
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM knowledge WHERE project_id = $1 AND status = 'error'",
      [id],
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM reports WHERE project_id = $1",
      [id],
    ),
  ]);

  res.json({
    projectId: id,
    totalFiles: Number(total?.count ?? 0),
    processedFiles: Number(processed?.count ?? 0),
    pendingFiles: Number(pending?.count ?? 0),
    errorFiles: Number(errors?.count ?? 0),
    totalReports: Number(reports?.count ?? 0),
  });
});

export default router;
