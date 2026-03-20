/**
 * Supervisor Agent — Orchestrates multi-agent workflow using PraisonAI.
 * Routes tasks to the appropriate agent, handles errors, and manages
 * the overall processing pipeline.
 */
import { Agent, Agents } from 'praisonai';
import { logger } from '../lib/logger.js';
import { withRetry } from '../lib/retry.js';
import { checkPythonServiceHealth } from '../lib/pythonService.js';

export type TaskType =
  | 'extract'
  | 'compile'
  | 'analyze'
  | 'report'
  | 'chat';

export interface SupervisorResult {
  success: boolean;
  taskType: TaskType;
  result: unknown;
  duration: number;
  error?: string;
}

/**
 * Route a task to the appropriate agent based on task type.
 * Validates preconditions and handles errors.
 *
 * @param taskType - Type of task to perform.
 * @param params - Task-specific parameters.
 * @returns Result from the appropriate agent.
 */
export async function routeTask(
  taskType: TaskType,
  params: Record<string, unknown>
): Promise<SupervisorResult> {
  const startTime = Date.now();

  try {
    // Pre-flight: check Python service availability for processing tasks
    if (['extract', 'analyze', 'report', 'chat'].includes(taskType)) {
      const healthy = await checkPythonServiceHealth();
      if (!healthy) {
        logger.warn('Python service unavailable, will use fallback agents');
      }
    }

    let result: unknown;

    switch (taskType) {
      case 'extract':
        result = await withRetry(
          () => executeExtraction(params),
          'Extractor Agent',
        );
        break;

      case 'compile':
        result = await withRetry(
          () => executeCompilation(params),
          'Compiler Agent',
        );
        break;

      case 'analyze':
        result = await withRetry(
          () => executeAnalysis(params),
          'Analyst Agent',
        );
        break;

      case 'report':
        result = await withRetry(
          () => executeReportGeneration(params),
          'Reporter Agent',
        );
        break;

      case 'chat':
        result = await withRetry(
          () => executeChatQuery(params),
          'ChatBot Agent',
          { maxRetries: 2 },
        );
        break;

      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }

    const duration = Date.now() - startTime;
    logger.info(
      { taskType, duration },
      `Supervisor: ${taskType} task completed in ${duration}ms`
    );

    return { success: true, taskType, result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error(
      { taskType, error: errorMsg, duration },
      `Supervisor: ${taskType} task failed after ${duration}ms`
    );

    return { success: false, taskType, result: null, duration, error: errorMsg };
  }
}

// ─── Task Executors (delegated from supervisor) ─────────────

async function executeExtraction(params: Record<string, unknown>): Promise<unknown> {
  const { extractFromPDF } = await import('./extractor.js');
  return extractFromPDF(
    params.fileContent as string,
    params.fileName as string,
    params.schema as Record<string, unknown>[],
  );
}

async function executeCompilation(params: Record<string, unknown>): Promise<unknown> {
  const { compileData } = await import('./compiler.js');
  return compileData(
    params.extractionResult as Record<string, unknown>,
    params.schema as Record<string, unknown>[],
  );
}

async function executeAnalysis(params: Record<string, unknown>): Promise<unknown> {
  const { analyzeWithPandas } = await import('./analyst.js');
  return analyzeWithPandas(
    params.data as Record<string, unknown>[],
    params.schema as Record<string, unknown>[],
    params.options as Record<string, unknown> | undefined,
  );
}

async function executeReportGeneration(params: Record<string, unknown>): Promise<unknown> {
  const { generateReport } = await import('./reporter.js');
  return generateReport(
    params.templatePath as string,
    params.analysisData as Record<string, unknown>,
    params.projectName as string,
    params.reportName as string,
  );
}

async function executeChatQuery(params: Record<string, unknown>): Promise<unknown> {
  const { queryChatbot } = await import('./chatbot.js');
  return queryChatbot(
    params.question as string,
    params.projectId as string,
    params.chatHistory as Array<{ role: string; content: string }> | undefined,
  );
}

/**
 * Create PraisonAI agents for orchestrated multi-agent pipeline.
 * Used for complex workflows that require multiple agent stages.
 */
export function createPraisonAgents(): InstanceType<typeof Agents> {
  const extractorAgent = new Agent({
    instructions: `You are a data extraction specialist. Extract structured data from survey PDF text.
Be precise and extract exactly what is in the text based on the provided schema.`,
    tools: [],
  });

  const compilerAgent = new Agent({
    instructions: `You are a data compilation specialist. Clean and standardize extracted survey data.
Ensure all values conform to their declared types. Fix formatting issues.`,
    tools: [],
  });

  const analystAgent = new Agent({
    instructions: `You are a data analyst specializing in survey analysis.
Analyze provided survey data and return comprehensive insights.`,
    tools: [],
  });

  const reporterAgent = new Agent({
    instructions: `You are a professional report writer for government institutions.
Write formal, structured reports in proper Indonesian government style.`,
    tools: [],
  });

  const chatbotAgent = new Agent({
    instructions: `You are RisetBot ChatBot, an AI assistant for understanding survey data.
Cite specific data points when possible. Be concise but informative.
Respond in the same language as the user's question.`,
    tools: [],
  });

  return new Agents([
    extractorAgent,
    compilerAgent,
    analystAgent,
    reporterAgent,
    chatbotAgent,
  ]);
}
