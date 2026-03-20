/**
 * Python Service Client — HTTP client for communicating with the
 * Python AI/Data Processing service.
 */
import { logger } from './logger.js';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:9000';
const REQUEST_TIMEOUT = 120_000; // 2 minutes

/**
 * Generic request to the Python service.
 */
async function pythonRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  options: { timeout?: number } = {}
): Promise<T> {
  const url = `${PYTHON_SERVICE_URL}${endpoint}`;
  const timeout = options.timeout || REQUEST_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Python service error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Python service request to ${endpoint} timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── OCR ────────────────────────────────────────────────────

export interface OCRResult {
  status: string;
  text: string;
  page_count: number;
  method: string;
  pages: Array<{
    page_number: number;
    text: string;
    char_count: number;
  }>;
}

/**
 * Extract text from a base64-encoded PDF via Python OCR service.
 */
export async function extractTextFromPDF(
  fileContent: string,
  fileName: string
): Promise<OCRResult> {
  return pythonRequest<OCRResult>('/ocr/extract', {
    file_content: fileContent,
    file_name: fileName,
  });
}

// ─── Analysis ───────────────────────────────────────────────

export interface AnalysisResult {
  status: string;
  record_count: number;
  summary: string;
  statistics: Record<string, unknown>;
  sentiment: Record<string, unknown>;
  themes: Array<{ theme: string; count: number; percentage: number }>;
  key_findings: string[];
  recommendations: string[];
}

/**
 * Analyze survey data via Python analysis service.
 */
export async function analyzeData(
  data: Record<string, unknown>[],
  schemaColumns: Record<string, unknown>[],
  options?: {
    includeStatistics?: boolean;
    includeSentiment?: boolean;
    includeThemes?: boolean;
  }
): Promise<AnalysisResult> {
  return pythonRequest<AnalysisResult>('/analysis/analyze', {
    data,
    schema_columns: schemaColumns,
    include_statistics: options?.includeStatistics ?? true,
    include_sentiment: options?.includeSentiment ?? true,
    include_themes: options?.includeThemes ?? true,
  });
}

// ─── Report ─────────────────────────────────────────────────

export interface ReportResult {
  status: string;
  output_path: string;
  file_size: number;
  template_used: string;
  generated_at: string;
}

/**
 * Generate DOCX report via Python report service.
 */
export async function generateDocxReport(
  templatePath: string,
  outputPath: string,
  analysisData: Record<string, unknown>,
  projectName: string,
  reportName: string
): Promise<ReportResult> {
  return pythonRequest<ReportResult>('/report/generate', {
    template_path: templatePath,
    output_path: outputPath,
    analysis_data: analysisData,
    project_name: projectName,
    report_name: reportName,
  });
}

// ─── RAG ────────────────────────────────────────────────────

export interface RAGResult {
  status: string;
  answer: string;
  sources: Array<{ file_name: string; page: number }>;
  confidence: number;
}

/**
 * Query knowledge base via Python RAG service.
 */
export async function queryRAG(
  question: string,
  documents: Array<{ file_name: string; text: string; pages?: unknown[] }>,
  chatHistory?: Array<{ role: string; content: string }>
): Promise<RAGResult> {
  return pythonRequest<RAGResult>('/rag/query', {
    question,
    documents,
    chat_history: chatHistory,
  });
}

// ─── Data Compilation ──────────────────────────────────────

export interface CompileResult {
  status: string;
  csv_content?: string;
  row_count: number;
  column_count?: number;
  columns?: string[];
}

/**
 * Compile data to CSV via Python service.
 */
export async function compileToCSV(
  data: Record<string, unknown>[]
): Promise<CompileResult> {
  return pythonRequest<CompileResult>('/compile/export', {
    data,
    format: 'csv',
  });
}

// ─── Health Check ──────────────────────────────────────────

/**
 * Check if the Python service is available.
 */
export async function checkPythonServiceHealth(): Promise<boolean> {
  try {
    const url = `${PYTHON_SERVICE_URL}/health`;
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
