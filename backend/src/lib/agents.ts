/**
 * AI Agent functions — replaces @workspace/integrations-openai-ai-server.
 * Uses OpenAI SDK directly with configurable model from .env.
 */
import OpenAI from 'openai';
import { logger } from './logger.js';

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  baseURL: process.env.LLM_BASE_URL || undefined,
});

const DEFAULT_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = Number(process.env.LLM_TEMPERATURE) || 0.7;

// ─── Types ──────────────────────────────────────────────────

export type AgentEvent =
  | { type: 'agent_start'; agent: string; message: string; progress: number }
  | { type: 'agent_complete'; agent: string; message: string; progress: number }
  | { type: 'agent_error'; agent: string; message: string; progress: number }
  | { type: 'done'; message: string; progress: number };

export interface SchemaColumn {
  name: string;
  type: 'text' | 'number' | 'date' | 'category' | 'boolean';
  aiGuidance: string;
  required?: boolean;
}

export interface ExtractionResult {
  rows: Record<string, unknown>[];
  rawText: string;
  pageCount: number;
  confidence: number;
}

// ─── LLM Call Helper ────────────────────────────────────────

async function callLLM(
  systemPrompt: string,
  userContent: string,
  maxTokens = 4096
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });
  return response.choices[0]?.message?.content ?? '';
}

/**
 * Parse JSON from LLM response — handles code fences and loose text.
 */
function parseJsonFromResponse<T>(text: string, fallback: T): T {
  try {
    // Strip code fences (```json ... ```)
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON array or object
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch { /* ignore */ }
    }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* ignore */ }
    }
  }
  return fallback;
}

// ─── Extractor Agent ────────────────────────────────────────

export async function extractorAgent(
  pdfText: string,
  schema: SchemaColumn[]
): Promise<ExtractionResult> {
  const schemaDescription = schema
    .map((col) => `- ${col.name} (${col.type}): ${col.aiGuidance}`)
    .join('\n');

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

  const result = await callLLM(systemPrompt, userContent);
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
  schema: SchemaColumn[]
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

  const result = await callLLM(systemPrompt, userContent);
  return parseJsonFromResponse<Record<string, unknown>[]>(result, extractionResult.rows);
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
  }
): Promise<Record<string, unknown>> {
  if (compiledData.length === 0) {
    return {
      summary: 'No data available for analysis.',
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

Analyze this data and return a JSON object with:
{
  "summary": "Executive summary paragraph",
  "recordCount": ${compiledData.length},
  "statistics": { /* per numeric column: min, max, avg, median */ },
  "categoryBreakdown": { /* per category column: frequency counts */ },
  "themes": ["theme1", "theme2", ...],
  "sentiment": { "positive": %, "neutral": %, "negative": % },
  "recommendations": ["recommendation1", ...],
  "keyFindings": ["finding1", "finding2", ...]
}

Return ONLY the JSON object.`;

  const result = await callLLM(systemPrompt, userContent, 4096);
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
  reportName: string
): Promise<string> {
  const systemPrompt = `You are a professional report writer for government institutions. 
Write formal, structured reports based on survey analysis data. Use proper Indonesian government report style.`;

  const userContent = `PROJECT: ${projectName}
REPORT: ${reportName}

ANALYSIS DATA:
${JSON.stringify(analysisData, null, 2)}

Write a complete formal survey report in Indonesian language with these sections:
1. PENDAHULUAN (Introduction)
2. METODOLOGI (Methodology)  
3. HASIL DAN PEMBAHASAN (Results & Discussion)
4. KESIMPULAN (Conclusion)
5. REKOMENDASI (Recommendations)

Format it professionally with proper headers and paragraphs.`;

  return await callLLM(systemPrompt, userContent, 4096);
}

// ─── ChatBot Agent ──────────────────────────────────────────

export async function chatbotAgent(
  question: string,
  surveyData: Record<string, unknown>[],
  schema: SchemaColumn[],
  chatHistory: { role: string; content: string }[]
): Promise<{ answer: string; sources: { fileName: string; excerpt: string }[] }> {
  const dataContext = surveyData.length > 0
    ? `SURVEY DATA SUMMARY (${surveyData.length} records):
Schema columns: ${schema.map((c) => c.name).join(', ')}
Sample records: ${JSON.stringify(surveyData.slice(0, 10), null, 2)}`
    : 'No survey data has been processed yet.';

  const systemPrompt = `You are RisetBot ChatBot, an AI assistant that helps users understand their survey data.
You have access to survey data and can answer questions about it.
Always cite specific data points when possible. Be concise but informative.
Respond in the same language as the user's question.

${dataContext}`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ];

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: 2048,
    messages,
  });

  const answer = response.choices[0]?.message?.content
    ?? 'Maaf, saya tidak dapat menjawab pertanyaan Anda saat ini.';

  const sources = surveyData.length > 0
    ? [{ fileName: 'Data Survey Tersimpan', excerpt: `Analisis berdasarkan ${surveyData.length} record survey` }]
    : [];

  return { answer, sources };
}

// ─── Auto-Generate Schema Agent ─────────────────────────────

export async function autoGenerateSchemaAgent(
  sampleText: string,
  surveyType?: string | null
): Promise<{ suggestedName: string; suggestedDescription: string; columns: SchemaColumn[] }> {
  const systemPrompt = `You are a data schema designer specializing in survey data structures.
Analyze survey text and suggest an appropriate data schema with relevant columns.`;

  const userContent = `${surveyType ? `Survey Type: ${surveyType}\n` : ''}
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

  const result = await callLLM(systemPrompt, userContent, 2048);
  return parseJsonFromResponse(result, {
    suggestedName: 'Schema Baru',
    suggestedDescription: 'Schema yang dihasilkan dari contoh survey',
    columns: [
      { name: 'Responden', type: 'text' as const, aiGuidance: 'Nama responden', required: true },
      { name: 'Tanggal', type: 'date' as const, aiGuidance: 'Tanggal pengisian', required: false },
      { name: 'Komentar', type: 'text' as const, aiGuidance: 'Komentar/masukan responden', required: false },
    ],
  });
}
