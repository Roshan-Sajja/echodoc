/**
 * Standalone drag-and-drop card used on the landing screen for document uploads.
 * Owns the drag state, file input, and the friendly checklist so new users know
 * what happens after they pick a PDF.
 */
import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface DocumentUploadProps {
  onUpload: (file: File) => void | Promise<void>;
  isDarkMode?: boolean;
}

export function DocumentUpload({ onUpload, isDarkMode }: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
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
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <Card className={`p-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-neutral-500 bg-neutral-50 dark:bg-neutral-900'
            : isDarkMode
            ? 'border-neutral-600 bg-neutral-700'
            : 'border-slate-300 bg-slate-50'
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
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-neutral-700' : 'bg-slate-200'
          }`}>
            <Upload className="w-8 h-8 text-slate-700" />
          </div>
          
          <div>
            <h3 className={`mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Upload a document</h3>
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Drag and drop or click to browse
            </p>
          </div>
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Choose File
          </Button>
          
          <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            Supported: PDF
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <h4 className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>What you can do:</h4>
        <ul className="space-y-2">
          {[
            'Ask questions about the document',
            'Get summaries and key points',
            'Find specific information quickly',
            'Discuss content using voice or text',
          ].map((item, index) => (
            <li key={index} className={`flex items-start gap-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
