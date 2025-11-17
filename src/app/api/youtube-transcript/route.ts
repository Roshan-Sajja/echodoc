import { NextRequest, NextResponse } from "next/server";
import { saveContext } from "@/lib/contextStore";
import { fetchYoutubeTranscriptViaService } from "@/lib/youtubeTranscriptIo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { url?: string }
      | null;

    if (!body || !body.url) {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 },
      );
    }

    const { url } = body;

    if (
      !process.env.YT_TRANSCRIPT_API_TOKEN
    ) {
      return NextResponse.json(
        { error: "Transcript service token is missing on the server." },
        { status: 500 },
      );
    }

    let text: string | null = null;

    try {
      text = await fetchYoutubeTranscriptViaService(url);
    } catch (err: any) {
      console.error("YouTube transcript service error:", err);
      return NextResponse.json(
        {
          error:
            err?.message ||
            "No transcript available for this video.",
        },
        { status: 502 },
      );
    }

    const cleaned = text.trim();

    if (!cleaned) {
      return NextResponse.json(
        { error: "No transcript text available for this video" },
        { status: 400 },
      );
    }

    const contextId = saveContext(cleaned);

    return NextResponse.json({
      contextId,
      preview: cleaned.slice(0, 2000),
      totalChars: cleaned.length,
    });
  } catch (err) {
    console.error("YouTube transcript route error:", err);
    return NextResponse.json(
      { error: "Failed to process YouTube URL" },
      { status: 500 },
    );
  }
}
