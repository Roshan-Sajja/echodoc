# EchoDoc

EchoDoc is a mobile first web app that lets you chat with your documents and YouTube videos. Upload a PDF or paste a YouTube link, and the app extracts the text on the server so you can interact with it through a simple chat interface.

This project uses Next.js, TypeScript, Tailwind, and server side text extraction. Voice chat and OpenAI Realtime integration are planned next.

## Features

- Upload PDFs up to 25 MB
- YouTube URL support (transcript route ready)
- Clean mobile friendly chat UI
- Dark and light themes
- In memory context storage

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind
- **Backend:** Next.js API routes, pdf-parse
- **Design:** shadcn style components, Radix primitives

## Getting Started

```bash
npm install
npm run dev
```

Add your environment variables to `.env.local`:

```env
OPENAI_API_KEY=your_api_key_here
```

Open `http://localhost:3000` to view EchoDoc.
