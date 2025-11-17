import { NextRequest, NextResponse } from "next/server";
import { saveContext } from "@/lib/contextStore";
import { extractTextFromPdfBuffer } from "@/lib/parsePdf";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);

    if (!formData) {
      return NextResponse.json(
        { error: "Invalid form data" },
        { status: 400 },
      );
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = await extractTextFromPdfBuffer(buffer);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Could not extract any text from this PDF." },
        { status: 400 },
      );
    }

    const contextId = saveContext(text);

    return NextResponse.json({
      contextId,
      preview: text.slice(0, 2000),
      totalChars: text.length,
    });
  } catch (err) {
    console.error("PDF upload error", err);
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 },
    );
  }
}