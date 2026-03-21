/**
 * Compiler Agent — Cleans and standardizes extracted survey data.
 * Connects to Python service for data compilation (CSV/XLSX export),
 * and records latency/trace context for observability.
 */
import { compileToCSV } from "../lib/pythonService.js";
import {
  compilerAgent,
  type ExtractionResult,
  type SchemaColumn,
} from "../lib/agents.js";
import { trackAgentRun, type TraceContext } from "../lib/observability.js";
import { logger } from "../lib/logger.js";

export interface CompilerRunContext extends TraceContext {
  projectId?: string;
  traceId?: string;
}

/**
 * Compile extracted data: clean with LLM, then format via Python service.
 *
 * @param extractionResult - Raw extraction result from Extractor Agent.
 * @param schema - Schema columns for type enforcement.
 * @param runContext - Optional observability/trace context.
 * @returns Cleaned and compiled data rows.
 */
export async function compileData(
  extractionResult: Record<string, unknown>,
  schema: SchemaColumn[] | Record<string, unknown>[],
  runContext: CompilerRunContext = {},
): Promise<Record<string, unknown>[]> {
  return trackAgentRun(
    {
      agentName: "Compiler",
      operation: "compile-data",
      projectId: runContext.projectId,
      traceId: runContext.traceId,
      input: {
        inputRowCount: Array.isArray(extractionResult.rows)
          ? extractionResult.rows.length
          : 0,
        schemaColumnCount: Array.isArray(schema) ? schema.length : 0,
      },
      metadata: {
        stage: "clean-and-standardize-rows",
      },
    },
    async (context) => {
      logger.info(
        {
          traceId: context.traceId,
        },
        "Compiler: Starting data compilation",
      );

      const rows = (extractionResult.rows as Record<string, unknown>[]) || [];

      if (rows.length === 0) {
        logger.warn(
          { traceId: context.traceId },
          "Compiler: No rows to compile",
        );
        return [];
      }

      const schemaColumns: SchemaColumn[] = (
        schema as Array<Record<string, unknown>>
      ).map((col) => ({
        name: String(col.name || ""),
        type: (col.type as SchemaColumn["type"]) || "text",
        aiGuidance: String(col.aiGuidance || col.ai_guidance || ""),
        required: Boolean(col.required),
      }));

      const fullExtraction: ExtractionResult = {
        rows,
        rawText: String(extractionResult.rawText || ""),
        pageCount: Number(extractionResult.pageCount || 0),
        confidence: Number(extractionResult.confidence || 0),
      };

      const compiledData = await compilerAgent(fullExtraction, schemaColumns, {
        projectId: runContext.projectId,
        traceId: context.traceId,
        observationId: context.observationId,
        metadata: {
          rowCount: rows.length,
          schemaColumnCount: schemaColumns.length,
        },
      });

      logger.info(
        {
          traceId: context.traceId,
          inputRows: rows.length,
          outputRows: compiledData.length,
        },
        "Compiler: Data compilation completed",
      );

      return compiledData;
    },
  );
}

/**
 * Export compiled data to CSV format via Python service.
 *
 * @param data - Compiled data rows.
 * @returns CSV content string.
 */
export async function exportToCSV(
  data: Record<string, unknown>[],
): Promise<string> {
  try {
    const result = await compileToCSV(data);
    return result.csv_content || "";
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Compiler: Python export unavailable, generating CSV locally",
    );

    return generateCSVLocally(data);
  }
}

/**
 * Local CSV generation fallback when Python service is unavailable.
 */
function generateCSVLocally(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = new Set<string>();
  for (const row of data) {
    Object.keys(row).forEach((key) => {
      if (!key.startsWith("_")) headers.add(key);
    });
  }

  const headerArr = Array.from(headers);
  const lines = [headerArr.join(",")];

  for (const row of data) {
    const line = headerArr
      .map((header) => {
        const value = row[header] ?? "";
        const text = String(value).replace(/"/g, '""');
        return `"${text}"`;
      })
      .join(",");

    lines.push(line);
  }

  return lines.join("\n");
}
