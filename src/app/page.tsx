"use client";

/*
 * Home page for the playground. Handles the main document/video upload flow,
 * keeps local message state, and flips between the upload wizard and the chat
 * screen. If you can explain this file, you can explain the entire app.
 */
import { useState } from "react";
import type { UploadedContent, Message } from "@/types/chat";
import { FileText, Youtube, MessageSquare } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DocumentUpload } from "@/components/DocumentUpload";
import { YouTubeInput } from "@/components/YouTubeInput";
import { ChatInterface } from "@/components/ChatInterface";
import { ThemeToggle } from "@/components/ThemeToggle";


export default function App() {
  const [uploadedContent, setUploadedContent] = useState<
    UploadedContent[]
  >([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeContent, setActiveContent] =
    useState<UploadedContent | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const resetToHome = () => {
    setActiveContent(null);
    setMessages([]);
  };

    console.log("Active contextId:", activeContent?.contextId);

 const handleDocumentUpload = async (file: File) => {
  // 1) Send the file to the backend
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload-pdf", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      // Backend returns an error (size, parse issue, etc)
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: "assistant",
        content:
          data.error ||
          `Sorry, I could not process "${file.name}". Please try another PDF.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // 2) Create UploadedContent with contextId and preview from backend
    const newContent: UploadedContent = {
      id: Date.now().toString(),
      type: "document",
      name: file.name,
      file,
      timestamp: new Date(),
      contextId: data.contextId,
      preview: data.preview,
    };

    setUploadedContent((prev) => [...prev, newContent]);
    setActiveContent(newContent);

    // 3) System message that includes a short preview
    const previewSnippet =
      typeof data.preview === "string"
        ? data.preview.slice(0, 500)
        : "";

    const systemMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: `I processed "${file.name}" and loaded it as context. Here’s a quick preview of what I found.`,
      preview: previewSnippet,
      totalChars: data.totalChars,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, systemMessage]);
  } catch (err) {
    console.error("PDF upload error", err);
    const errorMessage: Message = {
      id: Date.now().toString(),
      type: "assistant",
      content:
        "Something went wrong while uploading the PDF. Please check your connection and try again.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, errorMessage]);
  }
};

const handleYouTubeAdd = async (url: string, title: string) => {
  try {
    const res = await fetch("/api/youtube-transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: "assistant",
        content:
          data.error ||
          `Sorry, I could not fetch the transcript for that YouTube video. Please try another link.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const newContent: UploadedContent = {
      id: Date.now().toString(),
      type: "youtube",
      name: title,
      url,
      timestamp: new Date(),
      contextId: data.contextId,
      preview: data.preview,
    };

    setUploadedContent((prev) => [...prev, newContent]);
    setActiveContent(newContent);

    const previewSnippet =
      typeof data.preview === "string" ? data.preview.slice(0, 500) : "";

    const systemMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: `Loaded the transcript for "${title}" and it’s ready for questions. Here’s a quick preview.`,
      preview: previewSnippet,
      totalChars: data.totalChars,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, systemMessage]);
  } catch (err) {
    console.error("YouTube add error", err);
    const errorMessage: Message = {
      id: Date.now().toString(),
      type: "assistant",
      content:
        "Something went wrong while processing the YouTube link. Please check your connection and try again.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, errorMessage]);
  }
};

  const handleSendMessage = (
    content: string,
    isVoice: boolean = false,
  ) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date(),
      isVoice,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "That's an interesting question. Based on the content, I can help you with that.",
        "Let me analyze that section for you. Here's what I found...",
        "Great question! From what I can see in the content...",
        "I'd be happy to explain that part in more detail.",
      ];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content:
          responses[
            Math.floor(Math.random() * responses.length)
          ],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 1000);
  };

  const hasContent = Boolean(activeContent);

  return (
    <div className={`min-h-screen flex flex-col ${
      isDarkMode 
        ? 'bg-gradient-to-b from-neutral-900 to-neutral-800' 
        : 'bg-gradient-to-b from-slate-50 to-slate-100'
    }`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-10 shadow-sm ${
        isDarkMode 
          ? 'bg-neutral-900 border-neutral-700' 
          : 'bg-white border-slate-200'
      }`}>
        <div className="px-4 py-4 flex items-start justify-between">
          <div className="flex-1">
            <button
              type="button"
              onClick={resetToHome}
              className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-neutral-500 rounded-md"
            >
              <h1 className={`flex items-center gap-2 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
                <MessageSquare className="w-6 h-6 text-blue-600" />
                EchoChat
              </h1>
            </button>
            <p className={`text-sm mt-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Chat with your documents and videos
            </p>
          </div>
          <ThemeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {!hasContent ? (
          // Upload Screen
          <div className="flex-1 px-4 py-6">
            <Tabs defaultValue="document" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="document" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Document
                </TabsTrigger>
                <TabsTrigger value="youtube" className="gap-2">
                  <Youtube className="w-4 h-4" />
                  YouTube
                </TabsTrigger>
              </TabsList>

              <TabsContent value="document">
                <DocumentUpload
                  onUpload={handleDocumentUpload}
                  isDarkMode={isDarkMode}
                />
              </TabsContent>

              <TabsContent value="youtube">
                <YouTubeInput onAdd={handleYouTubeAdd} isDarkMode={isDarkMode} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          // Chat Screen
          <ChatInterface
            messages={messages}
            activeContent={activeContent}
            onSendMessage={handleSendMessage}
            onBackToUpload={resetToHome}
            isDarkMode={isDarkMode}
            contextId={activeContent?.contextId ?? null}
          />
        )}
      </main>
    </div>
  );
}
