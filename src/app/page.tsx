"use client";

/*
 * Home page for the playground. Handles the main document/video upload flow,
 * keeps local message state, and flips between the upload wizard and the chat
 * screen. If you can explain this file, you can explain the entire app.
 */
import { useEffect, useState } from "react";
import type { UploadedContent, ChatMessage } from "@/types/chat";
import { FileText, Youtube, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeContent, setActiveContent] =
    useState<UploadedContent | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"document" | "youtube">("document");
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("dark", isDarkMode);
    body?.classList.toggle("dark", isDarkMode);
    return () => {
      root.classList.remove("dark");
      body?.classList.remove("dark");
    };
  }, [isDarkMode]);

  const resetToHome = () => {
    setActiveContent(null);
    setMessages([]);
    setHasStarted(true);
  };
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
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        text:
          data.error ||
          `Sorry, I could not process "${file.name}". Please try another PDF.`,
        createdAt: new Date(),
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

    setActiveContent(newContent);

    // 3) System message that includes a short preview
    const previewSnippet =
      typeof data.preview === "string"
        ? data.preview.slice(0, 1000)
        : "";

    const systemMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      text: `I processed "${file.name}" and loaded it as context. Here’s a quick preview of what I found.`,
      preview: previewSnippet,
      totalChars: data.totalChars,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, systemMessage]);
  } catch (err) {
    console.error("PDF upload error", err);
    const errorMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      text:
        "Something went wrong while uploading the PDF. Please check your connection and try again.",
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, errorMessage]);
  }
};

const handleYouTubeAdd = async (url: string, fallbackTitle: string) => {
  const res = await fetch("/api/youtube-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.error ||
        `Sorry, I could not fetch the transcript for that YouTube video. Please try another link.`,
    );
  }

  const resolvedTitle =
    data.metadata?.title?.trim() || fallbackTitle || "YouTube Video";

  const newContent: UploadedContent = {
    id: Date.now().toString(),
    type: "youtube",
    name: resolvedTitle,
    url,
    timestamp: new Date(),
    contextId: data.contextId,
    preview: data.preview,
    authorName: data.metadata?.authorName ?? undefined,
    subscriberCount: data.metadata?.subscriberCount ?? undefined,
    publishedAt: data.metadata?.publishedAt ?? undefined,
  };

  setActiveContent(newContent);

  const previewSnippet =
    typeof data.preview === "string" ? data.preview.slice(0, 1000) : "";

  const systemMessage: ChatMessage = {
    id: (Date.now() + 1).toString(),
    role: "assistant",
    text: `Loaded the transcript for "${resolvedTitle}" and it’s ready for questions. Here’s a quick preview.`,
    preview: previewSnippet,
    totalChars: data.totalChars,
    createdAt: new Date(),
  };

  setMessages((prev) => [...prev, systemMessage]);
};

  const handleSendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };


  const hasContent = Boolean(activeContent);

  return (
    <div className={`min-h-screen flex flex-col ${
      isDarkMode 
        ? 'bg-gradient-to-b from-neutral-900 to-neutral-800' 
        : 'bg-gradient-to-b from-slate-50 to-slate-100'
    }`}>
      {/* Header */}
      {hasStarted && (
        <header
          className={`sticky top-0 z-20 border-b ${
            isDarkMode
              ? "bg-neutral-900/80 border-white/10"
              : "bg-white/80 border-white/40"
          } shadow-sm backdrop-blur-lg transition-colors`}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              type="button"
              onClick={resetToHome}
              className="flex items-center gap-2 focus:outline-none rounded-md"
            >
              <h1
                className={`flex items-center gap-2 text-lg font-semibold ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                <MessageSquare className="w-5 h-5 text-blue-500" />
                EchoChat
              </h1>
            </button>
            <div className="rounded-xl px-2.5 py-1 bg-slate-100/70 dark:bg-white/10 border border-white/40 dark:border-white/10">
              <ThemeToggle
                isDark={isDarkMode}
                onToggle={() => setIsDarkMode(!isDarkMode)}
              />
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      {!hasStarted ? (
        <motion.main
          className="flex-1 flex items-center justify-center px-6 py-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.div
            className={`max-w-xl mx-auto text-center space-y-6 ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45 }}
          >
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
              Voice-first AI
            </p>
            <h2 className="text-4xl font-semibold">EchoDoc</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Drop in a PDF or YouTube link and chat through it like you&rsquo;re on a quick call
              with a teammate—summaries, clarifications, and playful banter included.
            </p>
            <Button
              size="lg"
              className="px-8 py-6 text-base"
              onClick={() => setHasStarted(true)}
            >
              Get started
            </Button>
          </motion.div>
        </motion.main>
      ) : (
        <main className="flex-1 flex flex-col">
          {!hasContent ? (
            // Upload Screen
            <div className="flex-1 px-4 py-4 sm:py-6">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as "document" | "youtube")}
                className="w-full space-y-6"
              >
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
      )}
    </div>
  );
}
