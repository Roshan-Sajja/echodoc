// src/components/VoiceChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Phone, PhoneOff, Volume2, Mic, MicOff, X } from "lucide-react";
import { Button } from "./ui/button";

interface VoiceChatProps {
  onConversationUpdate: (userText: string, aiText: string) => void;
  onClose: () => void;
  isDarkMode?: boolean;
  onStartCall: () => Promise<void>;
  onEndCall: () => void;
  onToggleMute: (mute: boolean) => void;
  isCallActive: boolean;
  isMuted: boolean;
  modelTranscript: string;
}

export function VoiceChat({
  onConversationUpdate,
  onClose,
  isDarkMode,
  onStartCall,
  onEndCall,
  onToggleMute,
  isCallActive,
  isMuted,
  modelTranscript,
}: VoiceChatProps) {
  const isActive = isCallActive;
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const muted = isMuted;

  const currentTranscript = modelTranscript;

  // Show only the most recent 2 sentences/lines to avoid huge blocks
  const compactTranscript = (() => {
    if (!currentTranscript?.trim()) return "";
    const parts = currentTranscript
      .split(/(?<=[.!?])\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const lastTwo = parts.slice(-2);
    return lastTwo.join("\n");
  })();
  const [error, setError] = useState("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const waitingForVoicesRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  const activeRef = useRef(false);
  const mutedStateRef = useRef(false);
  const speakingStateRef = useRef(false);

  const startRecognitionSafe = () => {
    if (!recognitionRef.current) return;
    if (recognitionStartingRef.current) return;
    try {
      recognitionStartingRef.current = true;
      recognitionRef.current.start();
    } catch (err: any) {
      if (err?.name !== "InvalidStateError") {
        console.error("Failed to start recognition:", err);
      }
    } finally {
      recognitionStartingRef.current = false;
    }
  };

  useEffect(() => {
    mutedStateRef.current = muted;
  }, [muted]);

  useEffect(() => {
    speakingStateRef.current = isSpeaking;
  }, [isSpeaking]);

  // Call timer
  // React to external mute changes: stop/start recognition accordingly
  useEffect(() => {
    if (!isActive) {
      setIsListening(false);
      recognitionRef.current?.stop();
      return;
    }

    if (muted || isSpeaking) {
      setIsListening(false);
      recognitionRef.current?.stop();
      return;
    }

    setIsListening(true);
    startRecognitionSafe();
  }, [muted, isActive, isSpeaking]);

  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      callTimerRef.current = window.setInterval(() => {
        setCallDuration((prevDuration) => prevDuration + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallDuration(0);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    // Check if browser supports speech recognition
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setError("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    // Initialize Speech Recognition
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-US";

    recognitionRef.current.onresult = (event: any) => {
      if (mutedStateRef.current || !activeRef.current) return;

      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        }
      }

      if (finalTranscript.trim()) {
        console.log("[VoiceChat] onresult finalTranscript", { finalTranscript });
        onConversationUpdate(finalTranscript.trim(), "");
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      // "aborted" and "no-speech" are common benign errors; ignore them
      if (event.error === "aborted" || event.error === "no-speech") return;
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setError("Microphone access denied");
        handleEndCall();
      } else {
        setError("Voice recognition error");
      }
    };

    recognitionRef.current.onend = () => {
      if (!activeRef.current) return;
      if (!mutedStateRef.current && !speakingStateRef.current) {
        // Restart listening if still in active mode and not muted
        startRecognitionSafe();
      }
    };

    // Initialize Speech Synthesis
    synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [isActive, isSpeaking, muted]);

  const speakResponse = (text: string) => {
    const synth = synthRef.current;
    if (!synth) return;

    const pickVoice = () => {
      const voices = synth.getVoices();
      return voices.find((v) => v.lang?.toLowerCase().startsWith("en")) || voices[0] || null;
    };

    let voice = pickVoice();
    if (!voice) {
      if (!waitingForVoicesRef.current) {
        waitingForVoicesRef.current = true;
        synth.onvoiceschanged = () => {
          waitingForVoicesRef.current = false;
          synth.onvoiceschanged = null;
          speakResponse(text);
        };
      } else {
        setError("Voice synthesis error: no TTS voices available");
      }
      return;
    }

    synth.cancel(); // clear any queued utterances
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);

      // Resume listening after AI finishes speaking
      if (isActive && recognitionRef.current && !muted) {
        setIsListening(true);
        startRecognitionSafe();
      }
    };

    utterance.onerror = (e: any) => {
      setIsSpeaking(false);
      const errType = e?.error;
      if (errType === "interrupted" || errType === "canceled") {
        // These are benign when the user ends/mutes the call or a new utterance preempts the current one
        return;
      }
      const errMsg = errType ? `Voice synthesis error: ${errType}` : "Voice synthesis error";
      setError(errMsg);
      console.error(errMsg, e);
    };

    synth.speak(utterance);
  };

  const handleStartCall = async () => {
    if (!recognitionRef.current) {
      setError("Voice chat is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Permission granted - stop the stream as we only needed it for permission
      stream.getTracks().forEach((track) => track.stop());

      setHasPermission(true);
      activeRef.current = true;
      setIsListening(true);
      setError("");
      await onStartCall();
    } catch (err: any) {
      console.error("Microphone permission error:", err);
      setHasPermission(false);

      // Provide specific error messages based on error type
      if (err.name === "NotAllowedError") {
        setError(
          "Microphone access was denied. Please click the camera/microphone icon in your browser's address bar and allow access, then try again.",
        );
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else if (err.name === "NotReadableError") {
        setError("Microphone is being used by another application. Please close other apps using the microphone and try again.");
      } else {
        setError("Could not access microphone. Please check your browser settings and try again.");
      }
    }
  };

  const handleEndCall = () => {
    activeRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }

    onEndCall();
    onClose();
  };

  const toggleMute = () => {
    const newMutedState = !muted;
    console.log("[VoiceChat] toggleMute", { newMutedState });
    onToggleMute(newMutedState);
    recognitionRef.current?.stop();
    if (!newMutedState && isActive) {
      setTimeout(() => {
        if (!mutedStateRef.current && !speakingStateRef.current) {
          setIsListening(true);
          startRecognitionSafe();
        }
      }, 150);
    } else {
      setIsListening(false);
    }
  };

  // If not in a call, show the start button
  if (!isActive) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>Voice Chat Mode</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <span className="sr-only">Close</span>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {error && (
          <div
            className={`rounded-lg p-3 border ${
              isDarkMode
                ? "bg-red-950/50 border-red-800 text-red-300"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <p className="text-sm mb-2">{error}</p>
            <button
              onClick={() => setError("")}
              className={`text-xs underline ${
                isDarkMode ? "text-red-400 hover:text-red-300" : "text-red-600 hover:text-red-700"
              }`}
            >
              Try again
            </button>
          </div>
        )}

        <div className="flex flex-col items-center gap-4 py-6">
          <Button
            type="button"
            onClick={handleStartCall}
            size="lg"
            className="w-20 h-20 rounded-full bg-green-600 hover:bg-green-700"
          >
            <Phone className="w-8 h-8" />
          </Button>
          <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            Tap to start voice call
          </p>
          <p className={`text-xs text-center max-w-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
            You'll be asked to allow microphone access
          </p>
        </div>
      </div>
    );
  }

  // Full screen call interface
  const containerBg = isDarkMode ? "bg-black text-white" : "bg-white text-slate-900";
  const avatarShellBg = isDarkMode ? "bg-white/20" : "bg-slate-200";
  const avatarCoreBg = isDarkMode ? "bg-white/30" : "bg-slate-300";
  const closeBtnClasses = isDarkMode
    ? "bg-white/10 text-white hover:bg-white/20"
    : "bg-slate-100 text-slate-700 hover:bg-slate-200";

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${containerBg}`}>
      {/* Close button */}
      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={handleEndCall}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition ${closeBtnClasses}`}
          aria-label="Close call"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Call Header */}
      <div
        className={`flex-1 flex flex-col items-center justify-center px-6 ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        <div
          className={`w-32 h-32 rounded-full ${avatarShellBg} backdrop-blur-sm flex items-center justify-center mb-6 relative`}
        >
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center ${
              isSpeaking
                ? isDarkMode
                  ? "bg-blue-500 animate-pulse"
                  : "bg-blue-400 animate-pulse"
                : isListening && !muted
                  ? isDarkMode
                    ? "bg-green-500 animate-pulse"
                    : "bg-green-400 animate-pulse"
                  : avatarCoreBg
            }`}
          >
            <Volume2 className="w-12 h-12" />
          </div>
        </div>

        <h2 className="text-3xl mb-2">DocuChat AI</h2>
        <p
          className={`text-lg mb-1 ${
            isDarkMode ? "text-white/80" : "text-slate-600"
          }`}
        >
          {formatDuration(callDuration)}
        </p>

        <div className="h-6 flex items-center justify-center">
          {isSpeaking ? (
            <p className={`text-sm ${isDarkMode ? "text-white/90" : "text-slate-700"}`}>
              AI is speaking...
            </p>
          ) : muted ? (
            <p className={`text-sm ${isDarkMode ? "text-white/90" : "text-slate-700"}`}>Muted</p>
          ) : isListening ? (
            <p className={`text-sm ${isDarkMode ? "text-white/90" : "text-slate-700"}`}>
              Listening...
            </p>
          ) : (
            <p className={`text-sm ${isDarkMode ? "text-white/90" : "text-slate-700"}`}>
              Processing...
            </p>
          )}
        </div>

        {compactTranscript && (
          <div className="mt-8 max-w-md w-full">
            <div
              className={`backdrop-blur-md rounded-2xl p-4 ${
                isDarkMode
                  ? "bg-white/10 border border-white/20"
                  : "bg-slate-100 border border-slate-200"
              }`}
            >
              <p
                className={`text-sm text-center whitespace-pre-line ${
                  isDarkMode ? "text-white/90" : "text-slate-800"
                }`}
              >
                {compactTranscript}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 max-w-md w-full">
            <div
              className={`backdrop-blur-md rounded-2xl p-3 border ${
                isDarkMode
                  ? "bg-red-500/90 border-red-400 text-white"
                  : "bg-red-100 border-red-200 text-red-800"
              }`}
            >
              <p className="text-sm text-center">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <div className="pb-12 px-6">
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={toggleMute}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? isDarkMode
                  ? "bg-white text-blue-600"
                  : "bg-blue-100 text-blue-700"
                : isDarkMode
                  ? "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>

          <button
            onClick={handleEndCall}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isDarkMode ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
            }`}
            aria-label="End call"
          >
            <PhoneOff className="w-8 h-8" />
          </button>

          <div className="w-16 h-16" />
        </div>

        <div className="flex justify-center gap-6 mt-6 text-white/80 text-xs">
          <span className="flex items-center gap-1">{muted ? "Unmute" : "Mute"}</span>
          <span>•</span>
          <span className="flex items-center gap-1">End Call</span>
        </div>
      </div>
    </div>
  );
}
