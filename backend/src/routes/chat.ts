import { Router, type IRouter } from "express";
import { queryRows, queryOne, query } from "../lib/db.js";
import { SendChatMessageBody } from "../lib/validators.js";
import { queryChatbot } from "../agents/chatbot.js";
import { logActivity } from "../lib/activity.js";
import { logger } from "../lib/logger.js";
import { sanitizeChatMessage, sanitizeStringArray } from "../lib/sanitize.js";
import { startWorkflowTrace } from "../lib/observability.js";

const router: IRouter = Router({ mergeParams: true });

type ChatHistoryRow = {
  id: string;
  project_id: string;
  role: string;
  message: string;
  sources: unknown;
  created_at: string;
};

function serializeMessage(message: ChatHistoryRow) {
  return {
    id: message.id,
    projectId: message.project_id,
    role: message.role,
    message: message.message,
    sources: Array.isArray(message.sources) ? message.sources : [],
    createdAt: message.created_at,
  };
}

/**
 * GET /api/projects/:projectId/chat
 */
router.get("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;

  const messages = await queryRows<ChatHistoryRow>(
    `
      SELECT *
      FROM chat_history
      WHERE project_id = $1
      ORDER BY created_at ASC
    `,
    [projectId],
  );

  res.json(messages.map(serializeMessage));
});

/**
 * POST /api/projects/:projectId/chat
 */
router.post("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;
  const body = SendChatMessageBody.parse(req.body);

  const message = sanitizeChatMessage(body.message, 4000);
  const sourceIds = sanitizeStringArray(body.sourceIds ?? [], 100, 64);

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  // Save user message
  await query(
    `
      INSERT INTO chat_history (project_id, role, message)
      VALUES ($1, $2, $3)
    `,
    [projectId, "user", message],
  );

  await logActivity(
    projectId,
    "chat",
    `Pertanyaan baru: "${message.substring(0, 80)}${message.length > 80 ? "..." : ""}"`,
  );

  const trace = startWorkflowTrace("Chat Query", {
    projectId,
    metadata: {
      sourceFilterCount: sourceIds.length,
    },
  });

  // SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const history = await queryRows<{ role: string; message: string }>(
      `
        SELECT role, message
        FROM chat_history
        WHERE project_id = $1
        ORDER BY created_at ASC
      `,
      [projectId],
    );

    const chatHistoryFormatted = history.slice(-20).map((item) => ({
      role: item.role,
      content: item.message,
    }));

    res.write(
      `data: ${JSON.stringify({
        type: "thinking",
        content:
          sourceIds.length > 0
            ? "Sedang menganalisis sumber knowledge terpilih..."
            : "Sedang menganalisis data...",
      })}\n\n`,
    );

    const { answer, sources } = await queryChatbot(
      message,
      projectId,
      chatHistoryFormatted,
      {
        projectId,
        traceId: trace?.traceId,
        sourceIds,
      },
    );

    for (const chunk of answer.split("")) {
      res.write(
        `data: ${JSON.stringify({ type: "content", content: chunk })}\n\n`,
      );
    }

    await query(
      `
        INSERT INTO chat_history (project_id, role, message, sources)
        VALUES ($1, $2, $3, $4)
      `,
      [
        projectId,
        "assistant",
        answer,
        sources.length > 0 ? JSON.stringify(sources) : null,
      ],
    );

    trace?.update({
      status: "done",
      sourceFilterCount: sourceIds.length,
      sourceCount: sources.length,
      answerLength: answer.length,
    });

    res.write(`data: ${JSON.stringify({ type: "done", sources })}\n\n`);
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Chat failed";

    trace?.update({
      status: "error",
      error: errorMessage,
    });

    logger.error(
      {
        projectId,
        traceId: trace?.traceId,
        error: errorMessage,
      },
      "Chat failed",
    );

    res.write(
      `data: ${JSON.stringify({
        type: "error",
        content: `Error: ${errorMessage}`,
      })}\n\n`,
    );
    res.end();
  }
});

/**
 * DELETE /api/projects/:projectId/chat
 */
router.delete("/", async (req, res) => {
  const projectId = (req.params as { projectId: string }).projectId;

  await query("DELETE FROM chat_history WHERE project_id = $1", [projectId]);

  res.json({ success: true, message: "Chat history cleared" });
});

export default router;
