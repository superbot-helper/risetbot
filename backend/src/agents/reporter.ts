/**
 * Reporter Agent — Generates DOCX reports from analysis data.
 * Connects to Python service for template-based Jinja2 report generation.
 * Falls back to LLM-generated text report when Python service is unavailable.
 * Also records latency/trace context for observability and preserves
 * verified facts produced by upstream analysis.
 */
import { generateDocxReport } from "../lib/pythonService.js";
import { reporterAgent as llmReporterAgent } from "../lib/agents.js";
import { trackAgentRun, type TraceContext } from "../lib/observability.js";
import { logger } from "../lib/logger.js";

export interface ReporterRunContext extends TraceContext {
  projectId?: string;
  traceId?: string;
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

  const statistics =
    analysisData.statistics &&
    typeof analysisData.statistics === "object" &&
    !Array.isArray(analysisData.statistics)
      ? (analysisData.statistics as Record<string, unknown>)
      : {};

  const keyFindings = Array.isArray(analysisData.keyFindings)
    ? analysisData.keyFindings
    : Array.isArray(analysisData.key_findings)
      ? analysisData.key_findings
      : [];

  const recommendations = Array.isArray(analysisData.recommendations)
    ? analysisData.recommendations
    : [];

  return {
    summary,
    recordCount,
    statistics,
    keyFindings,
    recommendations,
    generatedFrom: "validated-analysis-data",
  };
}

/**
 * Generate a formal report from analysis data.
 * Priority: Python DOCX template → LLM text report fallback.
 *
 * @param templatePath - Path to DOCX template, if available.
 * @param analysisData - Analysis results from Analyst Agent.
 * @param projectName - Project name.
 * @param reportName - Report name.
 * @param runContext - Optional observability/trace context.
 * @returns Report generation result.
 */
export async function generateReport(
  templatePath: string | undefined,
  analysisData: Record<string, unknown>,
  projectName: string,
  reportName: string,
  runContext: ReporterRunContext = {},
): Promise<Record<string, unknown>> {
  return trackAgentRun(
    {
      agentName: "Reporter",
      operation: "generate-report",
      projectId: runContext.projectId,
      traceId: runContext.traceId,
      input: {
        projectName,
        reportName,
        hasTemplate: Boolean(templatePath),
        hasAnalysisData: Boolean(analysisData),
      },
      metadata: {
        stage: "analysis-to-report",
      },
    },
    async (context) => {
      const verifiedFacts = buildVerifiedFacts(analysisData);

      logger.info(
        {
          projectName,
          reportName,
          traceId: context.traceId,
          hasTemplate: Boolean(templatePath),
        },
        "Reporter: Starting report generation",
      );

      // Try Python service DOCX generation first
      if (templatePath) {
        try {
          const outputPath = `reports/${projectName.replace(/[^a-z0-9]/gi, "_")}/${reportName.replace(/[^a-z0-9]/gi, "_")}.docx`;

          const result = await generateDocxReport(
            templatePath,
            outputPath,
            {
              ...analysisData,
              verifiedFacts,
            },
            projectName,
            reportName,
          );

          logger.info(
            {
              outputPath: result.output_path,
              fileSize: result.file_size,
              traceId: context.traceId,
            },
            "Reporter: DOCX report generated via Python service",
          );

          return {
            ...analysisData,
            verifiedFacts,
            reportType: "docx",
            reportPath: result.output_path,
            fileSize: result.file_size,
            templateUsed: result.template_used,
            generatedAt: result.generated_at,
          };
        } catch (error) {
          logger.warn(
            {
              traceId: context.traceId,
              error: error instanceof Error ? error.message : String(error),
            },
            "Reporter: Python DOCX generation failed, falling back to LLM text report",
          );
        }
      }

      // Fallback: LLM-generated text report
      const reportContent = await llmReporterAgent(
        {
          ...analysisData,
          verifiedFacts,
        },
        projectName,
        reportName,
        {
          projectId: runContext.projectId,
          traceId: context.traceId,
          observationId: context.observationId,
          metadata: {
            fallback: "llm-text-report",
            hasTemplate: Boolean(templatePath),
          },
        },
      );

      logger.info(
        {
          projectName,
          reportName,
          traceId: context.traceId,
        },
        "Reporter: LLM text report generated",
      );

      return {
        ...analysisData,
        verifiedFacts,
        reportContent,
        reportType: "text",
        generatedAt: new Date().toISOString(),
      };
    },
  );
}
