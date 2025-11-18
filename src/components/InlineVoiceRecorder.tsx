// src/components/InlineVoiceRecorder.tsx
/**
 * Compact mic button that records a transcript using the Web Speech API.
 * Caller controls finalize/cancel; we keep listening across short silences.
 */
import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface InlineVoiceRecorderProps {
  onTranscriptComplete: (transcript: string) => void;
  isDarkMode?: boolean;
  onRecordingChange?: (recording: boolean) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  className?: string;
}

export type InlineVoiceRecorderHandle = {
  accept: () => void;
  cancel: () => void;
};

export const InlineVoiceRecorder = forwardRef<
  InlineVoiceRecorderHandle,
  InlineVoiceRecorderProps
>(function InlineVoiceRecorder(
  {
    onTranscriptComplete,
    isDarkMode,
    onRecordingChange,
    onSpeakingChange,
    className,
  },
  ref,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const transcriptBufferRef = useRef('');
  const userStopRef = useRef(false);
  const restartPendingRef = useRef(false);
  const speakingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += text + ' ';
          } else {
            interimTranscript += text;
          }
        }

        const heard = (finalTranscript + interimTranscript).trim();
        if (finalTranscript) {
          transcriptBufferRef.current = `${transcriptBufferRef.current} ${finalTranscript}`.trim();
        }

        if (heard) {
          onSpeakingChange?.(true);
          if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
          speakingTimerRef.current = setTimeout(() => {
            onSpeakingChange?.(false);
          }, 800);
        }
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        if (!userStopRef.current && recognitionRef.current) {
          if (!restartPendingRef.current) {
            restartPendingRef.current = true;
            setTimeout(() => {
              if (!userStopRef.current) {
                recognitionRef.current?.start();
                setIsRecording(true);
              }
              restartPendingRef.current = false;
            }, 150);
          }
        } else {
          onRecordingChange?.(false);
          onSpeakingChange?.(false);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsRecording(false);
        onRecordingChange?.(false);
        onSpeakingChange?.(false);
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please enable it.');
        } else {
          setError('Error recording. Please try again.');
        }
        setTimeout(() => setError(''), 3000);
      };
    } else {
      setIsSupported(false);
      setError(
        'Speech recognition is not supported in this browser. Try Chrome/Edge or use text.',
      );
      setTimeout(() => setError(''), 4000);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscriptComplete, onSpeakingChange]);

  const toggleRecording = () => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition is not available. Please switch to text.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (isRecording) {
      userStopRef.current = true;
      recognitionRef.current?.stop();
      onRecordingChange?.(false);
    } else {
      transcriptBufferRef.current = '';
      userStopRef.current = false;
      setError('');
      recognitionRef.current.start();
      setIsRecording(true);
      onRecordingChange?.(true);
      onSpeakingChange?.(false);
    }
  };

  const accept = () => {
    userStopRef.current = true;
    onRecordingChange?.(false);
    onSpeakingChange?.(false);
    recognitionRef.current?.stop();
    const finalValue = transcriptBufferRef.current.trim();
    if (!finalValue) {
      setError('No audio captured. Try again.');
      setTimeout(() => setError(''), 2000);
      return;
    }
    setIsProcessing(true);
    Promise.resolve(onTranscriptComplete(finalValue)).finally(() => {
      transcriptBufferRef.current = '';
      setIsProcessing(false);
    });
  };

  const cancel = () => {
    userStopRef.current = true;
    onRecordingChange?.(false);
    recognitionRef.current?.stop();
    transcriptBufferRef.current = '';
    setIsRecording(false);
    setIsProcessing(false);
  };

  useImperativeHandle(ref, () => ({
    accept,
    cancel,
  }));

  const baseButtonClasses = isDarkMode
    ? 'bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700'
    : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <button
        type="button"
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-full transition-all ${baseButtonClasses} ${
          isRecording ? 'ring-2 ring-red-500/70' : ''
        }`}
        aria-pressed={isRecording}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
});
