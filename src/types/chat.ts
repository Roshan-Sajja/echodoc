/**
 * Shared chat-related types so components and the API speak the same language.
 * Nothing fancy, just a place to keep message/content shapes in sync.
 */
export interface UploadedContent {
  id: string;
  type: "document" | "youtube";
  name: string;
  url?: string;
  file?: File;
  timestamp: Date;

  contextId?: string;
  preview?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: Date;
  isVoice?: boolean;
  preview?: string;
  totalChars?: number;
}
