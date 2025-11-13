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

  const handleDocumentUpload = (file: File) => {
    const newContent: UploadedContent = {
      id: Date.now().toString(),
      type: "document",
      name: file.name,
      file,
      timestamp: new Date(),
    };
    setUploadedContent((prev) => [...prev, newContent]);
    setActiveContent(newContent);

    // Add system message
    const systemMessage: Message = {
      id: Date.now().toString(),
      type: "assistant",
      content: `Document "${file.name}" uploaded successfully! I'm ready to answer questions about it.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMessage]);
  };

  const handleYouTubeAdd = (url: string, title: string) => {
    const newContent: UploadedContent = {
      id: Date.now().toString(),
      type: "youtube",
      name: title,
      url,
      timestamp: new Date(),
    };
    setUploadedContent((prev) => [...prev, newContent]);
    setActiveContent(newContent);

    // Add system message
    const systemMessage: Message = {
      id: Date.now().toString(),
      type: "assistant",
      content: `YouTube video "${title}" added successfully! I'm ready to discuss its content.`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMessage]);
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

  const hasContent = uploadedContent.length > 0;

  return (
    <div className={`min-h-screen flex flex-col ${
      isDarkMode 
        ? 'bg-gradient-to-b from-slate-900 to-slate-800' 
        : 'bg-gradient-to-b from-slate-50 to-slate-100'
    }`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-10 shadow-sm ${
        isDarkMode 
          ? 'bg-slate-900 border-slate-700' 
          : 'bg-white border-slate-200'
      }`}>
        <div className="px-4 py-4 flex items-start justify-between">
          <div className="flex-1">
            <h1 className={`flex items-center gap-2 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              <MessageSquare className="w-6 h-6 text-blue-600" />
              EchoChat
            </h1>
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
            onBackToUpload={() => {
              setActiveContent(null);
              setMessages([]);
            }}
            isDarkMode={isDarkMode}
          />
        )}
      </main>
    </div>
  );
}
