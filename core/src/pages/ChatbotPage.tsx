import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, Copy, Check, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { sendChatMessage, ChatMessage } from '../services/chat.ts';
import { MarkdownContent } from '../components/chat/MarkdownContent.tsx';
import { Button } from '../components/ui/Button.tsx';

interface ChatbotPageProps {
  userId?: string | number | null;
  userName?: string | null;
}

const QUICK_PROMPTS = [
  'How can i apply for these scholarships',
  'What documents are required for Bihar SC/ST scholarship?',
  'Which scholarships have deadlines this month?',
  'Explain income threshold criteria for NSP',
];

export const ChatbotPage: React.FC<ChatbotPageProps> = ({
  userId = '2679645e-6978-4156-82d4-03311dc254ae',
  userName = 'Scholar',
}) => {
  const effectiveUserId = String(userId || '2679645e-6978-4156-82d4-03311dc254ae');

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-welcome',
        sender: 'assistant',
        content: `Hello ${userName || 'Scholar'}! I am your ScholarPilot AI Advisor.\n\nI can guide you step-by-step through applying for your eligible scholarships, explain government rules, list required certificates, and track deadlines.\n\nTry asking me **"How can i apply for these scholarships"** or pick a question below!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rawViewIds, setRawViewIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (messageToSend?: string) => {
    const text = (messageToSend ?? input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(effectiveUserId, text);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        content: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        content: `Sorry, I encountered an issue connecting to the advisor engine. Please try again in a moment. (${err.message || 'Network error'})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const toggleRawView = (id: string) => {
    setRawViewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'msg-welcome-reset',
        sender: 'assistant',
        content: `Chat history cleared. What would you like to ask next, ${userName || 'Scholar'}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-140px)]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 pb-6 border-b border-[#E9E1D3]">
        <div>
          <div className="inline-flex items-center gap-2 mb-1.5">
            <span className="font-script text-2xl text-[#E8622C] font-bold transform -rotate-1">
              AI Scholarship Advisor ✦
            </span>
            <span className="text-xs bg-[#EDF8F3] text-[#1F5A45] font-bold px-2.5 py-0.5 rounded-full border border-[#2F8F6B]/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2F8F6B] animate-pulse" />
              Connected
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-tight">
            ScholarPilot Chatbot
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#5E5A52]">
            Ask questions about application procedures, official portal deadlines, and required certificates.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearHistory}
            className="text-xs text-[#5E5A52] hover:text-[#1A1A1A] px-3 py-1.5 rounded-lg border border-[#E9E1D3] bg-[#FFFDF8] hover:bg-[#FBF6EE] transition-colors cursor-pointer"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Suggested Quick Question Chips */}
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-[#5E5A52] block mb-2">
          Suggested Questions
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSend(prompt)}
              className="text-xs sm:text-sm px-3.5 py-1.5 rounded-full bg-[#FFFDF8] border border-[#E9E1D3] text-[#1A1A1A] hover:border-[#1F5A45] hover:bg-[#EDF8F3] hover:text-[#1F5A45] transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              {prompt} ↗
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 space-y-6 pb-6">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isRaw = rawViewIds.has(msg.id);

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 sm:gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar Icon */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs mt-1 ${
                  isUser
                    ? 'bg-[#1F5A45] text-white'
                    : 'bg-[#F8E4E0] text-[#E8622C] border border-[#E8622C]/30'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
              </div>

              {/* Message Bubble Card */}
              <div className={`max-w-[88%] sm:max-w-[80%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Header info */}
                <div className={`flex items-center gap-2 text-[11px] text-[#5E5A52] px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span className="font-semibold text-[#1A1A1A]">{isUser ? 'You' : 'ScholarPilot AI'}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`p-4 sm:p-6 rounded-2xl shadow-xs transition-all ${
                    isUser
                      ? 'bg-[#1A1A1A] text-white rounded-tr-xs'
                      : 'paper-card bg-[#FFFDF8] rounded-tl-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : isRaw ? (
                    <pre className="text-xs bg-[#FBF6EE] p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono text-[#333]">
                      {msg.content}
                    </pre>
                  ) : (
                    <MarkdownContent content={msg.content} />
                  )}
                </div>

                {/* Assistant Action Strip (Copy / Raw Toggle) */}
                {!isUser && (
                  <div className="flex items-center gap-3 px-1 pt-1 text-xs text-[#5E5A52]">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.id, msg.content)}
                      className="inline-flex items-center gap-1 hover:text-[#1F5A45] transition-colors cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2F8F6B]" />
                          <span className="text-[#2F8F6B] font-semibold">Copied to clipboard</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Response</span>
                        </>
                      )}
                    </button>

                    <span>•</span>

                    <button
                      type="button"
                      onClick={() => toggleRawView(msg.id)}
                      className="hover:text-[#1F5A45] transition-colors cursor-pointer"
                    >
                      {isRaw ? 'Show Formatted UI' : 'View Raw Markdown'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading / Generating State Bubble */}
        {isLoading && (
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-9 h-9 rounded-full bg-[#F8E4E0] text-[#E8622C] border border-[#E8622C]/30 flex items-center justify-center shrink-0 shadow-xs mt-1">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>

            <div className="paper-card bg-[#FFFDF8] p-4 sm:p-5 rounded-2xl rounded-tl-xs max-w-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1F5A45]">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Advisor is synthesizing eligibility steps...</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="w-2 h-2 rounded-full bg-[#1F5A45] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#1F5A45] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#1F5A45] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar pinned to bottom */}
      <div className="sticky bottom-4 z-20 pt-2">
        <div className="paper-card p-2 sm:p-3 shadow-lg bg-[#FFFDF8] border-2 border-[#E9E1D3] focus-within:border-[#1F5A45] transition-all">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question (e.g. 'How can i apply for these scholarships')..."
              className="flex-1 p-2 sm:p-2.5 text-sm sm:text-base bg-transparent text-[#1A1A1A] placeholder-[#5E5A52]/60 resize-none focus:outline-none leading-relaxed"
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!input.trim() || isLoading}
              className="shrink-0 mb-1"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline">Send</span>
                  <Send className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          {/* Footer note displaying payload structure */}
          <div className="px-2 pt-2 border-t border-[#E9E1D3]/50 flex items-center justify-between text-[11px] text-[#5E5A52]">
            <span className="truncate">
              Payload: <code className="font-mono text-[#1F5A45]">userId: "{effectiveUserId}"</code>
            </span>
            <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
};
