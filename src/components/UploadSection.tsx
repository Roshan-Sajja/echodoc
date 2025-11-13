
/*
 * Handles the PDF upload step. Shows a single dropzone, pushes the file to
 * /api/upload-pdf, and surfaces progress + errors so the rest of the UI can
 * react via the onContextReady callback.
 */
import { useState } from "react";

type Props = {
  onContextReady: (contextId: string, preview: string) => void;
};

export default function UploadSection({ onContextReady }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload PDF");
      }

      onContextReady(data.contextId, data.preview);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-100">
        1. Ingest a document
      </h2>
      <p className="text-xs text-slate-300">
        Start by uploading a PDF. EchoDoc will extract the text and use it as
        context for the voice chat.
      </p>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300">
          Upload PDF (max 25 MB)
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handlePdfChange}
          className="block w-full text-xs text-slate-200 file:mr-2 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-sky-500"
        />
      </div>

      {isLoading && (
        <p className="text-xs text-slate-400">Processing PDF...</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
