import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/contextStore";
import { getOptimizedContext } from "@/lib/contextRetrieval";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { contextId?: string; contextText?: string; query?: string; maxChunks?: number }
      | null;

    if (!body?.contextId && !body?.contextText) {
      return NextResponse.json(
        { error: "contextId or contextText is required" },
        { status: 400 },
      );
    }

    // Prefer inline contextText (works across serverless instances)
    // Fall back to contextId lookup (works locally)
    let text = body.contextText?.trim() || undefined;
    if (!text && body.contextId) {
      text = getContext(body.contextId);
    }

    if (!text) {
      return NextResponse.json(
        { error: "Context not found" },
        { status: 404 },
      );
    }

    // OPTIMIZATION: Return optimized chunks based on query
    // maxChunks defaults to 3 for text chat, but voice can request more (e.g., 6)
    const maxChunks = body.maxChunks ?? 3;
    const optimizedText = getOptimizedContext(text, body.query || null, maxChunks);

    console.info("[ContextText] optimized context", {
      contextId: body.contextId,
      hadQuery: Boolean(body.query),
      optimizedLength: optimizedText.length,
      originalLength: text.length,
      // Short preview only, to confirm which chunks are selected
      preview: optimizedText.slice(0, 200),
    });

    return NextResponse.json({
      text: optimizedText,
      originalLength: text.length,
      optimizedLength: optimizedText.length,
    });
  } catch (err) {
    console.error("[Context Text API] Unexpected error", err);
    return NextResponse.json(
      { error: "Failed to fetch context text" },
      { status: 500 },
    );
  }
}
