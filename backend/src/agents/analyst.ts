/**
 * Analyst Agent — Performs comprehensive survey data analysis.
 * Connects to Python service for Pandas-based statistics and sentiment.
 * Falls back to LLM-only analysis when Python service is unavailable.
 */
import { analyzeData, type AnalysisResult } from '../lib/pythonService.js';
import { analystAgent as llmAnalystAgent, type SchemaColumn } from '../lib/agents.js';
import { logger } from '../lib/logger.js';

/**
 * Analyze survey data comprehensively.
 * Priority: Python service (Pandas-based) → LLM fallback.
 *
 * @param data - Compiled survey data rows.
 * @param schema - Schema columns.
 * @param options - Analysis options.
 * @returns Analysis results with statistics, sentiment, themes.
 */
export async function analyzeWithPandas(
  data: Record<string, unknown>[],
  schema: Record<string, unknown>[],
  options?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  logger.info(
    { recordCount: data.length },
    'Analyst: Starting data analysis'
  );

  if (data.length === 0) {
    return {
      summary: 'Tidak ada data yang tersedia untuk dianalisis.',
      recordCount: 0,
      statistics: {},
      themes: [],
      sentiment: {},
      recommendations: [],
      keyFindings: [],
    };
  }

  const schemaColumns = schema.map((col) => ({
    name: String(col.name || ''),
    type: String(col.type || 'text'),
    aiGuidance: String(col.aiGuidance || col.ai_guidance || ''),
  }));

  // Try Python service first for accurate Pandas-based analysis
  try {
    const pythonResult = await analyzeData(data, schemaColumns, {
      includeStatistics: Boolean(options?.includeStatistics ?? true),
      includeSentiment: Boolean(options?.includeSentiment ?? true),
      includeThemes: Boolean(options?.includeThemes ?? true),
    });

    logger.info('Analyst: Python-based analysis completed');

    return {
      summary: pythonResult.summary,
      recordCount: pythonResult.record_count,
      statistics: pythonResult.statistics,
      themes: pythonResult.themes,
      sentiment: pythonResult.sentiment,
      keyFindings: pythonResult.key_findings,
      recommendations: pythonResult.recommendations,
      method: 'pandas',
    };
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Analyst: Python service unavailable, falling back to LLM analysis'
    );
  }

  // Fallback: LLM-based analysis
  const llmSchema: SchemaColumn[] = schemaColumns.map((col) => ({
    name: col.name,
    type: col.type as SchemaColumn['type'],
    aiGuidance: col.aiGuidance,
  }));

  const llmResult = await llmAnalystAgent(data, llmSchema, {
    includeStatistics: Boolean(options?.includeStatistics ?? true),
    includeSentiment: Boolean(options?.includeSentiment ?? true),
    includeThemes: Boolean(options?.includeThemes ?? true),
    customPrompt: options?.customPrompt as string | null | undefined,
  });

  logger.info('Analyst: LLM fallback analysis completed');

  return {
    ...llmResult,
    method: 'llm',
  };
}
