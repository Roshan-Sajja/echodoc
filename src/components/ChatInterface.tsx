// src/components/ChatInterface.tsx
/**
 * Chat UI that sits beside the upload flow. Owns the text box, the voice mode,
 * and the scrolling message list while delegating the actual assistant logic
 * back up to the page component.
 */
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Mic, X, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from './MessageBubble';
import { RealtimeCallButton } from "./RealtimeCallButton";
import { AudioVisualizer } from "./AudioVisualizer";
import type { Message, UploadedContent } from "@/types/chat";

interface ChatInterfaceProps {
  messages: Message[];
  activeContent: UploadedContent | null;
  onSendMessage: (content: string, isVoice?: boolean) => void;
  onBackToUpload: () => void;
  isDarkMode?: boolean;
  contextId: string | null;
}

export function ChatInterface({
  messages,
  activeContent,
  onSendMessage,
  onBackToUpload,
  isDarkMode,
  contextId,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isInCall, setIsInCall] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue, false);
      setInputValue('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div
        className={`border-b px-4 py-3 flex items-center gap-3 ${
          isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-slate-200'
        }`}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToUpload}
          className={`p-2 ${
            isDarkMode ? 'text-white hover:text-white hover:bg-neutral-800' : ''
          }`}
        >
          <ArrowLeft className={`w-5 h-5 ${isDarkMode ? 'text-white' : ''}`} />
        </Button>
        <div className="flex-1 min-w-0">
          <h2
            className={`truncate ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            {activeContent?.name || 'Chat'}
          </h2>
          <p
            className={`text-xs ${
              isDarkMode ? 'text-slate-500' : 'text-slate-500'
            }`}
          >
            {activeContent?.type === 'document' ? 'Document' : 'YouTube Video'}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDarkMode ? 'bg-neutral-700' : 'bg-slate-200'
              }`}
            >
              <Mic className={`w-8 h-8 ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`} />
            </div>
            <h3
              className={`mb-2 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Start a conversation
            </h3>
            <p
              className={`text-sm ${
                isDarkMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Ask questions using voice or text
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} isDarkMode={isDarkMode} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div
        className={`border-t p-4 ${
          isDarkMode ? "bg-neutral-900 border-neutral-700" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col gap-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={`w-full ${
                isDarkMode
                  ? "bg-neutral-800 border-neutral-600 text-white placeholder:text-slate-500"
                  : ""
              }`}
            />
            <RealtimeCallButton
              contextId={contextId}
              isDarkMode={isDarkMode}
              onCallChange={setIsInCall}
            />
            <Button type="submit" size="icon" disabled={!inputValue.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>

          <div
            className={`items-center gap-3 ${
              isInCall ? "flex" : "hidden"
            }`}
          >
            <div
              className={`flex items-center gap-3 flex-1 rounded-full px-4 py-2 ${
                isDarkMode
                  ? "bg-neutral-800 border border-neutral-700"
                  : "bg-slate-50 border border-slate-200"
              }`}
            >
              <AudioVisualizer isActive={true} isDarkMode={isDarkMode} />
              <span
                className={`text-xs ${
                  isDarkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                Live voice chat in progress
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
