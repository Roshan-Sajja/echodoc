//echodoc/src/components/YouTubeInput.tsx
/**
 * Collects a YouTube URL, gives the user lightweight validation feedback,
 * and reports back a pseudo title so the rest of the UI can treat it like
 * any other uploaded source.
 */
import { useState } from 'react';
import { Youtube, Link as LinkIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { Spinner } from "@/components/ui/spinner";

interface YouTubeInputProps {
  onAdd: (url: string, title: string) => void | Promise<void>;
  isDarkMode?: boolean;
}

export function YouTubeInput({ onAdd, isDarkMode }: YouTubeInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    setIsSubmitting(true);
    try {
      await onAdd(url, title);
      setUrl('');
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Unable to process that YouTube URL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div
            className={`w-14 h-14 rounded-lg flex items-center justify-center ${
              isDarkMode ? "bg-white/5 text-white" : "bg-red-50 text-red-500"
            }`}
          >
            <Youtube className="w-7 h-7" />
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
            <LinkIcon
              className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            />
            <Input
              type="text"
              placeholder="https://youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={`pl-10 rounded-lg ${
                isDarkMode
                  ? "bg-neutral-800 border-white/10 text-white placeholder:text-slate-500"
                  : "bg-slate-50 border-slate-200"
              }`}
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
        </div>

        <Button type="submit" className="w-full gap-2 rounded-md py-2.5" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner className="mr-2" />
              Loading transcript…
            </>
          ) : (
            <>
              <Youtube className="w-4 h-4" />
              Add Video
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 space-y-5">
        <h4
          className={`text-sm font-semibold tracking-wide uppercase ${
            isDarkMode ? "text-slate-300" : "text-slate-600"
          }`}
        >
          Quick possibilities
        </h4>
        <ul className="space-y-4">
          {[
            "Ask about any timestamp or topic jump",
            "Get concise recaps of the video",
            "Pull metadata about the creator",
            "Blend video context with voice chat",
          ].map((item, index) => (
            <li
              key={index}
              className={`relative pl-6 text-sm ${
                isDarkMode ? "text-slate-300" : "text-slate-700"
              }`}
            >
              <span
                className={`absolute left-0 top-1.5 size-2 rounded-full ${
                  isDarkMode ? "bg-sky-300" : "bg-sky-500"
                }`}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Card>
    </motion.div>
  );
}
