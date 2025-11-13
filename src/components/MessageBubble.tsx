/**
 * Presentational bubble used inside the chat list. Keeps alignment, colors, and
 * timestamp formatting in one place so the parent just maps over messages.
 */
import { Mic } from 'lucide-react';
import type { Message } from "@/types/chat";

interface MessageBubbleProps {
  message: Message;
  isDarkMode?: boolean;
}

export function MessageBubble({ message, isDarkMode }: MessageBubbleProps) {
  const isUser = message.type === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : isDarkMode
            ? 'bg-slate-800 text-white border border-slate-700 rounded-bl-sm'
            : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'
        }`}
      >
        {message.isVoice && (
          <div className="flex items-center gap-1 mb-1 opacity-75">
            <Mic className="w-3 h-3" />
            <span className="text-xs">Voice message</span>
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isUser ? 'text-blue-100' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
