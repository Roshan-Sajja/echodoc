/**
 * Presentational bubble used inside the chat list. Keeps alignment, colors, and
 * timestamp formatting in one place so the parent just maps over messages.
 */
import { useState } from 'react';
import { Mic } from 'lucide-react';
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  isDarkMode?: boolean;
}

export function MessageBubble({ message, isDarkMode }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasPreview = Boolean(message.preview);
  const previewLength = message.preview?.length ?? 0;
  const [expanded, setExpanded] = useState(false);
  const textItalic = message.isVoice ? "italic" : "";
  const voiceLabelClasses = `${isDarkMode ? 'text-slate-300' : 'text-slate-600'} text-xs flex items-center gap-1 ${
    isUser ? 'self-end justify-end' : 'self-start justify-start'
  }`;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] flex flex-col gap-2 ${
          isUser ? 'items-end text-right' : 'items-start text-left'
        }`}
      >
        {message.isVoice && (
          <div className={voiceLabelClasses}>
            <Mic className="w-4 h-4" />
          </div>
        )}
        {isUser ? (
          <div className="bg-neutral-700 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm">
            <p className={`whitespace-pre-wrap break-words leading-relaxed ${textItalic}`}>
              {message.isVoice ? `“${message.text}”` : message.text}
            </p>
          </div>
        ) : (
          <p
            className={`whitespace-pre-wrap break-words leading-relaxed ${
              isDarkMode ? 'text-slate-100' : 'text-slate-900'
            } ${textItalic}`}
          >
            {message.isVoice ? `“${message.text}”` : message.text}
          </p>
        )}
        {hasPreview && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <p
                className={`text-[11px] uppercase tracking-wide font-semibold ${
                  isUser ? 'text-neutral-200' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Preview
                {previewLength
                  ? ` · first ${previewLength.toLocaleString()} chars`
                  : ''}
                {message.totalChars ? ` · ${message.totalChars.toLocaleString()} total` : ''}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className={`text-xs font-semibold ${
                  isUser ? 'text-white hover:text-neutral-100' : 'text-slate-700 hover:text-slate-900'
                }`}
                aria-label={expanded ? 'Hide preview' : 'Show preview'}
              >
                {expanded ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="relative">
              <div
                className={`rounded-xl border text-sm leading-relaxed ${
                  isDarkMode
                    ? 'bg-slate-900/60 border-slate-700 text-slate-200'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                } ${expanded ? 'max-h-80' : 'max-h-32'} overflow-auto`}
              >
                <pre className="whitespace-pre-wrap font-mono text-[13px] p-3">
                  {message.preview}
                </pre>
              </div>
              {!expanded && previewLength > 300 && (
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-xl ${
                    isDarkMode
                      ? 'bg-gradient-to-t from-slate-900/90 to-transparent'
                      : 'bg-gradient-to-t from-slate-50 to-transparent'
                  }`}
                />
              )}
            </div>
            {message.totalChars && message.totalChars > previewLength && (
              <p
                className={`text-[11px] ${
                  isUser ? 'text-neutral-200/90' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Full text is loaded for chat; showing a short preview here.
              </p>
            )}
          </div>
        )}
        <p
          className={`text-xs mt-1 ${
            isUser
              ? isDarkMode
                ? 'text-neutral-200'
                : 'text-slate-500'
              : isDarkMode
                ? 'text-slate-400'
                : 'text-slate-500'
          }`}
        >
          {message.createdAt.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
