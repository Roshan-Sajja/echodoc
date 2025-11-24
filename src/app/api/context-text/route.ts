import { NextRequest, NextResponse } from "next/server";
import { getContext } from "@/lib/contextStore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { contextId?: string }
      | null;

    if (!body?.contextId) {
      return NextResponse.json(
        { error: "contextId is required" },
        { status: 400 },
      );
    }

    const text = getContext(body.contextId);

    if (!text) {
      return NextResponse.json(
        { error: "Context not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[Context Text API] Unexpected error", err);
    return NextResponse.json(
      { error: "Failed to fetch context text" },
      { status: 500 },
    );
  }
}
