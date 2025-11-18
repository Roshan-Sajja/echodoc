// src/components/RealtimeCallButton.tsx
"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface RealtimeCallButtonProps {
  contextId: string | null;
  isDarkMode?: boolean;
  onCallChange?: (inCall: boolean) => void;   
}

export function RealtimeCallButton({
  contextId,
  isDarkMode,
  onCallChange,
}: RealtimeCallButtonProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const pendingInstructionsRef = useRef<Promise<void> | null>(null);

  const baseButtonClasses = isDarkMode
    ? "bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700"
    : "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200";

  async function startCall() {
    if (!contextId) {
      setError("No context selected. Upload a PDF or YouTube first.");
      setTimeout(() => setError(""), 2500);
      return;
    }
    if (isInCall || isConnecting) return;

    try {
      setIsConnecting(true);
      console.log("[Realtime Call] Starting call flow", { contextId });
      transcriptRef.current = [];

      // 1) Get ephemeral key from your Next API
      console.log("[Realtime Call] Requesting client secret from /api/realtime");
      const res = await fetch("/api/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId }),
      });

      console.log("[Realtime Call] /api/realtime response", { status: res.status });
      if (!res.ok) {
        setError("Could not start Realtime session.");
        setTimeout(() => setError(""), 2500);
        setIsConnecting(false);
        return;
      }

      const { clientSecret } = await res.json();
      const EPHEMERAL_KEY = clientSecret as string;
      console.log("[Realtime Call] Received client secret");

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
      pc.addTrack(ms.getTracks()[0]);

      // 5) Data channel for events (optional for now)
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onopen = () => {
        console.log("[Realtime Call] Data channel opened");
        // Fetch context text and update session instructions again to ensure the PDF/YT context is loaded
        pendingInstructionsRef.current = (async () => {
          try {
            const ctxRes = await fetch("/api/context-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contextId }),
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
                    instructions:
                      "You are an assistant that helps the user talk to a document or YouTube video. " +
                      "Use this text as your main reference when answering:\n\n" +
                      text,
                  },
                }),
              );
              console.log("[Realtime Call] Session instructions refreshed with context text");
            }
          } catch (err) {
            console.error("[Realtime Call] Error refreshing instructions", err);
          }
        })();
      };
      dc.onerror = (event) => {
        console.error("[Realtime Call] Data channel error", event);
      };
      dc.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          console.log("[Realtime Call] Data channel message (parsed)", parsed);
          const type = parsed?.type;
          if (type === "conversation.item.input_audio_transcript.delta") {
            transcriptRef.current.push(`You(delta): ${parsed.delta ?? ""}`);
          } else if (type === "conversation.item.input_text") {
            transcriptRef.current.push(
              `You(text): ${parsed.item?.content?.[0]?.text ?? ""}`,
            );
          } else if (type === "response.output_audio_transcript.delta") {
            transcriptRef.current.push(`AI(delta): ${parsed.delta ?? ""}`);
          } else if (type === "response.output_text.delta") {
            transcriptRef.current.push(`AI(text): ${parsed.delta ?? ""}`);
          }
        } catch {
          console.log("[Realtime Call] Data channel message (raw)", event.data);
          transcriptRef.current.push(`Raw: ${String(event.data)}`);
        }
      };

      // 6) SDP offer -> OpenAI Realtime /calls
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("[Realtime Call] Sending SDP offer to OpenAI /realtime/calls");
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

      console.log("[Realtime Call] OpenAI /realtime/calls succeeded");
      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSdp,
      };
      await pc.setRemoteDescription(answer);

      console.log("[Realtime Call] Call connected");
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
}
