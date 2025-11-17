/**
 * Fetch transcript text using youtube-transcript.io service.
 * Expects an API token in YT_TRANSCRIPT_API_TOKEN.
 */
const VIDEO_ID_REGEX =
  /(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/;

function extractVideoId(urlOrId: string): string | null {
  if (!urlOrId) return null;

  if (!urlOrId.startsWith("http://") && !urlOrId.startsWith("https://")) {
    return urlOrId;
  }

  try {
    const u = new URL(urlOrId);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    const m = VIDEO_ID_REGEX.exec(urlOrId);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function pickToken(): string | null {
  return (
    process.env.YT_TRANSCRIPT_API_TOKEN ??
    null
  );
}

function coalesceTextFromTranscriptObject(obj: any): string {
  if (!obj) return "";

  if (typeof obj === "string") return obj;

  if (Array.isArray(obj)) {
    return obj
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : typeof entry?.text === "string"
            ? entry.text
            : "",
      )
      .join(" ");
  }

  if (Array.isArray(obj.transcript)) {
    return obj.transcript
      .map((entry: any) =>
        typeof entry === "string"
          ? entry
          : typeof entry?.text === "string"
            ? entry.text
            : "",
      )
      .join(" ");
  }

  if (typeof obj.transcript === "string") return obj.transcript;

  if (Array.isArray(obj.segments)) {
    return obj.segments
      .map(
        (entry: any) =>
          (typeof entry === "string"
            ? entry
            : typeof entry?.text === "string"
              ? entry.text
              : "") as string,
      )
      .join(" ");
  }

  return "";
}

export async function fetchYoutubeTranscriptViaService(
  urlOrId: string,
): Promise<string> {
  const token = pickToken();
  if (!token) {
    throw new Error(
      "YouTube transcript service token is not configured (set YT_TRANSCRIPT_API_TOKEN).",
    );
  }

  const videoId = extractVideoId(urlOrId);
  if (!videoId) {
    throw new Error("Invalid YouTube URL or video ID");
  }

  const res = await fetch("https://www.youtube-transcript.io/api/transcripts", {
    method: "POST",
    headers: {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: [videoId] }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Transcript API error ${res.status}`);
  }

  const data = await res.json().catch(() => null);

  let candidate: any = null;

  // Service can return an array directly or an object with `transcripts`
  if (Array.isArray(data)) {
    candidate = data[0];
  } else if (Array.isArray((data as any)?.transcripts)) {
    candidate = (data as any).transcripts[0];
  }

  if (!candidate) {
    throw new Error("No transcripts returned from service");
  }

  // Prefer direct text, then transcript field, then first track
  let text = coalesceTextFromTranscriptObject(candidate).trim();

  if (!text && Array.isArray(candidate?.tracks) && candidate.tracks.length) {
    // Pick English track if present, else first
    const enTrack =
      candidate.tracks.find((t: any) => t.language?.toLowerCase().startsWith("en")) ||
      candidate.tracks[0];
    text = coalesceTextFromTranscriptObject(enTrack?.transcript).trim();
  }

  if (!text) {
    throw new Error("Transcript service returned empty text");
  }

  return text;
}
