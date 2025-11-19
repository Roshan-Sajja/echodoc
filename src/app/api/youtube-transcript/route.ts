import { NextRequest, NextResponse } from "next/server";
import { saveContext } from "@/lib/contextStore";
import { fetchYoutubeTranscriptViaService } from "@/lib/youtubeTranscriptIo";
import ytdl from "ytdl-core";

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
    if (!ytdl.validateURL(url)) {
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

    try {
      const info = await ytdl.getBasicInfo(url);
      if (!info?.videoDetails?.videoId) {
        throw new Error("Missing video details");
      }
      videoMeta = {
        title: info.videoDetails?.title,
        authorName:
          info.videoDetails?.author?.name ?? info.videoDetails?.ownerChannelName,
        subscriberCount:
          info.videoDetails?.author?.subscriber_count?.toString() ?? undefined,
        publishedAt: info.videoDetails?.publishDate,
      };
    } catch (err: any) {
      return NextResponse.json(
        {
          error:
            err?.message ||
            "That YouTube video is unavailable or private.",
        },
        { status: 400 },
      );
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

    const contextId = saveContext(combinedText);

    return NextResponse.json({
      contextId,
      preview: combinedText.slice(0, 2000),
      totalChars: combinedText.length,
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
