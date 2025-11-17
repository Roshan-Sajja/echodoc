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

export interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  isVoice?: boolean;
  preview?: string;
  totalChars?: number;
}
