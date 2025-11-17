// src/lib/parsePdf.ts

const pdfParseModule = require("pdf-parse/lib/pdf-parse") as any;
const pdfParse = pdfParseModule.default || pdfParseModule;

export async function extractTextFromPdfBuffer(
  buffer: Buffer,
): Promise<string> {
  const result = await pdfParse(buffer);
  const text: string = result?.text || "";
  return text.trim();
}