/**
 * Compiler Agent — Cleans and standardizes extracted survey data.
 * Connects to Python service for data compilation (CSV/XLSX export).
 */
import { compileToCSV } from '../lib/pythonService.js';
import { compilerAgent, type SchemaColumn, type ExtractionResult } from '../lib/agents.js';
import { logger } from '../lib/logger.js';

/**
 * Compile extracted data: clean with LLM, then format via Python service.
 *
 * @param extractionResult - Raw extraction result from Extractor Agent.
 * @param schema - Schema columns for type enforcement.
 * @returns Cleaned and compiled data rows.
 */
export async function compileData(
  extractionResult: Record<string, unknown>,
  schema: SchemaColumn[] | Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  logger.info('Compiler: Starting data compilation');

  const rows = (extractionResult.rows as Record<string, unknown>[]) || [];

  if (rows.length === 0) {
    logger.warn('Compiler: No rows to compile');
    return [];
  }

  const schemaColumns: SchemaColumn[] = (schema as any[]).map((col: any) => ({
    name: String(col.name || ''),
    type: (col.type as SchemaColumn['type']) || 'text',
    aiGuidance: String(col.aiGuidance || col.ai_guidance || ''),
    required: Boolean(col.required),
  }));

  // Step 1: LLM-based cleaning and standardization
  const fullExtraction: ExtractionResult = {
    rows,
    rawText: String(extractionResult.rawText || ''),
    pageCount: Number(extractionResult.pageCount || 0),
    confidence: Number(extractionResult.confidence || 0),
  };

  const compiledData = await compilerAgent(fullExtraction, schemaColumns);

  logger.info(
    { inputRows: rows.length, outputRows: compiledData.length },
    'Compiler: Data compilation completed'
  );

  return compiledData;
}

/**
 * Export compiled data to CSV format via Python service.
 *
 * @param data - Compiled data rows.
 * @returns CSV content string.
 */
export async function exportToCSV(
  data: Record<string, unknown>[]
): Promise<string> {
  try {
    const result = await compileToCSV(data);
    return result.csv_content || '';
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Compiler: Python export unavailable, generating CSV locally'
    );

    return generateCSVLocally(data);
  }
}

/**
 * Local CSV generation fallback when Python service is unavailable.
 */
function generateCSVLocally(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = new Set<string>();
  for (const row of data) {
    Object.keys(row).forEach((k) => {
      if (!k.startsWith('_')) headers.add(k);
    });
  }

  const headerArr = Array.from(headers);
  const lines = [headerArr.join(',')];

  for (const row of data) {
    const line = headerArr.map((h) => {
      const val = row[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
    lines.push(line);
  }

  return lines.join('\n');
}
