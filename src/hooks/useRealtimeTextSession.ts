import { useCallback, useEffect, useRef, useState } from "react";
import { buildContextInstructions } from "@/lib/instructions";

type UseRealtimeTextSessionArgs = {
  contextId: string | null;
  onAssistantDelta?: (text: string) => void;
  onAssistantDone?: (text: string) => void;
};

type UseRealtimeTextSessionResult = {
  isReady: boolean;
  isConnecting: boolean;
  error: string | null;
  sendTextMessage: (text: string) => Promise<void>;
  isResponding: boolean;
};

const SHOULD_LOG_REALTIME_DEBUG =
  process.env.NEXT_PUBLIC_REALTIME_DEBUG === "true" ||
  process.env.NODE_ENV !== "production";

const appendWithSpacing = (current: string, delta: string) => current + delta;

const normalizeAssistantText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

const extractTextFromItem = (item: any): string => {
  if (!item) return "";
  const parts: string[] = [];

  const visit = (node: any) => {
    if (!node) return;
    if (typeof node === "string") return;

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (typeof node === "object") {
      const type = typeof node.type === "string" ? node.type.toLowerCase() : "";
      const isTextContent =
        type.includes("text") &&
        !type.includes("audio") &&
        !type.includes("transcript");

      if (isTextContent && typeof node.text === "string") {
        const raw = node.text.trim();
        if (raw && raw !== "---") {
          const normalized = normalizeAssistantText(raw);
          if (!normalized) return;
          if (parts.length === 0 || parts[parts.length - 1] !== normalized) {
            parts.push(normalized);
          }
        }
      }

      if (Array.isArray(node.content)) {
        node.content.forEach(visit);
      } else if (node.content && typeof node.content === "object") {
        visit(node.content);
      }

      if (Array.isArray(node.output)) {
        node.output.forEach(visit);
      } else if (node.output && typeof node.output === "object") {
        visit(node.output);
      }
    }
  };

  visit(item);
  return normalizeAssistantText(parts.join(" "));
};

export function useRealtimeTextSession({
  contextId,
  onAssistantDelta,
  onAssistantDone,
}: UseRealtimeTextSessionArgs): UseRealtimeTextSessionResult {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const bufferRef = useRef("");

  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assistantDeltaRef = useRef(onAssistantDelta);
  const assistantDoneRef = useRef(onAssistantDone);
  const awaitingResponseRef = useRef(false);
  const lastAssistantResponseRef = useRef("");
  const [isResponding, setIsResponding] = useState(false);
  const logEvent = useCallback((label: string, payload?: Record<string, unknown>) => {
    if (!SHOULD_LOG_REALTIME_DEBUG) return;
    console.info("[RealtimeText]", label, payload ?? {});
  }, []);

  useEffect(() => {
    assistantDeltaRef.current = onAssistantDelta;
  }, [onAssistantDelta]);

  useEffect(() => {
    assistantDoneRef.current = onAssistantDone;
  }, [onAssistantDone]);

  const finalizeAssistant = useCallback(
    (text?: string, meta?: { source?: string }) => {
      const trimmed = text?.trim?.() ?? "";
      if (!awaitingResponseRef.current) {
        return;
      }
      awaitingResponseRef.current = false;
      setIsResponding(false);
      bufferRef.current = "";
      assistantDeltaRef.current?.("");
      if (!trimmed) {
        lastAssistantResponseRef.current = "";
        return;
      }
      if (trimmed === lastAssistantResponseRef.current) {
        return;
      }
      lastAssistantResponseRef.current = trimmed;
      assistantDoneRef.current?.(trimmed);
    },
    [],
  );

  const teardown = useCallback(() => {
    setIsReady(false);
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    bufferRef.current = "";
    awaitingResponseRef.current = false;
    lastAssistantResponseRef.current = "";
    setIsResponding(false);
  }, []);

  useEffect(() => {
    if (!contextId) {
      teardown();
      return;
    }

    let aborted = false;

    const startSession = async () => {
      try {
        setIsConnecting(true);
        setError(null);
        const res = await fetch("/api/realtime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contextId }),
        });

        if (!res.ok) {
          throw new Error("Failed to start realtime session");
        }

        const { clientSecret } = await res.json();
        if (!clientSecret) {
          throw new Error("Realtime session token missing");
        }

        if (aborted) return;

        const pc = new RTCPeerConnection();
        pcRef.current = pc;
        // gpt-realtime-mini expects at least one audio m-line. Request sendrecv audio
        // with a silent track so negotiation succeeds even though we only care about text/data.
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        destination.channelCount = 1;
        destination.channelCountMode = "explicit";
        const oscillator = audioContext.createOscillator();
        oscillator.frequency.value = 0;
        oscillator.connect(destination);
        oscillator.start();
        const silentTrack = destination.stream.getAudioTracks()[0];
        silentTrack.enabled = false;
        pc.addTrack(silentTrack, destination.stream);
        pc.ontrack = () => {
          // Ignore remote audio for text-only sessions.
        };

        const dc = pc.createDataChannel("oai-text");
        dcRef.current = dc;

        dc.onopen = async () => {
          if (aborted) return;
          setIsReady(true);
          try {
            const ctxRes = await fetch("/api/context-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contextId }),
            });
            if (ctxRes.ok && dc.readyState === "open") {
              const { text } = await ctxRes.json();
              dc.send(
                JSON.stringify({
                  type: "session.update",
                  session: {
                    type: "realtime",
                    instructions: buildContextInstructions(text, {
                      passiveOnly: true,
                    }),
                  },
                }),
              );
            }
          } catch (err) {
            console.error("[RealtimeText] Failed to refresh instructions", err);
          }
        };

        dc.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const type = parsed?.type;
            if (!type) {
              logEvent("dc message missing type", { raw: parsed });
              return;
            }
            if (type === "response.output_text.delta") {
              const delta = parsed.delta ?? "";
              bufferRef.current = appendWithSpacing(bufferRef.current, delta);
              logEvent("response.output_text.delta", {
                deltaPreview: delta?.slice?.(0, 80) ?? "",
                bufferLength: bufferRef.current.length,
              });
              assistantDeltaRef.current?.(bufferRef.current);
            } else if (
              type === "response.output_text.done" ||
              type === "response.done" ||
              type === "response.completed"
            ) {
              const final = bufferRef.current.trim();
              logEvent("response.complete event", {
                type,
                finalPreview: final.slice(0, 120),
              });
              finalizeAssistant(final, { source: type });
            } else if (
              type === "conversation.item.done" &&
              parsed.item?.role === "assistant"
            ) {
              const final = extractTextFromItem(parsed.item);
              logEvent("conversation.item.done", {
                itemId: parsed.item?.id,
                finalPreview: final.slice(0, 120),
              });
              finalizeAssistant(final, {
                source: `conversation.item.done:${parsed.item?.id ?? "unknown"}`,
              });
            } else if (type === "response.error" || type === "error") {
              console.error("[RealtimeText] response error", parsed);
              setError(parsed.error?.message || "Realtime response error");
              finalizeAssistant(undefined, { source: type });
            } else if (type === "response.created") {
              logEvent("response.created", {
                responseId: parsed.response?.id ?? parsed.id,
              });
            } else {
              logEvent("dc message (unhandled type)", {
                type,
                raw: parsed,
              });
            }
          } catch (err) {
            console.error("[RealtimeText] Failed to parse data channel message", err);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp || "",
        });

        if (!sdpResponse.ok) {
          const errorSdp = await sdpResponse.text();
          throw new Error(
            `Realtime SDP negotiation failed (status ${sdpResponse.status}): ${errorSdp || "Unknown error"}`
          );
        }

        const answerSdp = await sdpResponse.text();
        const answer: RTCSessionDescriptionInit = {
          type: "answer",
          sdp: answerSdp,
        };
        await pc.setRemoteDescription(answer);

        if (!aborted) {
          setIsConnecting(false);
        }
      } catch (err: any) {
        if (!aborted) {
          console.error("[RealtimeText] Connection error", err);
          setError(err?.message || "Failed to connect to realtime session");
          setIsConnecting(false);
          teardown();
        }
      }
    };

    startSession();

    return () => {
      aborted = true;
      teardown();
    };
  }, [contextId, teardown]);

  const sendTextMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!contextId) {
        throw new Error("Please upload a document or video before chatting.");
      }
      if (awaitingResponseRef.current) {
        console.warn("[RealtimeText] Blocking sendTextMessage because assistant is still responding");
        throw new Error("Please wait for the assistant to finish responding.");
      }

      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") {
        throw new Error("Realtime session is not ready yet. Please wait a moment.");
      }

      logEvent("sendTextMessage", { contextId, text: trimmed });
      setError(null);
      bufferRef.current = "";
      assistantDeltaRef.current?.("");
      awaitingResponseRef.current = true;
      lastAssistantResponseRef.current = "";
      setIsResponding(true);

      const userEvent = {
        type: "conversation.item.create" as const,
        item: {
          type: "message" as const,
          role: "user" as const,
          content: [{ type: "input_text" as const, text: trimmed }],
        },
      };

      const responseEvent = {
        type: "response.create",
        response: {
          output_modalities: ["text"],
        },
      };

      dc.send(JSON.stringify(userEvent));
      dc.send(JSON.stringify(responseEvent));
      logEvent("sendTextMessage dispatched", { length: trimmed.length });
    },
    [contextId],
  );

  return {
    isReady,
    isConnecting,
    error,
    sendTextMessage,
    isResponding,
  };
}
