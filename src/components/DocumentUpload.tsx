/**
 * Standalone drag-and-drop card used on the landing screen for document uploads.
 * Owns the drag state, file input, and the friendly checklist so new users know
 * what happens after they pick a PDF.
 */
import { useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { motion } from 'framer-motion';

interface DocumentUploadProps {
  onUpload: (file: File) => void | Promise<void>;
  isDarkMode?: boolean;
}

export function DocumentUpload({ onUpload, isDarkMode }: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

  const validateAndUpload = (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("PDF must be 25MB or smaller.");
      return;
    }
    setError(null);
    onUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndUpload(e.target.files?.[0] ?? null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndUpload(e.dataTransfer.files?.[0] ?? null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
    >
    <Card
      className={`p-6 lg:p-8 rounded-2xl shadow-lg ${
        isDarkMode
          ? "bg-neutral-900/60 border-white/10"
          : "bg-white border-white/60 backdrop-blur-2xl"
      }`}
    >
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 md:p-10 text-center transition-colors ${
          isDragging
            ? "border-blue-300 bg-blue-50/60 dark:bg-white/5"
            : isDarkMode
              ? "border-white/10 bg-neutral-900/40"
              : "border-slate-200 bg-gradient-to-b from-white to-slate-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-4">
          <div
            className={`w-14 h-14 rounded-lg flex items-center justify-center ${
              isDarkMode ? "bg-white/5 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Upload className="w-7 h-7" />
          </div>
          
          <div>
            <h3 className={`mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Upload a document</h3>
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Drag and drop or click to browse
            </p>
          </div>
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 rounded-md px-5 py-2.5 shadow-sm w-full sm:w-auto"
          >
            <FileText className="w-4 h-4" />
            Choose File
          </Button>
          
          <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            Supported: PDF · Max size 25MB
          </p>
        </div>
      </div>

      {error && (
        <p
          className={`mt-3 text-sm font-semibold ${
            isDarkMode ? "text-red-200" : "text-red-600"
          }`}
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mt-5 space-y-5">
        <h4 className={`text-sm font-semibold tracking-wide uppercase ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          What you can do
        </h4>
        <ul className="space-y-4 relative">
          {[
            'Ask specific questions about the PDF',
            'Get summaries and punchy recaps',
            'Jump to the exact section you need',
            'Switch to voice mode for hands-free chat',
          ].map((item, index) => (
            <li
              key={index}
              className={`relative pl-6 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
            >
              <span
                className={`absolute left-0 top-1.5 size-2 rounded-full ${
                  isDarkMode ? "bg-emerald-300" : "bg-emerald-500"
                }`}
              />
              <span className="block">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
    </motion.div>
  );
}
