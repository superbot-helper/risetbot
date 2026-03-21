import { Router, type IRouter } from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { queryRows, queryOne, query } from "../lib/db.js";
import { GenerateReportBody } from "../lib/validators.js";
import { type SchemaColumn } from "../lib/agents.js";
import { analyzeWithPandas } from "../agents/analyst.js";
import { generateReport } from "../agents/reporter.js";
import { logActivity } from "../lib/activity.js";
import { logger } from "../lib/logger.js";
import {
  sanitizeOptionalMultilineText,
  sanitizeStringArray,
  sanitizeText,
} from "../lib/sanitize.js";
import { startWorkflowTrace } from "../lib/observability.js";

const router: IRouter = Router({ mergeParams: true });
const PROJECT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

type ReportRow = {
  id: string;
  project_id: string;
  template_id: string | null;
  name: string;
  file_path: string;
  analysis_data: Record<string, unknown> | null;
  source_ids: string[] | null;
  status: string | null;
  version: number | null;
  created_at: string;
  updated_at: string | null;
};

type KnowledgeRow = {
  id: string;
  file_name: string;
  extracted_data: Record<string, unknown> | null;
};

type TemplateRow = {
  id: string;
  name: string;
  file_path: string;
  is_default: boolean | null;
};

type ReportPipelineStep = {
  key: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
};

function resolveStoredPath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(PROJECT_ROOT, filePath.replace(/^\.\//, ""));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRows(rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => row as Record<string, unknown>);
}

function buildPipeline(
  currentStep: number,
  currentLabel: string,
  error?: string | null,
): {
  currentStep: number;
  totalSteps: number;
  currentLabel: string;
  error?: string;
  steps: ReportPipelineStep[];
} {
  const labels = [
    { key: "collect", label: "Mengumpulkan data survey" },
    { key: "analyze", label: "Menganalisis data dengan Pandas" },
    { key: "generate", label: "Menyusun laporan" },
    { key: "finalize", label: "Menyelesaikan output" },
  ];

  return {
    currentStep,
    totalSteps: labels.length,
    currentLabel,
    ...(error ? { error } : {}),
    steps: labels.map((step, index) => {
      const stepNumber = index + 1;

      let status: ReportPipelineStep["status"] = "pending";
      if (error && stepNumber === currentStep) {
        status = "error";
      } else if (stepNumber < currentStep) {
        status = "done";
      } else if (stepNumber === currentStep) {
        status = "active";
      }

      return {
        key: step.key,
        label: step.label,
        status,
      };
    }),
  };
}

function inferReportStatus(report: ReportRow): string {
  if (report.status) return report.status;

  const analysisData = isPlainObject(report.analysis_data)
    ? report.analysis_data
    : null;

  if (!analysisData) return "pending";

  if (typeof analysisData.status === "string") {
    return analysisData.status;
  }

  if (analysisData.reportType || analysisData.reportContent) {
    return "done";
  }

  return "pending";
}

function inferReportProgress(report: ReportRow): number {
  const analysisData = isPlainObject(report.analysis_data)
    ? report.analysis_data
    : null;

  const pipeline = isPlainObject(analysisData?.pipeline)
    ? analysisData?.pipeline
    : null;

  if (
    pipeline &&
    typeof pipeline.currentStep === "number" &&
    typeof pipeline.totalSteps === "number" &&
    pipeline.totalSteps > 0
  ) {
    return Math.min(
      100,
      Math.max(
        0,
        Math.round((pipeline.currentStep / pipeline.totalSteps) * 100),
      ),
    );
  }

  const status = inferReportStatus(report);
  switch (status) {
    case "queued":
      return 10;
    case "collecting":
      return 25;
    case "analyzing":
      return 50;
    case "generating":
      return 80;
    case "done":
      return 100;
    case "error":
      return 100;
    default:
      return 0;
  }
}

function serializeReport(report: ReportRow) {
  const analysisData = isPlainObject(report.analysis_data)
    ? report.analysis_data
    : null;

  return {
    id: report.id,
    projectId: report.project_id,
    templateId: report.template_id,
    name: report.name,
    filePath: report.file_path,
    analysisData,
    sourceIds: Array.isArray(report.source_ids) ? report.source_ids : [],
    status: inferReportStatus(report),
    progress: inferReportProgress(report),
    version: Number(report.version ?? 1),
    createdAt: report.created_at,
    updatedAt: report.updated_at ?? report.created_at,
  };
}

function buildVerifiedFacts(
  analysisData: Record<string, unknown>,
): Record<string, unknown> {
  const summary =
    typeof analysisData.summary === "string" ? analysisData.summary : "";

  const recordCount =
    typeof analysisData.recordCount === "number"
      ? analysisData.recordCount
      : typeof analysisData.record_count === "number"
        ? analysisData.record_count
        : 0;

  const statistics = isPlainObject(analysisData.statistics)
    ? analysisData.statistics
    : {};

  const sentiment = isPlainObject(analysisData.sentiment)
    ? analysisData.sentiment
    : {};

  const themes = Array.isArray(analysisData.themes)
    ? analysisData.themes.slice(0, 10)
    : [];

  const keyFindings = Array.isArray(analysisData.keyFindings)
    ? analysisData.keyFindings.slice(0, 10)
    : Array.isArray(analysisData.key_findings)
      ? analysisData.key_findings.slice(0, 10)
      : [];

  const recommendations = Array.isArray(analysisData.recommendations)
    ? analysisData.recommendations.slice(0, 10)
    : [];

  return {
    summary,
    recordCount,
    statistics,
    sentiment,
    themes,
    keyFindings,
    recommendations,
    generatedFrom: "validated-analysis-data",
  };
}

async function updateReportState(
  reportId: string,
  status: string,
  currentStep: number,
  currentLabel: string,
  extraAnalysisData: Record<string, unknown> = {},
  templateId?: string | null,
): Promise<void> {
  const pipeline = buildPipeline(
    currentStep,
    currentLabel,
    typeof extraAnalysisData.error === "string"
      ? extraAnalysisData.error
      : null,
  );

  const nextAnalysisData = {
    status,
    pipeline,
    ...extraAnalysisData,
  };

  if (templateId !== undefined) {
    await query(
      `
        UPDATE reports
        SET
          status = $2,
          template_id = COALESCE($3, template_id),
          analysis_data = $4,
          updated_at = NOW()
        WHERE id = $1
      `,
      [reportId, status, templateId, JSON.stringify(nextAnalysisData)],
    );
    return;
  }

  await query(
    `
      UPDATE reports
      SET
        status = $2,
        analysis_data = $3,
        updated_at = NOW()
      WHERE id = $1
    `,
    [reportId, status, JSON.stringify(nextAnalysisData)],
  );
}

async function generateReportAsync(
  reportId: string,
  projectId: string,
  options: {
    name: string;
    templateId?: string;
    sourceIds?: string[];
    includeStatistics?: boolean;
    includeSentiment?: boolean;
    includeThemes?: boolean;
    customPrompt?: string | null;
  },
): Promise<void> {
  const trace = startWorkflowTrace("Report Generation Pipeline", {
    projectId,
    metadata: {
      reportId,
      reportName: options.name,
      sourceIds: options.sourceIds ?? [],
      templateId: options.templateId ?? null,
    },
  });

  try {
    await updateReportState(
      reportId,
      "collecting",
      1,
      "Mengumpulkan data survey",
    );

    const processedFiles = await queryRows<KnowledgeRow>(
      `
        SELECT id, file_name, extracted_data
        FROM knowledge
        WHERE project_id = $1 AND status = 'done'
        ORDER BY created_at ASC
      `,
      [projectId],
    );

    const normalizedSourceIds =
      Array.isArray(options.sourceIds) && options.sourceIds.length > 0
        ? options.sourceIds
        : processedFiles.map((file) => file.id);

    const selectedFiles = processedFiles.filter((file) =>
      normalizedSourceIds.includes(file.id),
    );

    const allData: Record<string, unknown>[] = [];
    for (const file of selectedFiles) {
      const rows = normalizeRows(file.extracted_data?.rows);
      allData.push(
        ...rows.map((row) => ({
          ...row,
          _source: file.file_name,
        })),
      );
    }

    const schemas = await queryRows<{ columns: SchemaColumn[] }>(
      `
        SELECT columns
        FROM schemas
        WHERE project_id = $1
        ORDER BY is_default DESC, updated_at DESC, created_at DESC
      `,
      [projectId],
    );

    const schema: SchemaColumn[] =
      schemas.length > 0 ? (schemas[0].columns ?? []) : [];

    const project = await queryOne<{ name: string }>(
      `
        SELECT name
        FROM projects
        WHERE id = $1
        LIMIT 1
      `,
      [projectId],
    );

    const projectName = project?.name ?? "Survey Project";

    await updateReportState(
      reportId,
      "analyzing",
      2,
      "Menganalisis data dengan Pandas",
      {
        selectedSourceCount: selectedFiles.length,
        selectedSources: selectedFiles.map((file) => ({
          id: file.id,
          fileName: file.file_name,
        })),
        recordCount: allData.length,
      },
    );

    const analysisData = await analyzeWithPandas(
      allData,
      schema,
      {
        includeStatistics: options.includeStatistics,
        includeSentiment: options.includeSentiment,
        includeThemes: options.includeThemes,
        customPrompt: options.customPrompt,
      },
      {
        projectId,
        traceId: trace?.traceId,
      },
    );

    const verifiedFacts = buildVerifiedFacts(analysisData);

    let template: TemplateRow | null = null;
    if (options.templateId) {
      template = await queryOne<TemplateRow>(
        `
          SELECT id, name, file_path, is_default
          FROM templates
          WHERE id = $1 AND project_id = $2
          LIMIT 1
        `,
        [options.templateId, projectId],
      );
    }

    if (!template) {
      template = await queryOne<TemplateRow>(
        `
          SELECT id, name, file_path, is_default
          FROM templates
          WHERE project_id = $1
          ORDER BY is_default DESC, created_at DESC
          LIMIT 1
        `,
        [projectId],
      );
    }

    await updateReportState(
      reportId,
      "generating",
      3,
      "Menyusun laporan",
      {
        analysisSummary: analysisData.summary ?? null,
        verifiedFacts,
        method: analysisData.method ?? null,
      },
      template?.id ?? null,
    );

    const reportResult = await generateReport(
      template?.file_path,
      {
        ...analysisData,
        verifiedFacts,
      },
      projectName,
      options.name,
      {
        projectId,
        traceId: trace?.traceId,
      },
    );

    const finalAnalysisData = {
      ...reportResult,
      verifiedFacts,
      selectedSourceIds: normalizedSourceIds,
      selectedSourceNames: selectedFiles.map((file) => file.file_name),
      pipeline: buildPipeline(4, "Selesai"),
      status: "done",
    };

    await query(
      `
        UPDATE reports
        SET
          status = 'done',
          template_id = COALESCE($2, template_id),
          analysis_data = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [reportId, template?.id ?? null, JSON.stringify(finalAnalysisData)],
    );

    await logActivity(
      projectId,
      "report",
      `Laporan "${options.name}" selesai dibuat`,
    );

    trace?.update({
      status: "done",
      reportName: options.name,
      selectedSourceCount: selectedFiles.length,
      verifiedRecordCount: verifiedFacts.recordCount ?? 0,
      templateName: template?.name ?? null,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Report generation failed";

    await updateReportState(reportId, "error", 3, "Gagal membuat laporan", {
      error: errorMessage,
    });

    await logActivity(
      projectId,
      "error",
      `Error membuat laporan: ${errorMessage}`,
    );

    trace?.update({
      status: "error",
      error: errorMessage,
    });

    logger.error(
      {
        reportId,
        projectId,
        traceId: trace?.traceId,
        error: errorMessage,
      },
      "Report generation failed",
    );
  }
}

/**
 * GET /api/projects/:projectId/reports
 */
router.get("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;

  const reports = await queryRows<ReportRow>(
    `
      SELECT *
      FROM reports
      WHERE project_id = $1
      ORDER BY created_at DESC
    `,
    [projectId],
  );

  res.json(reports.map(serializeReport));
});

/**
 * POST /api/projects/:projectId/reports
 */
router.post("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;
  const body = GenerateReportBody.parse(req.body);

  const name = sanitizeText(body.name, 255);
  const sourceIds = sanitizeStringArray(body.sourceIds ?? [], 100, 64);
  const customPrompt = body.customPrompt
    ? sanitizeOptionalMultilineText(body.customPrompt, 5000)
    : null;

  if (!name) {
    res.status(400).json({ error: "Report name is required" });
    return;
  }

  const report = await queryOne<ReportRow>(
    `
      INSERT INTO reports (
        project_id,
        template_id,
        name,
        file_path,
        analysis_data,
        source_ids,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'queued')
      RETURNING *
    `,
    [
      projectId,
      body.templateId ?? null,
      name,
      `reports/${projectId}/${name.replace(/[^a-z0-9]/gi, "_")}.docx`,
      JSON.stringify({
        status: "queued",
        pipeline: buildPipeline(1, "Menunggu proses"),
      }),
      sourceIds.length > 0 ? JSON.stringify(sourceIds) : null,
    ],
  );

  if (!report) {
    res.status(500).json({ error: "Failed to create report record" });
    return;
  }

  await logActivity(projectId, "report", `Laporan "${name}" mulai dibuat`);

  generateReportAsync(report.id, projectId, {
    name,
    templateId: body.templateId,
    sourceIds,
    includeStatistics: body.includeStatistics,
    includeSentiment: body.includeSentiment,
    includeThemes: body.includeThemes,
    customPrompt,
  }).catch((error) => {
    logger.error(
      {
        reportId: report.id,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Unexpected report generation failure",
    );
  });

  res.status(201).json(serializeReport(report));
});

/**
 * GET /api/projects/:projectId/reports/:id
 */
router.get("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  const report = await queryOne<ReportRow>(
    `
      SELECT *
      FROM reports
      WHERE id = $1 AND project_id = $2
      LIMIT 1
    `,
    [id, projectId],
  );

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json(serializeReport(report));
});

/**
 * GET /api/projects/:projectId/reports/:id/download
 */
router.get("/:id/download", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  const report = await queryOne<ReportRow>(
    `
      SELECT *
      FROM reports
      WHERE id = $1 AND project_id = $2
      LIMIT 1
    `,
    [id, projectId],
  );

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const analysisData = isPlainObject(report.analysis_data)
    ? report.analysis_data
    : null;

  const reportPath =
    typeof analysisData?.reportPath === "string"
      ? analysisData.reportPath
      : report.file_path;

  const reportType =
    typeof analysisData?.reportType === "string"
      ? analysisData.reportType
      : "text";

  if (reportType === "docx" && reportPath) {
    const absolutePath = resolveStoredPath(reportPath);

    try {
      await fs.access(absolutePath);
      res.download(
        absolutePath,
        `${report.name.replace(/[^a-z0-9]/gi, "_")}.docx`,
      );
      return;
    } catch {
      logger.warn(
        { reportId: id, reportPath: absolutePath },
        "DOCX report file not found on disk, falling back to text export",
      );
    }
  }

  const content =
    typeof analysisData?.reportContent === "string"
      ? analysisData.reportContent
      : JSON.stringify(analysisData ?? {}, null, 2);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, "_")}.txt"`,
  );
  res.send(content);
});

/**
 * DELETE /api/projects/:projectId/reports/:id
 */
router.delete("/:id", async (req, res) => {
  const { projectId, id } = req.params as { projectId: string; id: string };

  await query(
    `
      DELETE FROM reports
      WHERE id = $1 AND project_id = $2
    `,
    [id, projectId],
  );

  res.json({ success: true, message: "Report deleted" });
});

export default router;
