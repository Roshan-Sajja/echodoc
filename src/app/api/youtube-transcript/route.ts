import { NextRequest, NextResponse } from "next/server";
import { saveContext } from "@/lib/contextStore";
import { fetchYoutubeTranscriptViaService } from "@/lib/youtubeTranscriptIo";

export const runtime = "nodejs";

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// Validate YouTube URL
function isValidYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

// Fetch metadata using YouTube's free oEmbed API (no API key needed)
async function fetchMetadataViaOEmbed(url: string): Promise<{
  title?: string;
  authorName?: string;
}> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    return {
      title: data.title || undefined,
      authorName: data.author_name || undefined,
    };
  } catch {
    return {};
  }
}

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
    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Please provide a valid YouTube video URL." },
        { status: 400 },
      );
    }

    let videoMeta: {
      title?: string;
      authorName?: string;
      subscriberCount?: string;
      publishedAt?: string;
    } = {};

    // Use YouTube's oEmbed API for metadata (free, no API key, reliable)
    try {
      const oembedMeta = await fetchMetadataViaOEmbed(url);
      videoMeta = {
        title: oembedMeta.title,
        authorName: oembedMeta.authorName,
      };
    } catch (err: any) {
      console.warn("[YouTube Transcript API] Failed to fetch metadata via oEmbed", err);
      // Continue without metadata rather than failing the whole request
    }

    if (
      !process.env.YT_TRANSCRIPT_API_TOKEN
    ) {
      console.error("[YouTube Transcript API] Missing YT_TRANSCRIPT_API_TOKEN");
      return NextResponse.json(
        { error: "Transcript service token is missing on the server." },
        { status: 500 },
      );
    }

    let text: string | null = null;

    try {
      text = await fetchYoutubeTranscriptViaService(url);
    } catch (err: any) {
      console.error("[YouTube Transcript API] Transcript service error", err);
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

    const metadataSection = [
      "",
      "----- YOUTUBE VIDEO METADATA -----",
      `Source URL: ${url}`,
      videoMeta.authorName ? `Channel: ${videoMeta.authorName}` : null,
      videoMeta.subscriberCount ? `Subscribers: ${videoMeta.subscriberCount}` : null,
      videoMeta.publishedAt ? `Published: ${videoMeta.publishedAt}` : null,
      "---------------------------------",
    ]
      .filter(Boolean)
      .join("\n");

    const combinedText = `${cleaned}${metadataSection}`;
    const totalWords = combinedText.trim().match(/\S+/g)?.length ?? 0;

    const contextId = saveContext(combinedText);

    return NextResponse.json({
      contextId,
      preview: combinedText.slice(0, 2000),
      totalChars: combinedText.length,
      totalWords,
      contextText: combinedText,
      metadata: {
        title: videoMeta.title ?? null,
        authorName: videoMeta.authorName ?? null,
        subscriberCount: videoMeta.subscriberCount ?? null,
        publishedAt: videoMeta.publishedAt ?? null,
      },
    });
  } catch (err) {
    console.error("[YouTube Transcript API] Unexpected route error", err);
    return NextResponse.json(
      { error: "Failed to process YouTube URL" },
      { status: 500 },
    );
  }
}
