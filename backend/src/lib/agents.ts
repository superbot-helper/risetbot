/**
 * AI Agent functions — configurable LLM helpers with observability.
 * - Uses OpenAI SDK directly with model/baseURL from .env
 * - Tracks latency, token usage, and Langfuse generations per LLM call
 */
import OpenAI from "openai";
import {
  recordLLMUsage,
  startGenerationObservation,
  type TraceContext,
} from "./observability.js";
import { logger } from "./logger.js";

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "",
  baseURL: process.env.LLM_BASE_URL || undefined,
});

const DEFAULT_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const DEFAULT_TEMPERATURE = Number(process.env.LLM_TEMPERATURE) || 0.7;

// ─── Types ──────────────────────────────────────────────────

export type AgentEvent =
  | { type: "agent_start"; agent: string; message: string; progress: number }
  | { type: "agent_complete"; agent: string; message: string; progress: number }
  | { type: "agent_error"; agent: string; message: string; progress: number }
  | { type: "done"; message: string; progress: number };

export interface SchemaColumn {
  name: string;
  type: "text" | "number" | "date" | "category" | "boolean";
  aiGuidance: string;
  required?: boolean;
}

export interface ExtractionResult {
  rows: Record<string, unknown>[];
  rawText: string;
  pageCount: number;
  confidence: number;
  pages?: Array<{
    page_number: number;
    text: string;
    char_count: number;
  }>;
}

export interface LLMCallContext extends TraceContext {
  agentName?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

// ─── Helpers ────────────────────────────────────────────────

function truncateText(value: string, maxLength = 2000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function summarizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return truncateText(value, 1200);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      sample: value.slice(0, 3).map((item) => summarizeValue(item)),
    };
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      12,
    );
    return Object.fromEntries(
      entries.map(([key, item]) => [key, summarizeValue(item)]),
    );
  }

  return String(value);
}

/**
 * Parse JSON from LLM response — handles code fences and loose text.
 */
function parseJsonFromResponse<T>(text: string, fallback: T): T {
  try {
    const cleaned = text
      .replace(/```(?:json)?\s*/gi, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned) as T;
  } catch {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]) as T;
      } catch {
        // ignore
      }
    }

    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as T;
      } catch {
        // ignore
      }
    }
  }

  return fallback;
}

// ─── LLM Call Helper with Observability ─────────────────────

async function callLLM(
  systemPrompt: string,
  userContent: string,
  maxTokens = 4096,
  context: LLMCallContext = {},
): Promise<string> {
  const agentName = context.agentName ?? "LLM";
  const operation = context.operation ?? "chat.completions.create";

  const generation = startGenerationObservation(
    `${agentName}.${operation}`,
    {
      traceId: context.traceId,
      observationId: context.observationId,
      projectId: context.projectId,
      sessionId: context.sessionId,
      userId: context.userId,
      model: DEFAULT_MODEL,
      metadata: {
        ...context.metadata,
        temperature: DEFAULT_TEMPERATURE,
        maxTokens,
      },
    },
    {
      systemPrompt: truncateText(systemPrompt, 2000),
      userPreview: truncateText(userContent, 4000),
    },
    {
      agentName,
      operation,
    },
  );

  const startedAt = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const latencyMs = Date.now() - startedAt;
    const content = response.choices[0]?.message?.content ?? "";
    const usage = response.usage;

    await recordLLMUsage({
      projectId: context.projectId,
      traceId: generation?.traceId ?? context.traceId,
      observationId: generation?.observationId ?? context.observationId,
      agentName,
      model: DEFAULT_MODEL,
      provider: "openai-compatible",
      latencyMs,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      success: true,
      requestPayload: {
        operation,
        temperature: DEFAULT_TEMPERATURE,
        maxTokens,
        messageCount: 2,
      },
      responsePayload: {
        finishReason: response.choices[0]?.finish_reason ?? null,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : null,
        preview: truncateText(content, 1000),
      },
    });

    generation?.end({
      status: "success",
      latencyMs,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : null,
      outputPreview: truncateText(content, 1000),
    });

    logger.info(
      {
        agentName,
        operation,
        latencyMs,
        model: DEFAULT_MODEL,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        traceId: generation?.traceId ?? context.traceId,
      },
      "LLM call completed",
    );

    return content;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await recordLLMUsage({
      projectId: context.projectId,
      traceId: generation?.traceId ?? context.traceId,
      observationId: generation?.observationId ?? context.observationId,
      agentName,
      model: DEFAULT_MODEL,
      provider: "openai-compatible",
      latencyMs,
      success: false,
      errorMessage,
      requestPayload: {
        operation,
        temperature: DEFAULT_TEMPERATURE,
        maxTokens,
        messageCount: 2,
      },
    });

    generation?.end({
      status: "error",
      latencyMs,
      error: errorMessage,
    });

    logger.error(
      {
        agentName,
        operation,
        latencyMs,
        model: DEFAULT_MODEL,
        traceId: generation?.traceId ?? context.traceId,
        error: errorMessage,
      },
      "LLM call failed",
    );

    throw error;
  }
}

// ─── Extractor Agent ────────────────────────────────────────

export async function extractorAgent(
  pdfText: string,
  schema: SchemaColumn[],
  context: LLMCallContext = {},
): Promise<ExtractionResult> {
  const schemaDescription = schema
    .map((col) => `- ${col.name} (${col.type}): ${col.aiGuidance}`)
    .join("\n");

  const systemPrompt = `You are a data extraction specialist. Your task is to extract structured data from survey PDF text.
Extract data according to the provided schema. Return a valid JSON array of records.
Each record should have keys matching the schema column names.
If a value cannot be found, use null.
Be precise and extract exactly what is in the text.`;

  const userContent = `SCHEMA COLUMNS:
${schemaDescription}

PDF TEXT:
${pdfText.substring(0, 8000)}

Extract all survey responses from this text. Return ONLY a JSON array, no explanation.
Example format: [{"Responden": "Ahmad", "Skor": 4, "Komentar": "..."}, ...]`;

  const result = await callLLM(systemPrompt, userContent, 4096, {
    ...context,
    agentName: "Extractor",
    operation: "extract-structured-data",
    metadata: {
      schemaColumnCount: schema.length,
      inputLength: pdfText.length,
      ...context.metadata,
    },
  });

  const rows = parseJsonFromResponse<Record<string, unknown>[]>(result, []);

  return {
    rows,
    rawText: pdfText,
    pageCount: Math.ceil(pdfText.length / 3000),
    confidence: rows.length > 0 ? 0.85 : 0.3,
  };
}

// ─── Compiler Agent ─────────────────────────────────────────

export async function compilerAgent(
  extractionResult: ExtractionResult,
  schema: SchemaColumn[],
  context: LLMCallContext = {},
): Promise<Record<string, unknown>[]> {
  if (extractionResult.rows.length === 0) return [];

  const systemPrompt = `You are a data compilation specialist. Your task is to clean and standardize extracted survey data.
Ensure all values conform to their declared types. Fix formatting issues. Return a valid JSON array.`;

  const userContent = `SCHEMA:
${JSON.stringify(schema, null, 2)}

RAW EXTRACTED DATA:
${JSON.stringify(extractionResult.rows, null, 2)}

Clean and standardize this data. Ensure:
- Numbers are actual numbers (not strings)
- Dates are in ISO format
- Categories are consistent
- Null for missing values

Return ONLY the cleaned JSON array.`;

  const result = await callLLM(systemPrompt, userContent, 4096, {
    ...context,
    agentName: "Compiler",
    operation: "clean-and-standardize-data",
    metadata: {
      rowCount: extractionResult.rows.length,
      schemaColumnCount: schema.length,
      ...context.metadata,
    },
  });

  return parseJsonFromResponse<Record<string, unknown>[]>(
    result,
    extractionResult.rows,
  );
}

// ─── Analyst Agent ──────────────────────────────────────────

export async function analystAgent(
  compiledData: Record<string, unknown>[],
  schema: SchemaColumn[],
  options: {
    includeStatistics?: boolean;
    includeSentiment?: boolean;
    includeThemes?: boolean;
    customPrompt?: string | null;
  },
  context: LLMCallContext = {},
): Promise<Record<string, unknown>> {
  if (compiledData.length === 0) {
    return {
      summary: "No data available for analysis.",
      recordCount: 0,
      statistics: {},
      themes: [],
      sentiment: {},
      recommendations: [],
    };
  }

  const systemPrompt = `You are a data analyst specializing in survey analysis.
Analyze the provided survey data and return comprehensive insights as a JSON object.`;

  const userContent = `SCHEMA:
${JSON.stringify(schema, null, 2)}

SURVEY DATA (${compiledData.length} records):
${JSON.stringify(compiledData.slice(0, 50), null, 2)}

ANALYSIS OPTIONS:
${JSON.stringify(
  {
    includeStatistics: options.includeStatistics ?? true,
    includeSentiment: options.includeSentiment ?? true,
    includeThemes: options.includeThemes ?? true,
    customPrompt: options.customPrompt ?? null,
  },
  null,
  2,
)}

Analyze this data and return a JSON object with:
{
  "summary": "Executive summary paragraph",
  "recordCount": ${compiledData.length},
  "statistics": {},
  "categoryBreakdown": {},
  "themes": ["theme1", "theme2"],
  "sentiment": { "positive": 0, "neutral": 0, "negative": 0 },
  "recommendations": ["recommendation1"],
  "keyFindings": ["finding1"]
}

Return ONLY the JSON object.`;

  const result = await callLLM(systemPrompt, userContent, 4096, {
    ...context,
    agentName: "Analyst",
    operation: "analyze-survey-data",
    metadata: {
      rowCount: compiledData.length,
      schemaColumnCount: schema.length,
      includeStatistics: options.includeStatistics ?? true,
      includeSentiment: options.includeSentiment ?? true,
      includeThemes: options.includeThemes ?? true,
      hasCustomPrompt: Boolean(options.customPrompt),
      ...context.metadata,
    },
  });

  return parseJsonFromResponse<Record<string, unknown>>(result, {
    summary: result,
    recordCount: compiledData.length,
    statistics: {},
    themes: [],
    sentiment: {},
    recommendations: [],
    keyFindings: [],
  });
}

// ─── Reporter Agent ─────────────────────────────────────────

export async function reporterAgent(
  analysisData: Record<string, unknown>,
  projectName: string,
  reportName: string,
  context: LLMCallContext = {},
): Promise<string> {
  const systemPrompt = `You are a professional report writer for government institutions.
Write formal, structured reports based on survey analysis data. Use proper Indonesian government report style.
Do not invent numeric values. If verified metrics are provided, use them exactly as-is.`;

  const userContent = `PROJECT: ${projectName}
REPORT: ${reportName}

ANALYSIS DATA:
${JSON.stringify(analysisData, null, 2)}

Write a complete formal survey report in Indonesian language with these sections:
1. PENDAHULUAN
2. METODOLOGI
3. HASIL DAN PEMBAHASAN
4. KESIMPULAN
5. REKOMENDASI

If "verifiedFacts" exists in the analysis data, prioritize those exact numbers and wording.`;

  return callLLM(systemPrompt, userContent, 4096, {
    ...context,
    agentName: "Reporter",
    operation: "generate-report-content",
    metadata: {
      projectName,
      reportName,
      hasVerifiedFacts: Boolean(analysisData.verifiedFacts),
      ...context.metadata,
    },
  });
}

// ─── ChatBot Agent ──────────────────────────────────────────

export async function chatbotAgent(
  question: string,
  surveyData: Record<string, unknown>[],
  schema: SchemaColumn[],
  chatHistory: { role: string; content: string }[],
  context: LLMCallContext = {},
): Promise<{
  answer: string;
  sources: { fileName: string; excerpt: string }[];
}> {
  const dataContext =
    surveyData.length > 0
      ? `SURVEY DATA SUMMARY (${surveyData.length} records):
Schema columns: ${schema.map((c) => c.name).join(", ")}
Sample records: ${JSON.stringify(surveyData.slice(0, 10), null, 2)}`
      : "No survey data has been processed yet.";

  const systemPrompt = `You are RisetBot ChatBot, an AI assistant that helps users understand their survey data.
You have access to survey data and can answer questions about it.
Always cite specific data points when possible. Be concise but informative.
Respond in the same language as the user's question.

${dataContext}`;

  const historyText = chatHistory
    .slice(-10)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const userContent = `CHAT HISTORY:
${historyText || "-"}

QUESTION:
${question}

Answer clearly and ground the answer in the available survey data.`;

  const answer = await callLLM(systemPrompt, userContent, 2048, {
    ...context,
    agentName: "ChatBot",
    operation: "answer-question",
    metadata: {
      questionLength: question.length,
      surveyRecordCount: surveyData.length,
      schemaColumnCount: schema.length,
      historyMessageCount: chatHistory.length,
      ...context.metadata,
    },
  });

  const sources =
    surveyData.length > 0
      ? [
          {
            fileName: "Data Survey Tersimpan",
            excerpt: `Analisis berdasarkan ${surveyData.length} record survey`,
          },
        ]
      : [];

  return { answer, sources };
}

// ─── Auto-Generate Schema Agent ─────────────────────────────

export async function autoGenerateSchemaAgent(
  sampleText: string,
  surveyType?: string | null,
  context: LLMCallContext = {},
): Promise<{
  suggestedName: string;
  suggestedDescription: string;
  columns: SchemaColumn[];
}> {
  const systemPrompt = `You are a data schema designer specializing in survey data structures.
Analyze survey text and suggest an appropriate data schema with relevant columns.`;

  const userContent = `${surveyType ? `Survey Type: ${surveyType}\n` : ""}
Sample Survey Text:
${sampleText.substring(0, 4000)}

Analyze this survey and suggest a schema. Return ONLY this JSON:
{
  "suggestedName": "Schema name (in Indonesian)",
  "suggestedDescription": "Brief description (in Indonesian)",
  "columns": [
    {
      "name": "Column name",
      "type": "text|number|date|category|boolean",
      "aiGuidance": "How AI should extract this field",
      "required": true|false
    }
  ]
}`;

  const result = await callLLM(systemPrompt, userContent, 2048, {
    ...context,
    agentName: "SchemaDesigner",
    operation: "auto-generate-schema",
    metadata: {
      surveyType: surveyType ?? null,
      sampleLength: sampleText.length,
      ...context.metadata,
    },
  });

  return parseJsonFromResponse(result, {
    suggestedName: "Schema Baru",
    suggestedDescription: "Schema yang dihasilkan dari contoh survey",
    columns: [
      {
        name: "Responden",
        type: "text" as const,
        aiGuidance: "Nama responden",
        required: true,
      },
      {
        name: "Tanggal",
        type: "date" as const,
        aiGuidance: "Tanggal pengisian",
        required: false,
      },
      {
        name: "Komentar",
        type: "text" as const,
        aiGuidance: "Komentar/masukan responden",
        required: false,
      },
    ],
  });
}
