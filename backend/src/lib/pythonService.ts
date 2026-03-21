// RisetBot backend — Python service client helpers
// Communicates with the Python AI/Data Processing service.

const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:9000";

const REQUEST_TIMEOUT = 120_000;

async function parseJsonSafe<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string; error?: string };
    return data.detail || data.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function pythonRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  options: { timeout?: number } = {},
): Promise<T> {
  const timeout = options.timeout ?? REQUEST_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(
        `Python service error (${response.status}) on ${endpoint}: ${message}`,
      );
    }

    return parseJsonSafe<T>(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Python service request to ${endpoint} timed out after ${timeout}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

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

export async function extractTextFromPDF(
  fileContent: string,
  fileName: string,
): Promise<OCRResult> {
  return pythonRequest<OCRResult>("/ocr/extract", {
    file_content: fileContent,
    file_name: fileName,
  });
}

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

export async function analyzeData(
  data: Record<string, unknown>[],
  schemaColumns: Record<string, unknown>[],
  options?: {
    includeStatistics?: boolean;
    includeSentiment?: boolean;
    includeThemes?: boolean;
  },
): Promise<AnalysisResult> {
  return pythonRequest<AnalysisResult>("/analysis/analyze", {
    data,
    schema_columns: schemaColumns,
    include_statistics: options?.includeStatistics ?? true,
    include_sentiment: options?.includeSentiment ?? true,
    include_themes: options?.includeThemes ?? true,
  });
}

export interface ReportResult {
  status: string;
  output_path: string;
  file_size: number;
  template_used: string;
  generated_at: string;
}

export async function generateDocxReport(
  templatePath: string,
  outputPath: string,
  analysisData: Record<string, unknown>,
  projectName: string,
  reportName: string,
): Promise<ReportResult> {
  return pythonRequest<ReportResult>("/report/generate", {
    template_path: templatePath,
    output_path: outputPath,
    analysis_data: analysisData,
    project_name: projectName,
    report_name: reportName,
  });
}

export interface RAGResult {
  status: string;
  answer: string;
  sources: Array<{ file_name: string; page: number }>;
  confidence: number;
}

export async function queryRAG(
  question: string,
  documents: Array<{ file_name: string; text: string; pages?: unknown[] }>,
  chatHistory?: Array<{ role: string; content: string }>,
): Promise<RAGResult> {
  return pythonRequest<RAGResult>("/rag/query", {
    question,
    documents,
    chat_history: chatHistory,
  });
}

export interface CompileResult {
  status: string;
  csv_content?: string;
  row_count: number;
  column_count?: number;
  columns?: string[];
}

export async function compileToCSV(
  data: Record<string, unknown>[],
): Promise<CompileResult> {
  return pythonRequest<CompileResult>("/compile/export", {
    data,
    format: "csv",
  });
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateUploadedFile(
  filename: string,
  fileSize: number,
  purpose: "knowledge" | "template",
): Promise<FileValidationResult> {
  return pythonRequest<FileValidationResult>("/files/validate", {
    filename,
    file_size: fileSize,
    purpose,
  });
}

export interface StoredFileResult {
  status: string;
  file_path: string;
  file_name: string;
  stored_name: string;
  file_size: number;
}

export async function uploadFileToStorage(
  projectId: string,
  fileBytes: Buffer | Uint8Array | ArrayBuffer,
  fileName: string,
  purpose: "knowledge" | "template",
): Promise<StoredFileResult> {
  const formData = new FormData();

  const bytes =
    fileBytes instanceof ArrayBuffer
      ? new Uint8Array(fileBytes)
      : fileBytes instanceof Uint8Array
        ? fileBytes
        : new Uint8Array(fileBytes);

  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  const blob = new Blob([arrayBuffer]);
  formData.append("file", blob, fileName);
  formData.append("purpose", purpose);

  const response = await fetch(
    `${PYTHON_SERVICE_URL}/files/upload/${projectId}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(
      `Python storage upload failed (${response.status}) for ${fileName}: ${message}`,
    );
  }

  return parseJsonSafe<StoredFileResult>(response);
}

export async function checkPythonServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
