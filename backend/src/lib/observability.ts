import { Langfuse } from "langfuse";
import { query, queryOne } from "./db.js";
import { logger } from "./logger.js";

type JsonRecord = Record<string, unknown>;

export interface TraceContext {
  projectId?: string | null;
  traceId?: string;
  observationId?: string;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  metadata?: JsonRecord;
}

export interface AgentRunOptions extends TraceContext {
  agentName: string;
  operation: string;
  input?: JsonRecord;
  metadata?: JsonRecord;
}

export interface LLMUsageOptions extends TraceContext {
  agentName: string;
  model: string;
  provider?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requestPayload?: JsonRecord;
  responsePayload?: JsonRecord;
  success?: boolean;
  errorMessage?: string | null;
}

interface TraceHandle {
  traceId: string;
  update: (payload?: JsonRecord) => void;
}

interface ObservationHandle {
  observationId: string;
  traceId: string;
  update: (payload?: JsonRecord) => void;
  end: (payload?: JsonRecord) => void;
}

let langfuseClient: Langfuse | null | undefined;

function hasLangfuseCredentials(): boolean {
  return Boolean(
    process.env.LANGFUSE_PUBLIC_KEY &&
      process.env.LANGFUSE_SECRET_KEY &&
      process.env.LANGFUSE_BASE_URL,
  );
}

function safeJson(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonRecord;
}

function truncateText(value: string, maxLength = 1000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function summarizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return truncateText(value, 1000);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      sample: value.slice(0, 3).map((item) => summarizeValue(item)),
    };
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj).slice(0, 12);
    return Object.fromEntries(
      entries.map(([key, item]) => [key, summarizeValue(item)]),
    );
  }

  return String(value);
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return truncateText(error.message, 2000);
  }
  return truncateText(String(error), 2000);
}

function getLangfuseClient(): Langfuse | null {
  if (langfuseClient !== undefined) {
    return langfuseClient;
  }

  if (!hasLangfuseCredentials()) {
    langfuseClient = null;
    logger.info(
      "Langfuse observability disabled because credentials are not configured",
    );
    return langfuseClient;
  }

  langfuseClient = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    baseUrl: process.env.LANGFUSE_BASE_URL!,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.APP_VERSION,
  });

  logger.info("Langfuse observability enabled");
  return langfuseClient;
}

function safeTracePayload(
  name: string,
  context: TraceContext,
  extra?: JsonRecord,
): JsonRecord {
  return {
    id: context.traceId,
    name,
    sessionId: context.sessionId,
    userId: context.userId,
    tags: context.tags,
    metadata: {
      projectId: context.projectId ?? null,
      ...safeJson(context.metadata),
      ...safeJson(extra),
    },
  };
}

export function isLangfuseEnabled(): boolean {
  return hasLangfuseCredentials();
}

export function startWorkflowTrace(
  name: string,
  context: TraceContext = {},
): TraceHandle | null {
  const client = getLangfuseClient();
  if (!client) return null;

  try {
    const trace = client.trace(safeTracePayload(name, context) as any);

    return {
      traceId: trace.id,
      update: (payload?: JsonRecord) => {
        try {
          trace.update({
            metadata: {
              projectId: context.projectId ?? null,
              ...safeJson(context.metadata),
              ...safeJson(payload),
            },
          } as any);
        } catch (error) {
          logger.warn(
            { error: summarizeError(error), name },
            "Failed to update Langfuse trace",
          );
        }
      },
    };
  } catch (error) {
    logger.warn(
      { error: summarizeError(error), name },
      "Failed to start Langfuse trace",
    );
    return null;
  }
}

export function startAgentObservation(
  name: string,
  context: TraceContext = {},
  input?: JsonRecord,
  metadata?: JsonRecord,
): ObservationHandle | null {
  const client = getLangfuseClient();
  if (!client) return null;

  try {
    const span = client.span({
      traceId: context.traceId,
      name,
      input: summarizeValue(input),
      metadata: {
        projectId: context.projectId ?? null,
        parentObservationId: context.observationId ?? null,
        ...safeJson(context.metadata),
        ...safeJson(metadata),
      },
    } as any);

    return {
      observationId: span.id,
      traceId: span.traceId,
      update: (payload?: JsonRecord) => {
        try {
          span.update({
            metadata: {
              projectId: context.projectId ?? null,
              ...safeJson(metadata),
              ...safeJson(payload),
            },
          } as any);
        } catch (error) {
          logger.warn(
            { error: summarizeError(error), name },
            "Failed to update Langfuse span",
          );
        }
      },
      end: (payload?: JsonRecord) => {
        try {
          span.end({
            output: summarizeValue(payload),
          } as any);
        } catch (error) {
          logger.warn(
            { error: summarizeError(error), name },
            "Failed to end Langfuse span",
          );
        }
      },
    };
  } catch (error) {
    logger.warn(
      { error: summarizeError(error), name },
      "Failed to start Langfuse span",
    );
    return null;
  }
}

export function startGenerationObservation(
  name: string,
  context: TraceContext & { model?: string },
  input?: JsonRecord,
  metadata?: JsonRecord,
): ObservationHandle | null {
  const client = getLangfuseClient();
  if (!client) return null;

  try {
    const generation = client.generation({
      traceId: context.traceId,
      name,
      model: context.model,
      input: summarizeValue(input),
      metadata: {
        projectId: context.projectId ?? null,
        parentObservationId: context.observationId ?? null,
        ...safeJson(context.metadata),
        ...safeJson(metadata),
      },
    } as any);

    return {
      observationId: generation.id,
      traceId: generation.traceId,
      update: (payload?: JsonRecord) => {
        try {
          generation.update({
            metadata: {
              projectId: context.projectId ?? null,
              ...safeJson(metadata),
              ...safeJson(payload),
            },
          } as any);
        } catch (error) {
          logger.warn(
            { error: summarizeError(error), name },
            "Failed to update Langfuse generation",
          );
        }
      },
      end: (payload?: JsonRecord) => {
        try {
          generation.end({
            output: summarizeValue(payload),
          } as any);
        } catch (error) {
          logger.warn(
            { error: summarizeError(error), name },
            "Failed to end Langfuse generation",
          );
        }
      },
    };
  } catch (error) {
    logger.warn(
      { error: summarizeError(error), name },
      "Failed to start Langfuse generation",
    );
    return null;
  }
}

export async function trackAgentRun<T>(
  options: AgentRunOptions,
  task: (context: TraceContext) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const observation = startAgentObservation(
    `${options.agentName}.${options.operation}`,
    options,
    safeJson(options.input),
    safeJson(options.metadata),
  );

  const record = await queryOne<{ id: string }>(
    `
      INSERT INTO agent_runs (
        project_id,
        trace_id,
        observation_id,
        agent_name,
        operation,
        status,
        input_payload,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, 'running', $6, $7)
      RETURNING id
    `,
    [
      options.projectId ?? null,
      observation?.traceId ?? options.traceId ?? null,
      observation?.observationId ?? options.observationId ?? null,
      options.agentName,
      options.operation,
      options.input ? JSON.stringify(options.input) : null,
      options.metadata ? JSON.stringify(options.metadata) : null,
    ],
  );

  const childContext: TraceContext = {
    ...options,
    traceId: observation?.traceId ?? options.traceId,
    observationId: observation?.observationId ?? options.observationId,
  };

  try {
    const result = await task(childContext);
    const latencyMs = Date.now() - startedAt;
    const outputSummary = summarizeValue(result);

    await query(
      `
        UPDATE agent_runs
        SET
          status = 'success',
          latency_ms = $2,
          output_summary = $3,
          completed_at = NOW()
        WHERE id = $1
      `,
      [record?.id ?? null, latencyMs, JSON.stringify(outputSummary)],
    );

    observation?.end({
      status: "success",
      latencyMs,
      outputSummary: safeJson(outputSummary) ?? { value: outputSummary },
    });

    logger.info(
      {
        agentName: options.agentName,
        operation: options.operation,
        latencyMs,
        traceId: childContext.traceId,
      },
      "Agent run completed",
    );

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = summarizeError(error);

    await query(
      `
        UPDATE agent_runs
        SET
          status = 'error',
          latency_ms = $2,
          error_message = $3,
          completed_at = NOW()
        WHERE id = $1
      `,
      [record?.id ?? null, latencyMs, errorMessage],
    );

    observation?.end({
      status: "error",
      latencyMs,
      error: errorMessage,
    });

    logger.error(
      {
        agentName: options.agentName,
        operation: options.operation,
        latencyMs,
        traceId: childContext.traceId,
        error: errorMessage,
      },
      "Agent run failed",
    );

    throw error;
  }
}

export async function recordLLMUsage(
  options: LLMUsageOptions,
): Promise<void> {
  try {
    await query(
      `
        INSERT INTO llm_request_log (
          project_id,
          trace_id,
          observation_id,
          agent_name,
          model,
          provider,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          latency_ms,
          success,
          request_payload,
          response_payload,
          error_message
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
      `,
      [
        options.projectId ?? null,
        options.traceId ?? null,
        options.observationId ?? null,
        options.agentName,
        options.model,
        options.provider ?? "openai-compatible",
        options.promptTokens ?? 0,
        options.completionTokens ?? 0,
        options.totalTokens ?? 0,
        options.latencyMs ?? null,
        options.success ?? true,
        options.requestPayload
          ? JSON.stringify(summarizeValue(options.requestPayload))
          : null,
        options.responsePayload
          ? JSON.stringify(summarizeValue(options.responsePayload))
          : null,
        options.errorMessage ?? null,
      ],
    );
  } catch (error) {
    logger.warn(
      { error: summarizeError(error), model: options.model },
      "Failed to persist LLM usage log",
    );
  }
}

export async function flushObservability(): Promise<void> {
  const client = getLangfuseClient();
  if (!client) return;

  try {
    await client.flushAsync();
  } catch (error) {
    logger.warn(
      { error: summarizeError(error) },
      "Failed to flush Langfuse events",
    );
  }
}
