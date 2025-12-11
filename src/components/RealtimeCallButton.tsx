// src/components/RealtimeCallButton.tsx
"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { buildContextInstructions } from "@/lib/instructions";

interface RealtimeCallButtonProps {
  contextId: string | null;
  contextText?: string;
  isDarkMode?: boolean;
  onCallChange?: (inCall: boolean) => void;   
  onAssistantDelta?: (text: string) => void;
  onAssistantDone?: (text: string) => void;
  onUserFinal?: (text: string) => void;
}

export type RealtimeCallHandle = {
  start: () => Promise<void>;
  stop: () => void;
  mute: () => void;
  unmute: () => void;
  isMuted: () => boolean;
};

export const RealtimeCallButton = forwardRef<RealtimeCallHandle, RealtimeCallButtonProps>(
function RealtimeCallButton(
  {
    contextId,
    contextText,
    isDarkMode,
    onCallChange,
    onAssistantDelta,
    onAssistantDone,
    onUserFinal,
  }: RealtimeCallButtonProps,
  ref,
) {
  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const mutedRef = useRef(false);
  const handledUserItemsRef = useRef<Set<string>>(new Set());
  const transcriptRef = useRef<string[]>([]);
  const modelTranscriptBufferRef = useRef("");
  const modelStreamTypeRef = useRef<"text" | "audio" | null>(null);
  const userTranscriptBufferRef = useRef("");

  const logTranscriptionEvent = async (payload: any) => {
    try {
      await fetch("/api/log-transcription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // best-effort logging; ignore errors
    }
  };

  const appendWithSpacing = (current: string, delta: string) => current + `${delta}`;

  // Note: With server VAD, OpenAI auto-responds to voice input before we can update instructions.
  // The initial session has 6 chunks loaded for broader coverage.
  // This function is kept for logging/UI purposes but doesn't re-trigger a response
  // since the model already responded via server VAD.
  const sendUserTextToSession = (text: string) => {
    // Server VAD auto-responds, so we don't need to send another response.create
    // The user's speech is already transcribed and responded to.
    // We just log this for debugging purposes.
    console.log("[Realtime Call] User utterance captured:", text.slice(0, 100));
  };

  const handleUserFinal = (text: string, itemId?: string) => {
    const finalUser = text.trim();
    if (!finalUser) return;

    if (itemId) {
      if (handledUserItemsRef.current.has(itemId)) {
        return;
      }
      handledUserItemsRef.current.add(itemId);
    }

    if (mutedRef.current) {
      return;
    }

    if (onUserFinal) {
      onUserFinal(finalUser);
    }

    sendUserTextToSession(finalUser);
  };

  const extractTranscriptFromItem = (item: any): string => {
    if (!item) return "";

    const parts: string[] = [];
    const pushText = (value?: string) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) parts.push(trimmed);
      }
    };

    const visit = (node: any, parentKey?: string) => {
      if (!node) return;

      if (typeof node === "string") {
        if (parentKey === "text" || parentKey === "transcript") {
          pushText(node);
        }
        return;
      }

      if (Array.isArray(node)) {
        node.forEach((child) => visit(child, parentKey));
        return;
      }

      if (typeof node === "object") {
        Object.entries(node).forEach(([key, value]) => {
          if ((key === "text" || key === "transcript") && typeof value === "string") {
            pushText(value);
          } else {
            visit(value, key);
          }
        });
      }
    };

    visit(item);
    return parts.join(" ").trim();
  };

  const baseButtonClasses = isDarkMode
    ? "bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700"
    : "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200";

  async function startCall() {
    if (!contextId && !contextText) {
      setError("No context selected. Upload a PDF or YouTube first.");
      setTimeout(() => setError(""), 2500);
      return;
    }
    if (isInCall || isConnecting) return;

    try {
      setIsConnecting(true);
      transcriptRef.current = [];
      modelTranscriptBufferRef.current = "";
      userTranscriptBufferRef.current = "";
      mutedRef.current = false;
      handledUserItemsRef.current.clear();
      // 1) Get ephemeral key from your Next API
      const res = await fetch("/api/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId, contextText }),
      });

      if (!res.ok) {
        setError("Could not start Realtime session.");
        setTimeout(() => setError(""), 2500);
        setIsConnecting(false);
        return;
      }

      const { clientSecret } = await res.json();
      const EPHEMERAL_KEY = clientSecret as string;

      // 2) Create peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 3) Remote audio
      if (!audioRef.current) {
        audioRef.current = document.createElement("audio");
        audioRef.current.autoplay = true;
      }
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
        }
      };

      // 4) Local mic
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = ms.getTracks()[0];
      micTrackRef.current = track;
      micTrackRef.current.enabled = !mutedRef.current;
      pc.addTrack(track);

      // 5) Data channel for events (optional for now)
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onopen = async () => {
          // Fetch context text and update session instructions with MORE chunks for voice
          // Voice needs more chunks upfront because server VAD auto-responds before we can update per-query
          try {
            const ctxRes = await fetch("/api/context-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                contextId, 
                contextText, // Pass contextText for serverless reliability
                maxChunks: 6, // More chunks for voice (covers more of the transcript)
              }),
            });
            if (!ctxRes.ok) {
              console.error("[Realtime Call] Failed to fetch context text", { status: ctxRes.status });
              return;
            }
            const { text } = await ctxRes.json();
            if (dcRef.current?.readyState === "open") {
              dcRef.current.send(
                JSON.stringify({
                  type: "session.update",
                  session: {
                    instructions: buildContextInstructions(text, { passiveOnly: true }),
                  },
                }),
              );
            }
          } catch (err) {
            console.error("[Realtime Call] Error refreshing instructions", err);
          }
      };
      dc.onerror = (event) => {
        console.error("[Realtime Call] Data channel error", event);
      };
        dc.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const type = parsed?.type;
            if (type === "response.created") {
              modelStreamTypeRef.current = null;
              modelTranscriptBufferRef.current = "";
            }
            const isUserDelta =
              type === "conversation.item.input_audio_transcription.delta" ||
              type === "conversation.item.input_audio_transcript.delta";
            const isUserDone =
              type === "conversation.item.input_audio_transcription.completed" ||
            type === "conversation.item.input_audio_transcript.done" ||
            type === "conversation.item.input_audio_transcript.completed";

          if (isUserDelta) {
            logTranscriptionEvent(parsed);
            const delta = parsed.delta ?? "";
            userTranscriptBufferRef.current = appendWithSpacing(
              userTranscriptBufferRef.current,
              delta,
            );
            transcriptRef.current.push(`You(delta): ${delta}`);
          } else if (isUserDone) {
            logTranscriptionEvent(parsed);
            const userRole = parsed.item?.role ?? "user";
            const finalUser =
              parsed.transcript?.trim?.() ||
              parsed.item?.content?.[0]?.transcript?.trim?.() ||
              parsed.item?.content?.[0]?.text?.trim?.() ||
              userTranscriptBufferRef.current.trim();

            if (userRole === "user" && finalUser) {
              handleUserFinal(finalUser, parsed.item?.id || parsed.item_id);
            }
            userTranscriptBufferRef.current = "";
          } else if (type === "conversation.item.input_text") {
            transcriptRef.current.push(
              `You(text): ${parsed.item?.content?.[0]?.text ?? ""}`,
            );
          } else if (type === "conversation.item.done") {
            const itemRole = parsed.item?.role;
            if (itemRole === "user") {
              const finalUser = extractTranscriptFromItem(parsed.item);
              if (finalUser) {
                handleUserFinal(finalUser, parsed.item?.id);
              }
            }
          } else if (
            type === "response.output_text.delta" ||
            type === "response.output_audio_transcript.delta"
          ) {
            const isText = type === "response.output_text.delta";
            if (!modelStreamTypeRef.current) {
              modelStreamTypeRef.current = isText ? "text" : "audio";
            }
            // Only consume deltas for the first modality we see to avoid double renders
            if (modelStreamTypeRef.current === (isText ? "text" : "audio")) {
              logTranscriptionEvent(parsed);
              const delta = parsed.delta ?? "";
              modelTranscriptBufferRef.current = appendWithSpacing(
                modelTranscriptBufferRef.current,
                delta,
              );
              transcriptRef.current.push(`AI(delta): ${delta}`);
              if (onAssistantDelta) onAssistantDelta(modelTranscriptBufferRef.current);
            }
          } else if (
            type === "response.output_text.done" ||
            type === "response.output_audio_transcript.done" ||
            type === "response.done" ||
            type === "response.completed"
          ) {
            const isTextDone = type === "response.output_text.done";
            const isAudioDone = type === "response.output_audio_transcript.done";
            if (
              modelStreamTypeRef.current === null ||
              (modelStreamTypeRef.current === "text" && isTextDone) ||
              (modelStreamTypeRef.current === "audio" && isAudioDone) ||
              type === "response.done" ||
              type === "response.completed"
            ) {
              logTranscriptionEvent(parsed);
              const finalAssistant = modelTranscriptBufferRef.current.trim();
              if (finalAssistant && onAssistantDone) onAssistantDone(finalAssistant);
              modelTranscriptBufferRef.current = "";
              modelStreamTypeRef.current = null;
            }
          }
        } catch {
          transcriptRef.current.push(`Raw: ${String(event.data)}`);
        }
      };

      // 6) SDP offer -> OpenAI Realtime /calls
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp || "",
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        console.error("[Realtime Call] OpenAI /realtime/calls error", {
          status: sdpResponse.status,
          statusText: sdpResponse.statusText,
        });
        setError("OpenAI realtime call failed.");
        setTimeout(() => setError(""), 2500);
        setIsConnecting(false);
        onCallChange?.(false);
        return;
      }

      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSdp,
      };
      await pc.setRemoteDescription(answer);

      setIsInCall(true);
      setIsConnecting(false);
      onCallChange?.(true);
    } catch (err) {
      console.error("[Realtime Call] Unexpected error", err);
      setError("Error starting call.");
      setTimeout(() => setError(""), 2500);
      setIsConnecting(false);
      onCallChange?.(false);
    }
  }

  function stopCall() {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track?.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    micTrackRef.current = null;
    modelTranscriptBufferRef.current = "";
    handledUserItemsRef.current.clear();
    // Fire and forget transcript save
    if (transcriptRef.current.length) {
      fetch("/api/save-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextId,
          transcript: transcriptRef.current,
          endedAt: new Date().toISOString(),
        }),
      }).catch((err) => console.error("[Realtime Call] Save transcript failed", err));
    }
      setIsInCall(false);
      onCallChange?.(false);
    }

  function muteMic() {
    mutedRef.current = true;
    if (micTrackRef.current) micTrackRef.current.enabled = false;
  }

  function unmuteMic() {
    mutedRef.current = false;
    if (micTrackRef.current) micTrackRef.current.enabled = true;
  }

  useImperativeHandle(ref, () => ({
    start: startCall,
    stop: stopCall,
    mute: muteMic,
    unmute: unmuteMic,
    isMuted: () => mutedRef.current,
  }));

  const onClick = () => {
    if (isInCall) stopCall();
    else startCall();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isConnecting}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-full transition-all ${baseButtonClasses} ${
          isInCall ? "ring-2 ring-green-500/70" : ""
        }`}
        aria-pressed={isInCall}
        aria-label={isInCall ? "End voice call" : "Start voice call"}
      >
        {isConnecting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isInCall ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});
