// src/components/RealtimeCallButton.tsx
"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface RealtimeCallButtonProps {
  contextId: string | null;
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
  const userTranscriptBufferRef = useRef("");
  const pendingInstructionsRef = useRef<Promise<void> | null>(null);

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

  const appendWithSpacing = (current: string, delta: string) => {
    const trimmedDelta = `${delta}`;
    if (!current) return trimmedDelta;
    const needsSpace =
      current.length > 0 &&
      !/\s$/.test(current) &&
      trimmedDelta.length > 0 &&
      !/^\s/.test(trimmedDelta);
    return current + (needsSpace ? " " : "") + trimmedDelta;
  };

  const sendUserTextToSession = (text: string) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    try {
      const createEvent = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      };
      dcRef.current.send(JSON.stringify(createEvent));

      const responseEvent = {
        type: "response.create",
        response: {
          // let the model decide modalities (audio+text); specify text to ensure output text
          output_modalities: ["text", "audio"],
        },
      };
      dcRef.current.send(JSON.stringify(responseEvent));
    } catch (err) {
      console.error("[Realtime Call] Failed to send user text to session", err);
    }
  };

  const handleUserFinal = (text: string, itemId?: string) => {
    const finalUser = text.trim();
    if (!finalUser) return;

    if (itemId) {
      if (handledUserItemsRef.current.has(itemId)) {
        console.log("[Realtime Call] Skipping duplicate user transcript", { itemId });
        return;
      }
      handledUserItemsRef.current.add(itemId);
    }

    if (mutedRef.current) {
      console.log("[Realtime Call] User transcript blocked because mic is muted", { itemId });
      return;
    }

    if (onUserFinal) {
      console.log("[Realtime Call] Forwarding user transcript to ChatInterface", { finalUser, itemId });
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
      modelTranscriptBufferRef.current = "";
      userTranscriptBufferRef.current = "";
      mutedRef.current = false;
      handledUserItemsRef.current.clear();
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
      const track = ms.getTracks()[0];
      micTrackRef.current = track;
      micTrackRef.current.enabled = !mutedRef.current;
      pc.addTrack(track);

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
                      "You are a friendly assistant. Greet the user briefly. Do not list all stored user profile details unless the user asks for them explicitly.\n\n" +
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
          const isUserDelta =
            type === "conversation.item.input_audio_transcription.delta" ||
            type === "conversation.item.input_audio_transcript.delta";
          const isUserDone =
            type === "conversation.item.input_audio_transcription.completed" ||
            type === "conversation.item.input_audio_transcript.done" ||
            type === "conversation.item.input_audio_transcript.completed";

          if (isUserDelta) {
            console.log("[Realtime Call] user delta", { delta: parsed.delta, muted: mutedRef.current });
            logTranscriptionEvent(parsed);
            const delta = parsed.delta ?? "";
            userTranscriptBufferRef.current = appendWithSpacing(
              userTranscriptBufferRef.current,
              delta,
            );
            transcriptRef.current.push(`You(delta): ${delta}`);
          } else if (isUserDone) {
            console.log("[Realtime Call] user final event", { muted: mutedRef.current, transcript: parsed.transcript });
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
                console.log("[Realtime Call] Extracted transcript from conversation.item.done", {
                  itemId: parsed.item?.id,
                  finalUser,
                });
                handleUserFinal(finalUser, parsed.item?.id);
              } else {
                console.log("[Realtime Call] conversation.item.done (user) contained no transcript", parsed.item);
              }
            }
          } else if (
            type === "response.output_audio_transcript.delta" ||
            type === "response.output_text.delta"
          ) {
            logTranscriptionEvent(parsed);
            const delta = parsed.delta ?? "";
            modelTranscriptBufferRef.current = appendWithSpacing(
              modelTranscriptBufferRef.current,
              delta,
            );
            transcriptRef.current.push(`AI(delta): ${delta}`);
            if (onAssistantDelta) onAssistantDelta(modelTranscriptBufferRef.current);
          } else if (
            type === "response.output_text.done" ||
            type === "response.output_audio_transcript.done" ||
            type === "response.done" ||
            type === "response.completed"
          ) {
            logTranscriptionEvent(parsed);
            const finalAssistant = modelTranscriptBufferRef.current.trim();
            if (finalAssistant && onAssistantDone) onAssistantDone(finalAssistant);
            modelTranscriptBufferRef.current = "";
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
    console.log("[Realtime Call] muteMic: mutedRef set true");
    if (micTrackRef.current) micTrackRef.current.enabled = false;
  }

  function unmuteMic() {
    mutedRef.current = false;
    console.log("[Realtime Call] unmuteMic: mutedRef set false");
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
