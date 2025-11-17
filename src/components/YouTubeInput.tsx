//echodoc/src/components/YouTubeInput.tsx
/**
 * Collects a YouTube URL, gives the user lightweight validation feedback,
 * and reports back a pseudo title so the rest of the UI can treat it like
 * any other uploaded source.
 */
import { useState } from 'react';
import { Youtube, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface YouTubeInputProps {
  onAdd: (url: string, title: string) => void | Promise<void>;
  isDarkMode?: boolean;
}

export function YouTubeInput({ onAdd, isDarkMode }: YouTubeInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const isValidYouTubeUrl = (url: string) => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=.+$/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/.+$/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const extractVideoId = (url: string) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    const videoId = extractVideoId(url);
    const title = videoId ? `YouTube Video (${videoId})` : 'YouTube Video';
    
    onAdd(url, title);
    setUrl('');
  };

  return (
    <Card className={`p-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            isDarkMode ? 'bg-neutral-700' : 'bg-red-100'
          }`}>
            <Youtube className="w-8 h-8 text-red-600" />
          </div>
          
          <div className="text-center">
            <h3 className={`mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Add a YouTube video</h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Paste a YouTube URL to start chatting about the video
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <LinkIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <Input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={`pl-10 ${isDarkMode ? 'bg-neutral-700 border-neutral-600 text-white placeholder:text-slate-500' : ''}`}
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
        </div>

        <Button type="submit" className="w-full gap-2">
          <Youtube className="w-4 h-4" />
          Add Video
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        <h4 className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>What you can do:</h4>
        <ul className="space-y-2">
          {[
            'Ask questions about the video content',
            'Get summaries of key points',
            'Discuss specific timestamps',
            'Explore topics using voice or text',
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
