import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type ChatStreamMessage = {
  id: string;
  role: "user" | "assistant";
  message: string;
  sources?: Array<{
    fileName?: string;
    file_name?: string;
    page?: number;
    excerpt?: string;
  }>;
};

type PipelineLog = {
  agent: string;
  message: string;
  progress: number;
  type: string;
};

function parseSseEvents(chunk: string) {
  return chunk
    .split("\n\n")
    .map((event) => event.trim())
    .filter(Boolean)
    .map((event) => {
      const dataLines = event
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6));

      return dataLines.join("\n");
    })
    .filter(Boolean);
}

function buildErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function useChatStream(projectId: string) {
  const [messages, setMessages] = useState<ChatStreamMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (messageText: string, selectedSources?: string[]) => {
      const trimmed = messageText.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      setIsStreaming(true);

      const userMessageId = `${Date.now()}-user`;
      const assistantMessageId = `${Date.now()}-assistant`;

      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: "user",
          message: trimmed,
          sources: [],
        },
        {
          id: assistantMessageId,
          role: "assistant",
          message: "",
          sources: [],
        },
      ]);

      try {
        const body: Record<string, unknown> = { message: trimmed };
        if (selectedSources && selectedSources.length > 0) {
          body.sourceIds = selectedSources;
        }

        const response = await fetch(`/api/projects/${projectId}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        if (!response.body) {
          throw new Error("No response stream available");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            buffer += decoder.decode();
          } else {
            buffer += decoder.decode(value, { stream: true });
          }

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const events = parseSseEvents(part);

            for (const rawEvent of events) {
              if (!rawEvent || rawEvent === "[DONE]") continue;

              let data: {
                type?: string;
                content?: string;
                sources?: ChatStreamMessage["sources"];
              };

              try {
                data = JSON.parse(rawEvent);
              } catch {
                continue;
              }

              if (data.type === "thinking") {
                continue;
              }

              if (data.type === "error") {
                const message = data.content || "Chat stream failed";
                setError(message);
                setMessages((prev) =>
                  prev.map((item) =>
                    item.id === assistantMessageId
                      ? {
                          ...item,
                          message: item.message || message,
                        }
                      : item,
                  ),
                );
                continue;
              }

              if (typeof data.content === "string" && data.content.length > 0) {
                setMessages((prev) =>
                  prev.map((item) =>
                    item.id === assistantMessageId
                      ? {
                          ...item,
                          message: item.message + data.content,
                        }
                      : item,
                  ),
                );
              }

              if (Array.isArray(data.sources)) {
                setMessages((prev) =>
                  prev.map((item) =>
                    item.id === assistantMessageId
                      ? {
                          ...item,
                          sources: data.sources,
                        }
                      : item,
                  ),
                );
              }
            }
          }

          if (done) break;
        }

        if (buffer.trim()) {
          const events = parseSseEvents(buffer);
          for (const rawEvent of events) {
            if (!rawEvent || rawEvent === "[DONE]") continue;
            try {
              const data = JSON.parse(rawEvent) as {
                type?: string;
                content?: string;
                sources?: ChatStreamMessage["sources"];
              };

              if (data.type === "error") {
                setError(data.content || "Chat stream failed");
              }

              if (typeof data.content === "string" && data.type === "content") {
                setMessages((prev) =>
                  prev.map((item) =>
                    item.id === assistantMessageId
                      ? {
                          ...item,
                          message: item.message + data.content,
                        }
                      : item,
                  ),
                );
              }

              if (Array.isArray(data.sources)) {
                setMessages((prev) =>
                  prev.map((item) =>
                    item.id === assistantMessageId
                      ? {
                          ...item,
                          sources: data.sources,
                        }
                      : item,
                  ),
                );
              }
            } catch {
              // ignore trailing malformed chunk
            }
          }
        }
      } catch (streamError) {
        const message = buildErrorMessage(
          streamError,
          "Failed to stream chat response",
        );
        setError(message);

        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  message:
                    item.message || "Terjadi kesalahan saat memproses pesan.",
                }
              : item,
          ),
        );
      } finally {
        setIsStreaming(false);
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${projectId}/chat`],
        });
      }
    },
    [isStreaming, projectId, queryClient],
  );

  return {
    messages,
    setMessages,
    sendMessage,
    isStreaming,
    error,
    clearError: () => setError(null),
  };
}

export function usePipelineStream() {
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const runPipeline = useCallback(
    async (projectId: string, knowledgeId: string, schemaId?: string) => {
      setIsRunning(true);
      setError(null);
      setLogs([]);

      try {
        const response = await fetch(`/api/agents/process/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ projectId, knowledgeId, schemaId }),
        });

        if (!response.ok) {
          throw new Error("Failed to start pipeline");
        }

        if (!response.body) {
          throw new Error("No pipeline stream available");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            buffer += decoder.decode();
          } else {
            buffer += decoder.decode(value, { stream: true });
          }

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const events = parseSseEvents(part);

            for (const rawEvent of events) {
              if (!rawEvent || rawEvent === "[DONE]") continue;

              try {
                const data = JSON.parse(rawEvent) as PipelineLog;

                setLogs((prev) => [...prev, data]);

                if (data.type === "agent_error") {
                  setError(data.message || "Pipeline error");
                }
              } catch {
                // ignore malformed event
              }
            }
          }

          if (done) break;
        }

        if (buffer.trim()) {
          const events = parseSseEvents(buffer);
          for (const rawEvent of events) {
            if (!rawEvent || rawEvent === "[DONE]") continue;
            try {
              const data = JSON.parse(rawEvent) as PipelineLog;
              setLogs((prev) => [...prev, data]);
              if (data.type === "agent_error") {
                setError(data.message || "Pipeline error");
              }
            } catch {
              // ignore trailing malformed chunk
            }
          }
        }
      } catch (streamError) {
        const message = buildErrorMessage(
          streamError,
          "Failed to stream pipeline progress",
        );
        setError(message);

        setLogs((prev) => [
          ...prev,
          {
            agent: "Supervisor",
            message,
            progress: 100,
            type: "agent_error",
          },
        ]);
      } finally {
        setIsRunning(false);
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${projectId}/knowledge`],
        });
      }
    },
    [queryClient],
  );

  return {
    logs,
    runPipeline,
    isRunning,
    error,
    clearError: () => setError(null),
  };
}
