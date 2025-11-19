// src/components/VoiceChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Phone, PhoneOff, Volume2, Mic, MicOff, X, Captions, CaptionsOff } from "lucide-react";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { motion, AnimatePresence } from "framer-motion";

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
  const [captionBuffer, setCaptionBuffer] = useState("");
  const [captionDisplay, setCaptionDisplay] = useState("");
  const captionDisplayRef = useRef("");
  const captionIntervalRef = useRef<number | null>(null);
  const MAX_CAPTION_CHARS = 800;

  const currentTranscript = captionDisplay;

  useEffect(() => {
    const trimmed = modelTranscript?.trim?.() ?? "";
    if (trimmed) {
      setCaptionBuffer(trimmed);
    } else if (!trimmed && !isCallActive) {
      setCaptionBuffer("");
    }
  }, [modelTranscript, isCallActive]);

  useEffect(() => {
    captionDisplayRef.current = captionDisplay;
  }, [captionDisplay]);

  useEffect(() => {
    if (captionIntervalRef.current) {
      window.clearInterval(captionIntervalRef.current);
      captionIntervalRef.current = null;
    }

    if (!captionBuffer?.trim()) {
      setCaptionDisplay("");
      return;
    }

    const target = captionBuffer.slice(-MAX_CAPTION_CHARS);
    const current = captionDisplayRef.current;
    let index = current && target.startsWith(current) ? current.length : 0;

    if (index >= target.length) {
      setCaptionDisplay(target);
      return;
    }

    captionIntervalRef.current = window.setInterval(() => {
      index = Math.min(target.length, index + 2);
      setCaptionDisplay(target.slice(0, index));
      if (index >= target.length && captionIntervalRef.current) {
        window.clearInterval(captionIntervalRef.current);
        captionIntervalRef.current = null;
      }
    }, 100);

    return () => {
      if (captionIntervalRef.current) {
        window.clearInterval(captionIntervalRef.current);
        captionIntervalRef.current = null;
      }
    };
  }, [captionBuffer]);

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
  const [callDuration, setCallDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const callTimerRef = useRef<number | null>(null);
  const recognitionStartingRef = useRef(false);
  const activeRef = useRef(false);
  const mutedStateRef = useRef(false);
  const speakingStateRef = useRef(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [isStartingCall, setIsStartingCall] = useState(false);

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

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isActive, isSpeaking, muted]);

  const handleStartCall = async () => {
    if (!recognitionRef.current) {
      setError("Voice chat is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      setIsStartingCall(true);
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Permission granted - stop the stream as we only needed it for permission
      stream.getTracks().forEach((track) => track.stop());

      activeRef.current = true;
      setIsListening(true);
      setError("");
      await onStartCall();
    } catch (err: any) {
      console.error("Microphone permission error:", err);

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
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleEndCall = () => {
    activeRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    onEndCall();
    onClose();
  };

  const toggleMute = () => {
    const newMutedState = !muted;
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
            disabled={isStartingCall}
          >
            {isStartingCall ? (
              <Spinner className="w-8 h-8 text-white" />
            ) : (
              <Phone className="w-8 h-8" />
            )}
          </Button>
          <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            {isStartingCall ? "Connecting to voice call…" : "Tap to start voice call"}
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

  const showCaptionLayout = captionsEnabled;
  const statusLabel = isSpeaking
    ? "Responding…"
    : isListening && !muted
      ? "Listening…"
      : muted
        ? "Muted"
        : "Connected";
  const circleVariants = {
    idle: { scale: 1, y: 0 },
    caption: { scale: 0.9, y: -12 },
  } as const;
  const shouldPulse = !muted && (isListening || isSpeaking);

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex flex-col ${containerBg}`}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 32 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
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

      {/* Call header & captions */}
      <div className={`flex-1 w-full px-6 pb-10 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        <div
          className={`h-full flex flex-col items-center gap-8 transition-all duration-500 ${
            showCaptionLayout ? "justify-start pt-16 md:pt-20" : "justify-center"
          }`}
        >
          <div
            className={`w-full max-w-3xl mx-auto flex gap-6 ${
              showCaptionLayout
                ? "flex-col items-center text-center"
                : "flex-col md:flex-row items-center md:items-start justify-between text-center md:text-left"
            }`}
          >
            {showCaptionLayout ? (
              <>
                <motion.div
                  layout
                  variants={circleVariants}
                  animate="caption"
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-28 h-28 flex-shrink-0 relative"
                >
                  <div
                    className={`absolute inset-0 rounded-full blur-2xl ${
                      isDarkMode ? "bg-emerald-500/30" : "bg-emerald-300/40"
                    } animate-pulse`}
                  />
                  {shouldPulse && (
                    <>
                      <motion.span
                        className={`absolute inset-0 rounded-full border ${
                          isDarkMode ? "border-emerald-100/40" : "border-emerald-500/50"
                        } drop-shadow-[0_0_20px_rgba(16,185,129,0.35)]`}
                        animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.span
                        className={`absolute inset-0 rounded-full border ${
                          isDarkMode ? "border-emerald-200/30" : "border-emerald-400/40"
                        }`}
                        animate={{ scale: [1, 1.75], opacity: [0.45, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                      />
                      <motion.span
                        className={`absolute inset-0 rounded-full ${
                          isDarkMode ? "bg-emerald-400/10" : "bg-emerald-400/15"
                        }`}
                        animate={{ scale: [1, 1.9], opacity: [0.35, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
                      />
                    </>
                  )}
                  <div
                    className={`relative w-full h-full rounded-full flex items-center justify-center ${
                      isSpeaking
                        ? isDarkMode
                          ? "bg-blue-500"
                          : "bg-blue-400"
                        : isListening && !muted
                          ? isDarkMode
                            ? "bg-green-500"
                            : "bg-green-400"
                          : avatarCoreBg
                    }`}
                  >
                    <Volume2 className="w-11 h-11" />
                  </div>
                </motion.div>

                <motion.div layout className="flex flex-col gap-1 items-center text-center">
                  <motion.span layout className="font-mono tracking-wide text-lg">
                    {formatDuration(callDuration)}
                  </motion.span>
                  <span className={`text-sm ${isDarkMode ? "text-white/70" : "text-slate-500"}`}>
                    {statusLabel}
                  </span>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div layout className="flex flex-col gap-1 items-center text-center md:items-start md:text-left w-full">
                  <h2 className="text-3xl font-semibold mb-1">EchoChat AI</h2>
                  <motion.span layout className="font-mono tracking-wide text-2xl">
                    {formatDuration(callDuration)}
                  </motion.span>
                  <span className={`text-sm ${isDarkMode ? "text-white/70" : "text-slate-500"}`}>
                    {statusLabel}
                  </span>
                </motion.div>

                <motion.div
                  layout
                  variants={circleVariants}
                  animate="idle"
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-32 h-32 flex-shrink-0 relative"
                >
                  <div
                    className={`absolute inset-0 rounded-full blur-2xl ${
                      isDarkMode ? "bg-emerald-500/30" : "bg-emerald-300/40"
                    } animate-pulse`}
                  />
                  {shouldPulse && (
                    <>
                      <motion.span
                        className={`absolute inset-0 rounded-full border ${
                          isDarkMode ? "border-emerald-100/40" : "border-emerald-500/50"
                        } drop-shadow-[0_0_20px_rgba(16,185,129,0.35)]`}
                        animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                      />
                      <motion.span
                        className={`absolute inset-0 rounded-full border ${
                          isDarkMode ? "border-emerald-200/30" : "border-emerald-400/40"
                        }`}
                        animate={{ scale: [1, 1.75], opacity: [0.45, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                      />
                      <motion.span
                        className={`absolute inset-0 rounded-full ${
                          isDarkMode ? "bg-emerald-400/10" : "bg-emerald-400/15"
                        }`}
                        animate={{ scale: [1, 1.9], opacity: [0.35, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
                      />
                    </>
                  )}
                  <div
                    className={`relative w-full h-full rounded-full flex items-center justify-center ${
                      isSpeaking
                        ? isDarkMode
                          ? "bg-blue-500"
                          : "bg-blue-400"
                        : isListening && !muted
                          ? isDarkMode
                            ? "bg-green-500"
                            : "bg-green-400"
                          : avatarCoreBg
                    }`}
                  >
                    <Volume2 className="w-12 h-12" />
                  </div>
                </motion.div>
              </>
            )}
          </div>

          <AnimatePresence initial={false}>
            {showCaptionLayout && (
              <motion.div
                key="caption-panel"
                initial={{ opacity: 0, y: 32, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 32, scale: 0.95 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full max-w-3xl"
              >
                <div
                  className={`p-6 text-left whitespace-pre-line leading-relaxed max-h-64 overflow-hidden flex items-end text-2xl ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {compactTranscript || statusLabel}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!showCaptionLayout && error && (
            <div
              className={`p-3 rounded-2xl border ${
                isDarkMode
                  ? "bg-red-500/90 border-red-400 text-white"
                  : "bg-red-100 border-red-200 text-red-800"
              }`}
            >
              <p className="text-sm">{error}</p>
            </div>
          )}

          {showCaptionLayout && error && (
            <div
              className={`p-3 rounded-2xl border ${
                isDarkMode
                  ? "bg-red-500/90 border-red-400 text-white"
                  : "bg-red-100 border-red-200 text-red-800"
              }`}
            >
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
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

          <button
            onClick={() => setCaptionsEnabled((prev) => !prev)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              captionsEnabled
                ? isDarkMode
                  ? "bg-emerald-500 text-white"
                  : "bg-emerald-100 text-emerald-700"
                : isDarkMode
                  ? "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            aria-label={captionsEnabled ? "Disable captions" : "Enable captions"}
          >
            {captionsEnabled ? <Captions className="w-7 h-7" /> : <CaptionsOff className="w-7 h-7" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
