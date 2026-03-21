import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import { useChatStream } from "@/hooks/use-sse";
import { useToast } from "@/hooks/use-toast";
import { useGetChatHistory, useListKnowledge } from "@/services/api";
import { sanitizeUserText } from "@/lib/utils";
import {
  Send,
  Bot,
  User,
  FileText,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Chat({ projectId }: { projectId: string }) {
  const { data: history } = useGetChatHistory(projectId);
  const { data: knowledgeFiles } = useListKnowledge(projectId);
  const {
    messages: streamMessages,
    sendMessage,
    isStreaming,
    error,
    clearError,
  } = useChatStream(projectId);
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const [showSourceFilter, setShowSourceFilter] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const allMessages = useMemo(
    () => [...(history || []), ...streamMessages],
    [history, streamMessages],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  useEffect(() => {
    if (!error) return;

    toast({
      title: "Chat stream error",
      description: error,
      variant: "destructive",
    });

    clearError();
  }, [error, clearError, toast]);

  const processedFiles =
    knowledgeFiles?.filter((file) => file.status === "done") || [];

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id)
        ? prev.filter((sourceId) => sourceId !== id)
        : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (processedFiles.length === 0) return;

    if (selectedSources.length === processedFiles.length) {
      setSelectedSources([]);
      return;
    }

    setSelectedSources(processedFiles.map((file) => file.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isStreaming) return;

    const sanitizedInput = sanitizeUserText(input, 4000);
    if (!sanitizedInput) {
      toast({
        title: "Pesan kosong",
        description: "Masukkan pertanyaan terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    sendMessage(sanitizedInput, selectedSources);
    setInput("");
  };

  return (
    <ProjectLayout projectId={projectId}>
      <div className="flex flex-col h-[calc(100vh-8rem)] bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-secondary/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-primary to-blue-400 rounded-full flex items-center justify-center text-white shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                Survey Data Assistant
              </h3>
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Online
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSourceFilter((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              selectedSources.length > 0
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-card text-muted-foreground border-border hover:border-border/80"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Sources
            {selectedSources.length > 0 && (
              <span className="bg-primary text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">
                {selectedSources.length}
              </span>
            )}
            {showSourceFilter ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>

        <AnimatePresence>
          {showSourceFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-b border-border"
            >
              <div className="p-3 bg-secondary/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Filter by Knowledge Source
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedSources.length === processedFiles.length &&
                    processedFiles.length > 0
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {processedFiles.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      No processed documents available
                    </span>
                  ) : (
                    processedFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => toggleSource(file.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                          selectedSources.includes(file.id)
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-card text-muted-foreground border-border hover:border-border/80"
                        }`}
                      >
                        <FileText className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">
                          {file.fileName}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
          {allMessages.length === 0 && !isStreaming ? (
            <WelcomeScreen onSuggestion={setInput} />
          ) : (
            allMessages.map((msg, index) => (
              <ChatMessage
                key={msg.id || index}
                message={msg}
                isStreaming={
                  isStreaming &&
                  index === allMessages.length - 1 &&
                  msg.role === "assistant"
                }
              />
            ))
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 bg-card border-t border-border">
          <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the assistant..."
              className="w-full bg-secondary/50 border border-border rounded-full pl-5 pr-14 py-3.5 outline-none focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-[15px] text-foreground"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 disabled:bg-gray-300 transition-all shadow-md"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>

          <div className="text-center mt-3">
            <span className="text-[10px] text-muted-foreground font-medium">
              AI generated responses may be inaccurate. Verify important
              information.
            </span>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
}

function WelcomeScreen({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void;
}) {
  const suggestions = [
    "Berapa persentase kepuasan pelanggan?",
    "Ringkas keluhan utama dari responden",
    "Temukan tren dari jawaban survey",
    "Bandingkan skor layanan antar aspek",
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
      <div className="w-16 h-16 bg-gradient-to-tr from-primary/20 to-blue-300/20 rounded-2xl flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-primary/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Ask your survey data
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Ask anything about your processed survey documents.
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestion(suggestion)}
            className="px-4 py-2 bg-card border border-border rounded-full text-sm hover:border-primary hover:text-primary transition-all shadow-sm hover:shadow"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  isStreaming,
}: {
  message: any;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const text = message.message || "";
  const sources = message.sources || [];

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
          isUser ? "bg-foreground text-background" : "bg-primary text-white"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div
        className={`max-w-[80%] flex flex-col ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
            isUser
              ? "bg-foreground text-background rounded-tr-sm"
              : "bg-card border border-border text-foreground rounded-tl-sm"
          }`}
        >
          {text || (isStreaming ? <TypingIndicator /> : "")}
        </div>

        {sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sources.map((source: any, index: number) => (
              <div
                key={index}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-md shadow-sm hover:border-primary/30 hover:text-primary transition-colors cursor-default"
                title={`${source.fileName || source.file_name}, Page ${source.page || "-"}`}
              >
                <FileText className="w-3 h-3 text-primary" />
                <span className="max-w-[100px] truncate font-medium">
                  {source.fileName || source.file_name}
                </span>
                {source.page && (
                  <span className="text-muted-foreground ml-0.5">p.{source.page}</span>
                )}
                <ExternalLink className="w-2.5 h-2.5 text-muted-foreground ml-0.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="w-2 h-2 bg-primary/40 rounded-full"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: index * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}
