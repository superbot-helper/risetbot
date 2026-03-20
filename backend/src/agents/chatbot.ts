/**
 * ChatBot Agent — Handles conversational Q&A over survey data.
 * Connects to Python service PageIndex RAG for reasoning-based retrieval.
 * Falls back to LLM-only chatbot when Python service is unavailable.
 */
import { queryRAG, type RAGResult } from '../lib/pythonService.js';
import { chatbotAgent as llmChatbotAgent, type SchemaColumn } from '../lib/agents.js';
import { queryRows } from '../lib/db.js';
import { logger } from '../lib/logger.js';

/**
 * Query the chatbot for a project's survey data.
 * Priority: Python RAG service → LLM context fallback.
 *
 * @param question - User's question.
 * @param projectId - Project UUID for data retrieval.
 * @param chatHistory - Previous conversation messages.
 * @returns Answer with sources.
 */
export async function queryChatbot(
  question: string,
  projectId: string,
  chatHistory?: Array<{ role: string; content: string }>
): Promise<{ answer: string; sources: Array<{ file_name: string; page?: number; excerpt?: string }> }> {
  logger.info(
    { projectId, questionLength: question.length },
    'ChatBot: Processing query'
  );

  // Fetch processed knowledge for this project
  const processedFiles = await queryRows(
    "SELECT * FROM knowledge WHERE project_id = $1 AND status = 'done'",
    [projectId]
  );

  // Build document list for RAG
  const documents = processedFiles
    .filter((f: any) => f.extracted_data?.rawText || f.extracted_data?.rows)
    .map((f: any) => ({
      file_name: f.file_name,
      text: f.extracted_data?.rawText || JSON.stringify(f.extracted_data?.rows || []),
      pages: [],
    }));

  // Try Python RAG service first
  try {
    const ragResult = await queryRAG(question, documents, chatHistory);

    if (ragResult.answer && ragResult.confidence > 0.3) {
      logger.info(
        { confidence: ragResult.confidence, sourceCount: ragResult.sources.length },
        'ChatBot: RAG response generated via Python service'
      );

      return {
        answer: ragResult.answer,
        sources: ragResult.sources.map((s) => ({
          file_name: s.file_name,
          page: s.page,
        })),
      };
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'ChatBot: Python RAG unavailable, using LLM fallback'
    );
  }

  // Fallback: LLM-only chatbot
  const surveyData: Record<string, unknown>[] = [];
  for (const file of processedFiles) {
    const data = file.extracted_data as any;
    if (data?.rows) {
      surveyData.push(
        ...data.rows.map((r: any) => ({ ...r, _source: file.file_name }))
      );
    }
  }

  const schemas = await queryRows(
    'SELECT columns FROM schemas WHERE project_id = $1',
    [projectId]
  );
  const schema: SchemaColumn[] = schemas.length > 0
    ? ((schemas[0] as any).columns as SchemaColumn[]) ?? []
    : [];

  const history = (chatHistory || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const llmResult = await llmChatbotAgent(question, surveyData, schema, history);

  logger.info('ChatBot: LLM fallback response generated');

  return {
    answer: llmResult.answer,
    sources: llmResult.sources.map((s) => ({
      file_name: s.fileName,
      excerpt: s.excerpt,
    })),
  };
}
