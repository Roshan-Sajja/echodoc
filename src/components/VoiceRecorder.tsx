/**
 * Wraps the Web Speech API so we can capture a short transcript in the browser.
 * Provides the record/stop button UI plus basic error messaging for access or
 * speech issues.
 */
import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface VoiceRecorderProps {
  onTranscriptComplete: (transcript: string) => void;
  isDarkMode?: boolean;
}

export function VoiceRecorder({ onTranscriptComplete, isDarkMode }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        if (transcript.trim()) {
          setIsProcessing(true);
          setTimeout(() => {
            onTranscriptComplete(transcript);
            setTranscript('');
            setIsProcessing(false);
          }, 500);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please enable it in your browser settings.');
        } else if (event.error === 'no-speech') {
          setError('No speech detected. Please try again.');
        } else {
          setError('Error recording. Please try again.');
        }
        setTimeout(() => setError(''), 3000);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [transcript, onTranscriptComplete]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      setError('');
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        setError('Speech recognition is not supported in your browser.');
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Recording Button */}
      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          onClick={toggleRecording}
          disabled={isProcessing}
          size="lg"
          className={`w-20 h-20 rounded-full transition-all ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 animate-pulse'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-8 h-8" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </Button>

        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {isProcessing
            ? 'Processing...'
            : isRecording
            ? 'Tap to stop recording'
            : 'Tap to start recording'}
        </p>
      </div>

      {/* Transcript Preview */}
      {transcript && (
        <div className={`rounded-lg p-3 min-h-[60px] ${
          isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100'
        }`}>
          <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{transcript}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="flex items-center justify-center gap-2 text-red-600">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          <span className="text-sm">Recording...</span>
        </div>
      )}
    </div>
  );
}
