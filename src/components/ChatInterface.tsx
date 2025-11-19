// src/components/ChatInterface.tsx
/**
 * Chat UI that sits beside the upload flow. Owns the text box, the voice mode,
 * and the scrolling message list while delegating the actual assistant logic
 * back up to the page component.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Mic } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from './MessageBubble';
import type { UploadedContent, ChatMessage } from "@/types/chat";
import { VoiceChat } from "./VoiceChat";
import { RealtimeCallButton, RealtimeCallHandle } from "./RealtimeCallButton";
import { useRealtimeTextSession } from "@/hooks/useRealtimeTextSession";
import { AnimatePresence, motion } from "framer-motion";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  activeContent: UploadedContent | null;
  onSendMessage: (message: ChatMessage) => void | Promise<void>;
  onBackToUpload: () => void;
  isDarkMode?: boolean;
  contextId: string | null;
}

const normalizeForComparison = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim()
    .toLowerCase();

const isSameText = (a: string, b: string) =>
  !!a && !!b && normalizeForComparison(a) === normalizeForComparison(b);

const stripTextLabel = (value: string) =>
  value.replace(/^Text\s*:\s*/i, "").trim();

const PLEASANTRY_PATTERNS = [
  /^(?:hi|hey|hello)(?: there)?$/i,
  /^greetings$/i,
  /^howdy$/i,
  /^good (?:morning|afternoon|evening)$/i,
  /^(?:thanks|thank you)(?: (?:so|very) much)?$/i,
  /^appreciate (?:it|you)$/i,
  /^(?:sure(?: thing)?|absolutely|of course)$/i,
  /^happy to help$/i,
  /^you'?re welcome$/i,
  /^no problem$/i,
  /^anytime$/i,
  /^take care$/i,
  /^bye(?: bye)?$/i,
];

const isShortPleasantry = (value: string) => {
  if (!value) return false;
  const normalized = normalizeForComparison(value)
    .replace(/[.!?]/g, "")
    .trim();
  if (!normalized) return false;
  if (normalized.length > 80) return false;
  const words = normalized.split(/\s+/);
  if (words.length > 6) return false;
  return PLEASANTRY_PATTERNS.some((pattern) => pattern.test(normalized));
};

const stripTextLabelDuplication = (value: string) => {
  const marker = /(\n+|^)\s*(?:---\s*)?Text\s*:\s*/i;
  const match = marker.exec(value);
  if (!match) return value;
  const first = value.slice(0, match.index).trim();
  const second = stripTextLabel(
    value.slice(match.index + match[0].length).trim(),
  );
  if (!first || !second) return value;
  return isSameText(first, second) ? first : value;
};

const stripDividerDuplication = (value: string) => {
  const segments = value.split(/\n+\s*---\s*\n+/);
  if (segments.length < 2) return value;

  const cleaned: string[] = [];
  let removedSomething = false;

  for (const segment of segments) {
    const trimmed = stripTextLabel(segment.trim());
    if (!trimmed) {
      removedSomething = true;
      continue;
    }

    const duplicateOfExisting = cleaned.some((existing) => isSameText(existing, trimmed));
    if (duplicateOfExisting || isShortPleasantry(trimmed)) {
      removedSomething = true;
      continue;
    }

    cleaned.push(trimmed);
  }

  if (!removedSomething) {
    return value;
  }

  if (!cleaned.length) {
    const firstNonEmpty = segments.map((segment) => segment.trim()).find(Boolean);
    return firstNonEmpty ?? "";
  }

  return cleaned.join("\n\n---\n\n");
};

const stripRepeatedParagraphs = (value: string) => {
  const segments = value.split(/\n{2,}/);
  if (segments.length < 2) return value;

  const cleaned: string[] = [];
  let removed = false;

  for (const segment of segments) {
    const trimmed = stripTextLabel(segment.trim());
    if (!trimmed) {
      removed = true;
      continue;
    }

    // Only drop if exactly same as previous meaningful paragraph
    const last = cleaned[cleaned.length - 1];
    if (last && isSameText(last, trimmed)) {
      removed = true;
      continue;
    }

    cleaned.push(trimmed);
  }

  return removed ? cleaned.join("\n\n") : value;
};

const stripEmDashDuplication = (value: string) => {
  if (!value.includes("—")) return value;
  const parts = value.split(/\s+—\s+/);
  if (parts.length !== 2) return value;
  const left = stripTextLabel(parts[0].trim());
  const right = stripTextLabel(parts[1].trim());
  if (!left || !right) return value;
  return isSameText(left, right) ? left : value;
};

const stripDuplicatedAssistantEcho = (text: string) =>
  stripEmDashDuplication(
    stripRepeatedParagraphs(
      stripDividerDuplication(stripTextLabelDuplication(text)),
    ),
  );

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
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const callRef = useRef<RealtimeCallHandle | null>(null);
  const [isRealtimeInCall, setIsRealtimeInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => messages);
  const [pendingAssistantText, setPendingAssistantText] = useState("");
  const [textSessionError, setTextSessionError] = useState<string | null>(null);

  const isMicMuted = () => {
    const callMuted = callRef.current?.isMuted?.();
    return typeof callMuted === "boolean" ? callMuted : isMuted;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    setChatMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const additions = messages.filter((m) => !existingIds.has(m.id));
      if (additions.length) {
        return [...prev, ...additions];
      }
      return prev;
    });
  }, [messages]);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setChatMessages((prev) => [...prev, msg]);
    onSendMessage(msg);
  }, [onSendMessage]);

  const handleAssistantDeltaUpdate = useCallback((text: string) => {
    const cleaned = stripDuplicatedAssistantEcho(text);
    setPendingAssistantText(cleaned);
  }, []);

  const handleAssistantCompletion = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const cleaned = stripDuplicatedAssistantEcho(trimmed);
    if (!cleaned) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-assistant`,
      role: "assistant",
      text: cleaned,
      createdAt: new Date(),
      wasStreamed: true,
    };
    pushMessage(msg);
    setPendingAssistantText("");
  }, [pushMessage]);

  const {
    isReady: isTextReady,
    isConnecting: isTextConnecting,
    error: realtimeTextError,
    sendTextMessage,
    isResponding,
  } =
    useRealtimeTextSession({
      contextId,
      onAssistantDelta: handleAssistantDeltaUpdate,
      onAssistantDone: handleAssistantCompletion,
    });

  useEffect(() => {
    if (realtimeTextError) {
      setTextSessionError(realtimeTextError);
    }
  }, [realtimeTextError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const chatMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: trimmed,
      createdAt: new Date(),
    };
    pushMessage(chatMsg);
    setInputValue('');

    try {
      await sendTextMessage(trimmed);
      setTextSessionError(null);
    } catch (err: any) {
      console.error("[ChatInterface] sendTextMessage failed", err);
      setTextSessionError(
        err?.message || "Failed to reach the assistant. Please try again."
      );
    }
  };

  const handleVoiceConversation = (userText: string) => {
    if (isMicMuted()) return; // ignore local voice transcripts while muted
    const chatMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: userText,
      isVoice: true,
      createdAt: new Date(),
    };
    pushMessage(chatMsg);
  };

  const isChatAvailable = Boolean(contextId);
  const isSendDisabled =
    !inputValue.trim() || !isChatAvailable || !isTextReady || isResponding;

  return (
    <div className="flex-1 flex flex-col h-full font-[var(--font-roboto)]">
      {/* Chat Header */}
      <div
        className={`border-b px-4 py-3 flex items-center gap-3 sticky top-17.5 z-10 backdrop-blur-md ${
          isDarkMode
            ? "bg-neutral-900/80 border-white/10"
            : "bg-white/80 border-white/50"
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
        {chatMessages.length === 0 ? (
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
            {chatMessages.map((message) => (
              <MessageBubble key={message.id} message={message} isDarkMode={isDarkMode} />
            ))}
            {pendingAssistantText && (
              <MessageBubble
                message={{
                  id: "pending-assistant",
                  role: "assistant",
                  text: pendingAssistantText,
                  createdAt: new Date(),
                }}
                isDarkMode={isDarkMode}
              />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div
        className={`border-t p-4 sticky bottom-0 z-10 ${
          isDarkMode ? "bg-neutral-900 border-neutral-700" : "bg-white border-slate-200"
        }`}
      >
        <AnimatePresence initial={false} mode="wait">
          {isVoiceChatActive ? (
            <motion.div
              key="voice-chat"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <VoiceChat
                onConversationUpdate={handleVoiceConversation}
                onClose={() => setIsVoiceChatActive(false)}
                isDarkMode={isDarkMode}
                onStartCall={async () => {
                  setPendingAssistantText("");
                  if (callRef.current) await callRef.current.start();
                }}
                onEndCall={() => {
                  callRef.current?.stop();
                  setIsVoiceChatActive(false);
                  setIsRealtimeInCall(false);
                  const finalText = stripDuplicatedAssistantEcho(
                    pendingAssistantText.trim(),
                  );
                  if (finalText) {
                    const msg: ChatMessage = {
                      id: `${Date.now()}-assistant`,
                      role: "assistant",
                      text: finalText,
                      createdAt: new Date(),
                      wasStreamed: true,
                    };
                    pushMessage(msg);
                  }
                  setPendingAssistantText("");
                }}
                onToggleMute={(mute) => {
                  setIsMuted(mute);
                  if (mute) callRef.current?.mute();
                  else callRef.current?.unmute();
                }}
                isCallActive={isRealtimeInCall}
                isMuted={isMuted}
                modelTranscript={pendingAssistantText}
              />
            </motion.div>
          ) : (
            <motion.div
              key="text-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col gap-3"
            >
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Type your message..."
                  value={inputValue}
                  disabled={!isChatAvailable}
                  onChange={(e) => setInputValue(e.target.value)}
                  className={`w-full ${
                    isDarkMode
                      ? "bg-neutral-800 border-neutral-600 text-white placeholder:text-slate-500"
                      : ""
                  }`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant={isVoiceChatActive ? "default" : "outline"}
                  onClick={() => setIsVoiceChatActive(true)}
                >
                  <Mic className="w-4 h-4" />
                </Button>
                <Button type="submit" size="icon" disabled={isSendDisabled}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              {isTextConnecting && isChatAvailable && (
                <p className="text-xs text-slate-500">Connecting to realtime chat…</p>
              )}
              {!isChatAvailable && (
                <p className="text-xs text-slate-500">
                  Upload a document or video to start chatting.
                </p>
              )}
              {textSessionError && (
                <p className="text-xs text-red-500">{textSessionError}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Hidden realtime call control to drive OpenAI audio while using the full-screen overlay */}
      <div className="hidden">
        <RealtimeCallButton
          ref={callRef}
          contextId={contextId}
          isDarkMode={isDarkMode}
          onCallChange={setIsRealtimeInCall}
          onAssistantDelta={setPendingAssistantText}
          onAssistantDone={handleAssistantCompletion}
          onUserFinal={(text) => {
            const msg: ChatMessage = {
              id: `${Date.now()}-user`,
              role: "user",
              text: text.trim(),
              isVoice: true,
              createdAt: new Date(),
            };
            pushMessage(msg);
            // Clear any pending assistant text so the next assistant turn starts clean
            setPendingAssistantText("");
          }}
        />
      </div>
    </div>
  );
}
