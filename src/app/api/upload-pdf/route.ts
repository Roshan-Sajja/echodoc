import { NextRequest, NextResponse } from "next/server";
import { saveContext } from "@/lib/contextStore";
import { extractTextFromPdfBuffer } from "@/lib/parsePdf";

const MAX_CONTEXT_CHARS = 12_000;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);

    if (!formData) {
      console.warn("[Upload PDF API] Invalid form data");
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 },
      );
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      console.warn("[Upload PDF API] No file provided");
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 },
      );
    }

    const maxBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxBytes) {
      console.warn("[Upload PDF API] File too large", { size: file.size });
      return NextResponse.json(
        { error: "PDF files must be 25MB or smaller." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = await extractTextFromPdfBuffer(buffer);

    if (!text.trim()) {
      console.warn("[Upload PDF API] Extracted text was empty");
      return NextResponse.json(
        { error: "Could not extract any text from this PDF." },
        { status: 400 },
      );
    }

    const trimmed = text.slice(0, MAX_CONTEXT_CHARS);
    const contextId = saveContext(trimmed);

    return NextResponse.json({
      contextId,
      preview: text.slice(0, 2000),
      totalChars: text.length,
      contextText: trimmed,
    });
  } catch (err) {
    console.error("[Upload PDF API] PDF upload error", err);
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 },
    );
  }
}
