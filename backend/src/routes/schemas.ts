import { Router, type IRouter } from "express";
import { queryRows, queryOne, query } from "../lib/db.js";
import {
  CreateSchemaBody,
  UpdateSchemaBody,
  AutoGenerateSchemaBody,
} from "../lib/validators.js";
import { autoGenerateSchemaAgent } from "../lib/agents.js";
import {
  sanitizeMultilineText,
  sanitizeOptionalMultilineText,
  sanitizeSchemaColumns,
  sanitizeText,
} from "../lib/sanitize.js";

const router: IRouter = Router({ mergeParams: true });

function serializeSchema(schema: any) {
  return {
    id: schema.id,
    projectId: schema.project_id,
    name: schema.name,
    description: schema.description,
    columns: schema.columns ?? [],
    isDefault: Boolean(schema.is_default),
    createdAt: schema.created_at,
    updatedAt: schema.updated_at,
  };
}

/**
 * GET /api/projects/:projectId/schemas
 */
router.get("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;

  const schemas = await queryRows(
    "SELECT * FROM schemas WHERE project_id = $1 ORDER BY created_at",
    [projectId],
  );

  res.json(schemas.map(serializeSchema));
});

/**
 * POST /api/projects/:projectId/schemas/auto-generate
 */
router.post("/auto-generate", async (req, res) => {
  const body = AutoGenerateSchemaBody.parse(req.body);

  const sampleText = sanitizeMultilineText(body.sampleText, 8000);
  const surveyType = body.surveyType
    ? sanitizeText(body.surveyType, 255)
    : null;

  if (!sampleText) {
    res.status(400).json({ error: "sampleText is required" });
    return;
  }

  const result = await autoGenerateSchemaAgent(sampleText, surveyType);

  res.json({
    suggestedName: sanitizeText(result.suggestedName, 255),
    suggestedDescription: sanitizeMultilineText(
      result.suggestedDescription,
      2000,
    ),
    columns: sanitizeSchemaColumns(result.columns),
  });
});

/**
 * POST /api/projects/:projectId/schemas
 */
router.post("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;
  const body = CreateSchemaBody.parse(req.body);

  const name = sanitizeText(body.name, 255);
  const description = sanitizeOptionalMultilineText(body.description, 2000);
  const columns = sanitizeSchemaColumns(body.columns);

  if (!name) {
    res.status(400).json({ error: "Schema name is required" });
    return;
  }

  if (columns.length === 0) {
    res.status(400).json({ error: "At least one schema column is required" });
    return;
  }

  if (body.isDefault) {
    await query("UPDATE schemas SET is_default = false WHERE project_id = $1", [
      projectId,
    ]);
  }

  const schema = await queryOne(
    `INSERT INTO schemas (project_id, name, description, columns, is_default)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      projectId,
      name,
      description,
      JSON.stringify(columns),
      body.isDefault ?? false,
    ],
  );

  res.status(201).json(serializeSchema(schema));
});

/**
 * GET /api/projects/:projectId/schemas/:id
 */
router.get("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  const schema = await queryOne(
    "SELECT * FROM schemas WHERE id = $1 AND project_id = $2",
    [id, projectId],
  );

  if (!schema) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  res.json(serializeSchema(schema));
});

/**
 * PATCH /api/projects/:projectId/schemas/:id
 */
router.patch("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };
  const body = UpdateSchemaBody.parse(req.body);

  if (body.isDefault) {
    await query("UPDATE schemas SET is_default = false WHERE project_id = $1", [
      projectId,
    ]);
  }

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let idx = 1;

  if (body.name !== undefined) {
    const name = sanitizeText(body.name, 255);
    if (!name) {
      res.status(400).json({ error: "Schema name is required" });
      return;
    }

    sets.push(`name = $${idx++}`);
    params.push(name);
  }

  if (body.description !== undefined) {
    const description =
      body.description === null
        ? null
        : sanitizeOptionalMultilineText(body.description, 2000);

    sets.push(`description = $${idx++}`);
    params.push(description);
  }

  if (body.columns !== undefined) {
    const columns = sanitizeSchemaColumns(body.columns);

    if (columns.length === 0) {
      res.status(400).json({ error: "At least one schema column is required" });
      return;
    }

    sets.push(`columns = $${idx++}`);
    params.push(JSON.stringify(columns));
  }

  if (body.isDefault !== undefined) {
    sets.push(`is_default = $${idx++}`);
    params.push(body.isDefault);
  }

  params.push(id, projectId);

  const schema = await queryOne(
    `UPDATE schemas
     SET ${sets.join(", ")}
     WHERE id = $${idx++} AND project_id = $${idx}
     RETURNING *`,
    params,
  );

  if (!schema) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  res.json(serializeSchema(schema));
});

/**
 * DELETE /api/projects/:projectId/schemas/:id
 */
router.delete("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  await query("DELETE FROM schemas WHERE id = $1 AND project_id = $2", [
    id,
    projectId,
  ]);

  res.json({ success: true, message: "Schema deleted" });
});

export default router;
