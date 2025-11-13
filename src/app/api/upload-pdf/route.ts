/**
 * API endpoint that accepts a PDF file, extracts the text with `pdf-parse`,
 * and writes it into a lightweight in-memory store so the chat UI can grab
 * a context ID plus a quick preview. Written for humans: if the file is missing,
 * too large, or unreadable, we bail early with friendly JSON errors.
 */
import { NextRequest, NextResponse } from "next/server";
import * as pdfParse from "pdf-parse";
import { saveContext } from "@/lib/contextStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be <= 25MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const data = await (pdfParse as any)(buffer);

    const text = data.text || "";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No extractable text found in PDF" },
        { status: 400 }
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
      { status: 500 }
    );
  }
}
