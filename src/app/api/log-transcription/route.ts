import { NextRequest, NextResponse } from "next/server";
import { appendFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as any;
    const ts = new Date().toISOString();
    const logDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logDir, "transcription-events.log");
    await mkdir(logDir, { recursive: true });
    const line = `[${ts}] ${JSON.stringify(body)}\n`;
    await appendFile(logFile, line, "utf8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Log Transcription API] Error", err);
    return NextResponse.json({ error: "Failed to log transcription event" }, { status: 500 });
  }
}
