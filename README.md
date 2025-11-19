# EchoDoc

EchoDoc is a mobile-first Next.js application that lets you chat with the contents of uploaded PDFs or YouTube videos. Documents are processed on the server, summarized into contextual snippets, and streamed back through a chat and realtime voice interface powered by OpenAI.

## Overview

- Upload PDFs (≤ 25 MB) and extract text server-side for context-aware chat.
- Paste a YouTube URL to fetch transcripts via youtube-transcript.io and append metadata such as channel and publish date.
- Toggle captions and voice chat using OpenAI’s Realtime API for “push-to-talk” conversations.
- Dark/light themes built with Tailwind and shadcn-inspired UI primitives.
- Lightweight logging (`logs/*.log`) and context persistence (`logs/contexts.json`) to aid demos and debugging.

## Architecture

- **App Router** (`src/app`): Routes for landing page, layout, and API endpoints.
- **API Routes**:
  - `/api/upload-pdf`: Accepts multipart uploads, parses PDFs (via `pdf-parse` helper), and stores extracted text.
  - `/api/youtube-transcript`: Validates URLs, pulls transcripts from youtube-transcript.io, and persists the combined transcript + metadata.
  - `/api/realtime`: Exchanges conversation context for OpenAI Realtime client secrets and logs lifecycle events.
  - `/api/save-transcript` and `/api/log-transcription`: Capture transcript snippets for later review.
- **Context Store** (`src/lib/contextStore.ts`): In-memory `Map` with JSON persistence (`logs/contexts.json`). Suitable for demos; swap for a database in production.
- **Realtime Hook** (`src/hooks/useRealtimeTextSession.ts`): Handles WebRTC data-channel negotiation, speech buffering, and delta streaming to the UI.

## Trade-offs & Notes

- **Ephemeral storage**: Contexts/logs are file-based for simplicity. Scaling across instances would require an external store (Redis, database, object storage).
- **Client logging**: Realtime debug logging is disabled in production builds unless `NEXT_PUBLIC_REALTIME_DEBUG=true`.
- **Speech recognition**: Uses browser `SpeechRecognition` APIs, so Chrome/Safari/Edge are recommended.
- **Testing**: Manual verification is emphasized; no automated tests yet due to focus on realtime UX. The project is structured to allow Jest/Playwright coverage later.

## Requirements

- Node.js 18+ (matches Next.js 14 runtime expectations)
- npm 9+
- OpenAI API access with Realtime enabled
- youtube-transcript.io account/token (for YouTube support)

## Setup

1. **Clone & install**
   ```bash
   git clone https://github.com/Roshan-Sajja/echodoc.git
   cd echodoc
   npm install
   ```
2. **Create environment file**
   ```bash
   cp .env.local.example .env.local  # if example file exists; otherwise create manually
   ```
3. **Add secrets to `.env.local`**

   | Variable | Description |
   | --- | --- |
   | `OPENAI_API_KEY` | Server-side key for chat + realtime routes. Required. |
   | `YT_TRANSCRIPT_API_TOKEN` | Basic-auth token for youtube-transcript.io API. Required for YouTube uploads. |
   | *(optional)* `NEXT_PUBLIC_REALTIME_DEBUG` | Set to `true` to re-enable verbose realtime logs in the browser. |

4. **Run locally**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` and allow microphone access when prompted.

## Testing

Manual regression steps:

1. Upload a sample PDF and verify chat responses reference the document.
2. Submit a YouTube URL with captions enabled and confirm transcript metadata renders.
3. Start a voice chat session, speak a prompt, and monitor realtime captions.

Add Jest/Playwright tests for further testing.

## Deployment

The app is optimized for Vercel:

1. Push the repository to a public GitHub repo.
2. Create a Vercel project, import the repo, and set build command `npm run build`.
3. Configure `OPENAI_API_KEY` and `YT_TRANSCRIPT_API_TOKEN` under Vercel → Settings → Environment Variables (for Production and Preview).
4. Deploy; Vercel provides a public HTTPS URL for demos.

Logs stored under `logs/` are ignored by git and are ephemeral on serverless hosts, so no sensitive runtime artifacts are exposed. For persistent logging, integrate with a database or cloud storage service.
