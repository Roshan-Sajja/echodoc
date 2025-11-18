import { NextRequest, NextResponse } from "next/server";
import { appendFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { transcript?: string[]; contextId?: string; endedAt?: string }
      | null;

    if (!body || !Array.isArray(body.transcript) || body.transcript.length === 0) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const ts = new Date().toISOString();
    const logDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logDir, "transcripts.log");
    await mkdir(logDir, { recursive: true });

    const entry = [
      `--- Transcript ${ts} ---`,
      `contextId: ${body.contextId ?? "unknown"}`,
      `endedAt: ${body.endedAt ?? "unknown"}`,
      ...body.transcript,
      "",
    ].join("\n");

    await appendFile(logFile, entry, "utf8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Save Transcript API] Error", err);
    return NextResponse.json(
      { error: "Failed to save transcript" },
      { status: 500 },
    );
  }
}
