// src/components/ChatInterface.tsx
/**
 * Chat UI that sits beside the upload flow. Owns the text box, the voice mode,
 * and the scrolling message list while delegating the actual assistant logic
 * back up to the page component.
 */
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Mic } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from './MessageBubble';
import type { UploadedContent, ChatMessage } from "@/types/chat";
import { VoiceChat } from "./VoiceChat";
import { RealtimeCallButton, RealtimeCallHandle } from "./RealtimeCallButton";

interface ChatInterfaceProps {
  messages: ChatMessage[];
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
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const callRef = useRef<RealtimeCallHandle | null>(null);
  const [isRealtimeInCall, setIsRealtimeInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => messages);
  const [pendingAssistantText, setPendingAssistantText] = useState("");

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
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue, false);
      const chatMsg: ChatMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: inputValue.trim(),
        createdAt: new Date(),
      };
      setChatMessages((prev) => [...prev, chatMsg]);
      setInputValue('');
    }
  };

  const handleVoiceConversation = (userText: string) => {
    if (isMicMuted()) return; // ignore local voice transcripts while muted
    console.log("[ChatInterface] handleVoiceConversation add message", { userText, muted: isMuted });
    const chatMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: userText,
      isVoice: true,
      createdAt: new Date(),
    };
    setChatMessages((prev) => [...prev, chatMsg]);
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
        className={`border-t p-4 ${
          isDarkMode ? "bg-neutral-900 border-neutral-700" : "bg-white border-slate-200"
        }`}
      >
        {isVoiceChatActive ? (
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
              if (pendingAssistantText.trim()) {
                const msg: ChatMessage = {
                  id: `${Date.now()}-assistant`,
                  role: "assistant",
                  text: pendingAssistantText.trim(),
                  createdAt: new Date(),
                };
                setChatMessages((prev) => [...prev, msg]);
              }
              setPendingAssistantText("");
            }}
          onToggleMute={(mute) => {
            console.log("[ChatInterface] onToggleMute", { mute });
            setIsMuted(mute);
            if (mute) callRef.current?.mute();
            else callRef.current?.unmute();
            }}
            isCallActive={isRealtimeInCall}
            isMuted={isMuted}
            modelTranscript={pendingAssistantText}
          />
        ) : (
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
              <Button
                type="button"
                size="icon"
                variant={isVoiceChatActive ? "default" : "outline"}
                onClick={() => setIsVoiceChatActive(true)}
              >
                <Mic className="w-4 h-4" />
              </Button>
              <Button type="submit" size="icon" disabled={!inputValue.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </div>
      {/* Hidden realtime call control to drive OpenAI audio while using the full-screen overlay */}
      <div className="hidden">
        <RealtimeCallButton
          ref={callRef}
          contextId={contextId}
          isDarkMode={isDarkMode}
          onCallChange={setIsRealtimeInCall}
          onAssistantDelta={setPendingAssistantText}
          onAssistantDone={(text) => {
            if (!text.trim()) return;
            const msg: ChatMessage = {
              id: `${Date.now()}-assistant`,
              role: "assistant",
              text: text.trim(),
              createdAt: new Date(),
            };
            setChatMessages((prev) => [...prev, msg]);
            setPendingAssistantText("");
          }}
          onUserFinal={(text) => {
            console.log("[ChatInterface] onUserFinal received", { text });
            // RealtimeCallButton already filters muted turns before firing this callback
            console.log("[ChatInterface] onUserFinal adding message to chat", { text });
            const msg: ChatMessage = {
              id: `${Date.now()}-user`,
              role: "user",
              text: text.trim(),
              isVoice: true,
              createdAt: new Date(),
            };
            setChatMessages((prev) => [...prev, msg]);
            // Clear any pending assistant text so the next assistant turn starts clean
            setPendingAssistantText("");
          }}
        />
      </div>
    </div>
  );
}
