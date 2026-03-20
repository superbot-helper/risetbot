import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useChatStream(projectId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (messageText: string, selectedSources?: string[]) => {
      setIsStreaming(true);
      
      // Optimistically add user message
      setMessages(prev => [...prev, { role: "user", message: messageText, id: Date.now().toString() }]);
      
      // Add empty assistant message to be filled
      const assistantMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { role: "assistant", message: "", id: assistantMessageId, sources: [] }]);

      try {
        const body: Record<string, any> = { message: messageText };
        if (selectedSources && selectedSources.length > 0) {
          body.sourceIds = selectedSources;
        }

        const response = await fetch(`/api/projects/${projectId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error("Failed to send message");
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          
          buffer = lines.pop() || ""; // Keep the last incomplete chunk in the buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6);
              if (dataStr === "[DONE]") continue;
              
              try {
                const data = JSON.parse(dataStr);
                if (data.content) {
                  setMessages(prev => 
                    prev.map(m => 
                      m.id === assistantMessageId 
                        ? { ...m, message: m.message + data.content } 
                        : m
                    )
                  );
                }
                // Capture citation sources from stream
                if (data.sources) {
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, sources: data.sources }
                        : m
                    )
                  );
                }
              } catch (e) {
                console.error("Failed to parse SSE data", e);
              }
            }
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
      } finally {
        setIsStreaming(false);
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/chat`] });
      }
    },
    [projectId, queryClient]
  );

  return { messages, setMessages, sendMessage, isStreaming };
}

export function usePipelineStream() {
  const [logs, setLogs] = useState<{agent: string, message: string, progress: number, type: string}[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  const runPipeline = useCallback(async (projectId: string, knowledgeId: string, schemaId?: string) => {
    setIsRunning(true);
    setLogs([]);

    try {
      const response = await fetch(`/api/agents/process/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, knowledgeId, schemaId }),
      });

      if (!response.ok) throw new Error("Failed to start pipeline");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              setLogs(prev => [...prev, data]);
            } catch (e) {
              console.error("Failed to parse Pipeline SSE", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Pipeline error:", error);
    } finally {
      setIsRunning(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/knowledge`] });
    }
  }, [queryClient]);

  return { logs, runPipeline, isRunning };
}
