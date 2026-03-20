/**
 * Extractor Agent — Parses PDF and extracts structured data.
 * Connects to Python service for OCR processing, then uses LLM for
 * data extraction according to schema.
 */
import { extractTextFromPDF, type OCRResult } from '../lib/pythonService.js';
import { extractorAgent, type SchemaColumn, type ExtractionResult } from '../lib/agents.js';
import { logger } from '../lib/logger.js';

/**
 * Extract structured data from a PDF file.
 * Pipeline: PDF → Python OCR → LLM Extraction → Structured JSON.
 *
 * @param fileContent - Base64-encoded PDF content.
 * @param fileName - Original filename.
 * @param schema - Schema columns defining extraction structure.
 * @returns Extraction result with rows, raw text, and metadata.
 */
export async function extractFromPDF(
  fileContent: string,
  fileName: string,
  schema: SchemaColumn[] | Record<string, unknown>[]
): Promise<ExtractionResult> {
  logger.info({ fileName }, 'Extractor: Starting PDF extraction');

  let pdfText = '';
  let pageCount = 0;
  let ocrMethod = 'fallback';

  // Step 1: Try Python service OCR
  try {
    const ocrResult = await extractTextFromPDF(fileContent, fileName);
    pdfText = ocrResult.text;
    pageCount = ocrResult.page_count;
    ocrMethod = ocrResult.method;
    logger.info(
      { fileName, pageCount, method: ocrMethod },
      'Extractor: OCR completed via Python service'
    );
  } catch (error) {
    // Fallback: decode base64 directly
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Extractor: Python OCR unavailable, using base64 text fallback'
    );

    try {
      const buffer = Buffer.from(fileContent, 'base64');
      pdfText = buffer.toString('utf-8');

      // If it looks like raw PDF binary, we can't extract useful text
      if (pdfText.includes('%PDF') || pdfText.includes('\x00')) {
        pdfText = `[PDF content from ${fileName} - requires OCR service to extract text]`;
      }
    } catch {
      pdfText = `[Unable to extract text from ${fileName}]`;
    }
  }

  if (!pdfText.trim()) {
    logger.warn({ fileName }, 'Extractor: No text extracted from PDF');
    return {
      rows: [],
      rawText: '',
      pageCount: 0,
      confidence: 0,
    };
  }

  // Step 2: Use LLM to extract structured data from text
  const schemaColumns: SchemaColumn[] = (schema as any[]).map((col: any) => ({
    name: String(col.name || ''),
    type: (col.type as SchemaColumn['type']) || 'text',
    aiGuidance: String(col.aiGuidance || col.ai_guidance || ''),
    required: Boolean(col.required),
  }));

  const extraction = await extractorAgent(pdfText, schemaColumns);

  logger.info(
    { fileName, rowCount: extraction.rows.length, confidence: extraction.confidence },
    'Extractor: Data extraction completed'
  );

  return {
    ...extraction,
    pageCount: pageCount || extraction.pageCount,
  };
}
