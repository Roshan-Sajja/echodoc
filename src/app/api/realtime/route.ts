import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/contextStore";
import { getOptimizedContext } from "@/lib/contextRetrieval";
import { appendFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

async function logRealtime(message: string, data?: any) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}${data ? ` ${JSON.stringify(data)}` : ""}\n`;
  const logDir = path.join(process.cwd(), "logs");
  const logFile = path.join(logDir, "realtime.log");
  try {
    await mkdir(logDir, { recursive: true });
    await appendFile(logFile, line);
  } catch {
    // Ignore logging failures in serverless environments
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { contextId?: string; contextText?: string; query?: string }
      | null;

    if (!body || (!body.contextId && !body.contextText)) {
      console.warn("[Realtime API] Missing contextId");
      return NextResponse.json(
        { error: "contextId or contextText is required" },
        { status: 400 },
      );
    }

    const contextId = body.contextId;
    let text = contextId ? getContext(contextId) : undefined;
    if (!text && typeof body.contextText === "string") {
      text = body.contextText;
    }

    if (!text) {
      await logRealtime("Context missing", {
        contextIdProvided: Boolean(contextId),
        hadInlineText: typeof body.contextText === "string",
      });
      return NextResponse.json(
        { error: "Context not found or expired" },
        { status: 404 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[Realtime API] OPENAI_API_KEY is not set");
      await logRealtime("OPENAI_API_KEY missing");
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 },
      );
    }

    // OPTIMIZATION: Use chunking to reduce token usage
    // Voice sessions use 6 chunks for broader coverage (server VAD auto-responds before we can update per-query)
    const optimizedText = getOptimizedContext(text, body.query || null, 6);
    const wordCount = optimizedText.trim().match(/\S+/g)?.length ?? 0;
    const selectedModel =
      wordCount <= 12000 ? "gpt-realtime-mini" : "gpt-realtime";
    
    const instructions =
      "You are an assistant that helps the user talk to a document or YouTube video. " +
      "The reference chunks below ARE the document/video content itself (the PDF text or YouTube transcript). " +
      "When users refer to 'the PDF', 'the document', 'the video', or 'the transcript', they mean THIS content. " +
      "You have full access to it. Use ONLY these chunks when answering. " +
      "Answer naturally without quoting or citing sources - never use formats like 'Text: \"...\"' or 'According to the document...'. " +
      "If the answer isn't in these chunks, say you don't have that information.\n\n" +
      "REFERENCE CHUNKS (This IS the document/video content):\n" +
      optimizedText;

    await logRealtime("Preparing session config", {
      contextId,
      contextLength: text.length,
      optimizedLength: optimizedText.length,
      reductionPercent: Math.round(
        ((text.length - optimizedText.length) / text.length) * 100
      ),
      wordCount,
      selectedModel,
      hadQuery: Boolean(body.query),
      // Safe, short preview of the chunks sent to the model
      optimizedPreview: optimizedText.slice(0, 200),
    });

    const sessionConfig = {
      session: {
        type: "realtime",
        model: selectedModel,
        instructions,
        audio: {
          output: { voice: "marin" },
        },
      },
    };

    const resp = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionConfig),
      },
    );

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("[Realtime API] Realtime client secret error", {
        status: resp.status,
        statusText: resp.statusText,
        body: errorText,
      });
      await logRealtime("Client secret request failed", {
        status: resp.status,
        statusText: resp.statusText,
        body: errorText,
      });
      return NextResponse.json(
        { error: "Failed to create realtime client secret" },
        { status: 500 },
      );
    }

    const data = await resp.json();
    await logRealtime("Client secret created", {
      contextId,
      expiresAt: data?.expires_at,
      sessionModel: data?.session?.model,
    });

    return NextResponse.json({ clientSecret: data.value });
  } catch (err) {
    console.error("[Realtime API] Unexpected route error", err);
    await logRealtime("Unexpected route error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Unexpected error in realtime route" },
      { status: 500 },
    );
  }
}
