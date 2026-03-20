import { useState, useRef, useEffect } from "react";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import { useChatStream } from "@/hooks/use-sse";
import { useGetChatHistory } from '@/services/api';
import { Send, Bot, User, FileText } from "lucide-react";

export default function Chat({ projectId }: { projectId: string }) {
  const { data: history } = useGetChatHistory(projectId);
  const { messages: streamMessages, sendMessage, isStreaming } = useChatStream(projectId);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const allMessages = [...(history || []), ...streamMessages];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length, streamMessages.map(m => m.message).join('')]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
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
              <h3 className="font-semibold text-sm text-gray-900">Survey Data Assistant</h3>
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online
              </p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
          {allMessages.length === 0 && !isStreaming ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Bot className="w-12 h-12 mb-4 opacity-50" />
              <p>Ask anything about your processed survey data.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
                <button onClick={() => setInput("Berapa persentase kepuasan?")} className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm hover:border-primary hover:text-primary transition-colors shadow-sm">Berapa persentase kepuasan?</button>
                <button onClick={() => setInput("Ringkas keluhan utama")} className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm hover:border-primary hover:text-primary transition-colors shadow-sm">Ringkas keluhan utama</button>
              </div>
            </div>
          ) : (
            allMessages.map((msg, i) => (
              <div key={msg.id || i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-gray-800 text-white' : 'bg-primary text-white'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-gray-800 text-white rounded-tr-sm' 
                      : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    {msg.message || (isStreaming && msg.role === 'assistant' ? <span className="animate-pulse">● ● ●</span> : '')}
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.sources.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm">
                          <FileText className="w-3 h-3 text-primary" /> {s.fileName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
              onChange={e => setInput(e.target.value)}
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
            <span className="text-[10px] text-gray-400 font-medium">AI generated responses may be inaccurate. Verify important information.</span>
          </div>
        </div>

      </div>
    </ProjectLayout>
  );
}
