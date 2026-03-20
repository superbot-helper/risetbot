import { useState, useRef, useEffect } from 'react';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { useChatStream } from '@/hooks/use-sse';
import { useGetChatHistory, useListKnowledge } from '@/services/api';
import {
  Send,
  Bot,
  User,
  FileText,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Chat({ projectId }: { projectId: string }) {
  const { data: history } = useGetChatHistory(projectId);
  const { data: knowledgeFiles } = useListKnowledge(projectId);
  const { messages: streamMessages, sendMessage, isStreaming } =
    useChatStream(projectId);
  const [input, setInput] = useState('');
  const [showSourceFilter, setShowSourceFilter] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const allMessages = [...(history || []), ...streamMessages];

  /** Auto-scroll on new messages. */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  /** Toggle a knowledge source selection. */
  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  /** Select / deselect all sources. */
  const toggleAll = () => {
    if (!knowledgeFiles) return;
    if (selectedSources.length === knowledgeFiles.length) {
      setSelectedSources([]);
    } else {
      setSelectedSources(knowledgeFiles.map((f) => f.id));
    }
  };

  /** Only processed (done) files are selectable. */
  const processedFiles =
    knowledgeFiles?.filter((f) => f.status === 'done') || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input, selectedSources);
    setInput('');
  };

  return (
    <ProjectLayout projectId={projectId}>
      <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-primary to-blue-400 rounded-full flex items-center justify-center text-white shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-gray-900">
                Survey Data Assistant
              </h3>
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Online
              </p>
            </div>
          </div>

          {/* Knowledge source filter toggle */}
          <button
            onClick={() => setShowSourceFilter(!showSourceFilter)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              selectedSources.length > 0
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
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

        {/* Knowledge Source Filter Panel */}
        <AnimatePresence>
          {showSourceFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-b border-gray-100"
            >
              <div className="p-3 bg-gray-50/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Filter by Knowledge Source
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedSources.length === processedFiles.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {processedFiles.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">
                      No processed documents available
                    </span>
                  ) : (
                    processedFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => toggleSource(file.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                          selectedSources.includes(file.id)
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
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

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
          {allMessages.length === 0 && !isStreaming ? (
            <WelcomeScreen onSuggestion={setInput} />
          ) : (
            allMessages.map((msg, i) => (
              <ChatMessage key={msg.id || i} message={msg} isStreaming={isStreaming && i === allMessages.length - 1 && msg.role === 'assistant'} />
            ))
          )}
          <div ref={endRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100">
          <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the assistant..."
              className="w-full bg-gray-50 border border-gray-200 rounded-full pl-5 pr-14 py-3.5 outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-[15px]"
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
            <span className="text-[10px] text-gray-400 font-medium">
              AI generated responses may be inaccurate. Verify important
              information.
            </span>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
}


/**
 * Welcome screen with suggestion chips.
 */
function WelcomeScreen({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void;
}) {
  const suggestions = [
    'Berapa persentase kepuasan pelanggan?',
    'Ringkas keluhan utama dari responden',
    'Temukan tren dari jawaban survey',
    'Bandingkan skor layanan antar aspek',
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400">
      <div className="w-16 h-16 bg-gradient-to-tr from-primary/20 to-blue-300/20 rounded-2xl flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-primary/60" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">
        Ask your survey data
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        Ask anything about your processed survey documents.
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm hover:border-primary hover:text-primary transition-all shadow-sm hover:shadow"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}


/**
 * Individual chat message with inline source citations.
 */
function ChatMessage({
  message,
  isStreaming,
}: {
  message: any;
  isStreaming: boolean;
}) {
  const isUser = message.role === 'user';
  const text = message.message || '';
  const sources = message.sources || [];

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
          isUser ? 'bg-gray-800 text-white' : 'bg-primary text-white'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
      >
        <div
          className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
            isUser
              ? 'bg-gray-800 text-white rounded-tr-sm'
              : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
          }`}
        >
          {text || (isStreaming ? <TypingIndicator /> : '')}
        </div>

        {/* Inline source citations — Perplexity style */}
        {sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sources.map((s: any, idx: number) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-sm hover:border-primary/30 hover:text-primary transition-colors cursor-default"
                title={`${s.fileName || s.file_name}, Page ${s.page}`}
              >
                <FileText className="w-3 h-3 text-primary" />
                <span className="max-w-[100px] truncate font-medium">
                  {s.fileName || s.file_name}
                </span>
                {s.page && (
                  <span className="text-gray-400 ml-0.5">p.{s.page}</span>
                )}
                <ExternalLink className="w-2.5 h-2.5 text-gray-400 ml-0.5" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * Animated typing indicator (●●● pulse).
 */
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 bg-primary/40 rounded-full"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}
