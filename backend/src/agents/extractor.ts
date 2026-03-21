/**
 * Extractor Agent — Parses PDF and extracts structured data.
 * Connects to Python service for OCR processing, then uses LLM for
 * data extraction according to schema.
 */
import { extractTextFromPDF } from "../lib/pythonService.js";
import {
  extractorAgent,
  type ExtractionResult,
  type SchemaColumn,
} from "../lib/agents.js";
import { trackAgentRun, type TraceContext } from "../lib/observability.js";
import { logger } from "../lib/logger.js";

export interface ExtractorRunContext extends TraceContext {
  projectId?: string;
  traceId?: string;
}

/**
 * Extract structured data from a PDF file.
 * Pipeline: PDF → Python OCR → LLM Extraction → Structured JSON.
 *
 * @param fileContent - Base64-encoded PDF content.
 * @param fileName - Original filename.
 * @param schema - Schema columns defining extraction structure.
 * @param runContext - Optional observability/trace context.
 * @returns Extraction result with rows, raw text, and metadata.
 */
export async function extractFromPDF(
  fileContent: string,
  fileName: string,
  schema: SchemaColumn[] | Record<string, unknown>[],
  runContext: ExtractorRunContext = {},
): Promise<ExtractionResult> {
  return trackAgentRun(
    {
      agentName: "Extractor",
      operation: "extract-pdf",
      projectId: runContext.projectId,
      traceId: runContext.traceId,
      input: {
        fileName,
        schemaColumnCount: Array.isArray(schema) ? schema.length : 0,
        fileSizeBase64Length: fileContent.length,
      },
      metadata: {
        stage: "pdf-to-structured-data",
      },
    },
    async (context) => {
      logger.info(
        {
          fileName,
          traceId: context.traceId,
        },
        "Extractor: Starting PDF extraction",
      );

      let pdfText = "";
      let pageCount = 0;
      let ocrMethod = "fallback";
      let ocrPages: Array<{
        page_number: number;
        text: string;
        char_count: number;
      }> = [];

      // Step 1: Try Python service OCR
      try {
        const ocrResult = await extractTextFromPDF(fileContent, fileName);
        pdfText = ocrResult.text;
        pageCount = ocrResult.page_count;
        ocrMethod = ocrResult.method;
        ocrPages = Array.isArray(ocrResult.pages) ? ocrResult.pages : [];

        logger.info(
          {
            fileName,
            pageCount,
            method: ocrMethod,
            traceId: context.traceId,
          },
          "Extractor: OCR completed via Python service",
        );
      } catch (error) {
        logger.warn(
          {
            fileName,
            traceId: context.traceId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Extractor: Python OCR unavailable, using base64 text fallback",
        );

        try {
          const buffer = Buffer.from(fileContent, "base64");
          pdfText = buffer.toString("utf-8");

          if (pdfText.includes("%PDF") || pdfText.includes("\x00")) {
            pdfText = `[PDF content from ${fileName} - requires OCR service to extract text]`;
          }
        } catch {
          pdfText = `[Unable to extract text from ${fileName}]`;
        }
      }

      if (!pdfText.trim()) {
        logger.warn(
          { fileName, traceId: context.traceId },
          "Extractor: No text extracted from PDF",
        );

        return {
          rows: [],
          rawText: "",
          pageCount: 0,
          confidence: 0,
        };
      }

      // Step 2: Use LLM to extract structured data from text
      const schemaColumns: SchemaColumn[] = (
        schema as Array<Record<string, unknown>>
      ).map((col) => ({
        name: String(col.name || ""),
        type: (col.type as SchemaColumn["type"]) || "text",
        aiGuidance: String(col.aiGuidance || col.ai_guidance || ""),
        required: Boolean(col.required),
      }));

      const extraction = await extractorAgent(pdfText, schemaColumns, {
        projectId: runContext.projectId,
        traceId: context.traceId,
        observationId: context.observationId,
        metadata: {
          fileName,
          ocrMethod,
          pageCount,
        },
      });

      logger.info(
        {
          fileName,
          rowCount: extraction.rows.length,
          confidence: extraction.confidence,
          method: ocrMethod,
          traceId: context.traceId,
        },
        "Extractor: Data extraction completed",
      );

      return {
        ...extraction,
        pageCount: pageCount || extraction.pageCount,
        pages: ocrPages,
      };
    },
  );
}
