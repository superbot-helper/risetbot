/**
 * ChatBot Agent — Handles conversational Q&A over survey data.
 * Connects to Python service PageIndex RAG for reasoning-based retrieval.
 * Falls back to LLM-only chatbot when Python service is unavailable.
 * Adds:
 * - source filtering by selected knowledge IDs
 * - observability/latency tracking per agent run
 */
import { buildRAGIndex, queryRAG } from "../lib/pythonService.js";
import {
  chatbotAgent as llmChatbotAgent,
  type SchemaColumn,
} from "../lib/agents.js";
import { queryRows } from "../lib/db.js";
import { trackAgentRun, type TraceContext } from "../lib/observability.js";
import { logger } from "../lib/logger.js";
import path from "path";

export interface ChatbotQueryOptions extends TraceContext {
  sourceIds?: string[];
}

type ChatbotSource = {
  file_name: string;
  page?: number;
  excerpt?: string;
};

type OCRPage = {
  page_number: number;
  text: string;
  char_count: number;
};

type RAGDocument = {
  file_name: string;
  text: string;
  pages: OCRPage[];
  doc_id?: string;
};

function normalizeSourceIds(sourceIds?: string[]): string[] {
  if (!Array.isArray(sourceIds)) return [];
  return sourceIds
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, 100);
}

function normalizePages(pages: unknown): OCRPage[] {
  if (!Array.isArray(pages)) return [];
  return pages
    .map((page) => ({
      page_number: Number((page as any)?.page_number || 0),
      text: String((page as any)?.text || ""),
      char_count: Number((page as any)?.char_count || 0),
    }))
    .filter((page) => page.page_number > 0 && page.text.trim().length > 0);
}

function inferDocId(filePath?: string): string {
  if (!filePath || typeof filePath !== "string") return "";
  return path.parse(filePath).name.trim();
}

/**
 * Query the chatbot for a project's survey data.
 * Priority: Python RAG service → LLM context fallback.
 *
 * @param question - User's question.
 * @param projectId - Project UUID for data retrieval.
 * @param chatHistory - Previous conversation messages.
 * @param options - Optional source filters and observability context.
 * @returns Answer with sources.
 */
export async function queryChatbot(
  question: string,
  projectId: string,
  chatHistory?: Array<{ role: string; content: string }>,
  options: ChatbotQueryOptions = {},
): Promise<{ answer: string; sources: ChatbotSource[] }> {
  const normalizedSourceIds = normalizeSourceIds(options.sourceIds);

  return trackAgentRun(
    {
      agentName: "ChatBot",
      operation: "query-chatbot",
      projectId: options.projectId ?? projectId,
      traceId: options.traceId,
      sessionId: options.sessionId,
      userId: options.userId,
      input: {
        questionLength: question.length,
        sourceFilterCount: normalizedSourceIds.length,
        historyCount: chatHistory?.length ?? 0,
      },
      metadata: {
        hasSourceFilter: normalizedSourceIds.length > 0,
        sourceIds: normalizedSourceIds,
      },
    },
    async (context: TraceContext) => {
      logger.info(
        {
          projectId,
          traceId: context.traceId,
          questionLength: question.length,
          sourceFilterCount: normalizedSourceIds.length,
        },
        "ChatBot: Processing query",
      );

      // Fetch processed knowledge for this project
      const processedFiles = await queryRows(
        "SELECT * FROM knowledge WHERE project_id = $1 AND status = 'done'",
        [projectId],
      );

      const filteredFiles =
        normalizedSourceIds.length > 0
          ? processedFiles.filter((file: any) =>
              normalizedSourceIds.includes(String(file.id)),
            )
          : processedFiles;

      logger.info(
        {
          projectId,
          traceId: context.traceId,
          processedFileCount: processedFiles.length,
          filteredFileCount: filteredFiles.length,
        },
        "ChatBot: Knowledge sources prepared",
      );

      // Build document list for RAG, including page-level OCR metadata when available.
      const documents: RAGDocument[] = [];
      for (const file of filteredFiles as any[]) {
        const extracted =
          file.extracted_data && typeof file.extracted_data === "object"
            ? file.extracted_data
            : {};

        const pages = normalizePages((extracted as any).pages);
        const storedRagDocId = String((extracted as any)?.rag?.docId || "").trim();
        let docId = storedRagDocId;

        if (!docId) {
          docId = inferDocId(file.file_path);
        }

        if (
          !storedRagDocId &&
          pages.length === 0 &&
          typeof file.file_path === "string" &&
          file.file_path
        ) {
          try {
            const indexResult = await buildRAGIndex(file.file_path);
            docId = indexResult.doc_id;
          } catch (error) {
            logger.warn(
              {
                traceId: context.traceId,
                fileName: file.file_name,
                error: error instanceof Error ? error.message : String(error),
              },
              "ChatBot: Lazy RAG index build failed, continuing with context fallback",
            );
          }
        }

        const rawText =
          typeof (extracted as any).rawText === "string"
            ? (extracted as any).rawText
            : "";
        const rowsText = JSON.stringify((extracted as any).rows || []);
        const text = rawText.trim().length > 0 ? rawText : rowsText;

        if (!text.trim() && pages.length === 0) {
          continue;
        }

        documents.push({
          file_name: file.file_name,
          text,
          pages,
          doc_id: docId || undefined,
        });
      }

      // Try Python RAG service first
      try {
        const ragResult = await queryRAG(question, documents, chatHistory);

        if (ragResult.answer && ragResult.confidence > 0.3) {
          logger.info(
            {
              traceId: context.traceId,
              confidence: ragResult.confidence,
              sourceCount: ragResult.sources.length,
            },
            "ChatBot: RAG response generated via Python service",
          );

          return {
            answer: ragResult.answer,
            sources: ragResult.sources.map((source) => ({
              file_name: source.file_name,
              page: source.page,
            })),
          };
        }

        logger.warn(
          {
            traceId: context.traceId,
            confidence: ragResult.confidence,
            sourceCount: ragResult.sources.length,
          },
          "ChatBot: RAG response confidence too low, using LLM fallback",
        );
      } catch (error) {
        logger.warn(
          {
            traceId: context.traceId,
            error: error instanceof Error ? error.message : String(error),
          },
          "ChatBot: Python RAG unavailable, using LLM fallback",
        );
      }

      // Fallback: LLM-only chatbot
      const surveyData: Record<string, unknown>[] = [];
      for (const file of filteredFiles) {
        const data = file.extracted_data as any;
        if (data?.rows) {
          surveyData.push(
            ...data.rows.map((row: any) => ({
              ...row,
              _source: file.file_name,
            })),
          );
        }
      }

      const schemas = await queryRows(
        "SELECT columns FROM schemas WHERE project_id = $1",
        [projectId],
      );

      const schema: SchemaColumn[] =
        schemas.length > 0
          ? (((schemas[0] as any).columns as SchemaColumn[]) ?? [])
          : [];

      const history = (chatHistory || []).map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const llmResult = await llmChatbotAgent(
        question,
        surveyData,
        schema,
        history,
        {
          projectId: options.projectId ?? projectId,
          traceId: context.traceId,
          observationId: context.observationId,
          sessionId: options.sessionId,
          userId: options.userId,
          metadata: {
            sourceFilterCount: normalizedSourceIds.length,
            surveyRecordCount: surveyData.length,
            schemaColumnCount: schema.length,
          },
        },
      );

      logger.info(
        {
          traceId: context.traceId,
          surveyRecordCount: surveyData.length,
          sourceCount: llmResult.sources.length,
        },
        "ChatBot: LLM fallback response generated",
      );

      return {
        answer: llmResult.answer,
        sources: llmResult.sources.map((source) => ({
          file_name: source.fileName,
          excerpt: source.excerpt,
        })),
      };
    },
  );
}
