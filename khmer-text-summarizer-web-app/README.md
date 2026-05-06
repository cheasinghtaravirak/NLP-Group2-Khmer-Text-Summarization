# ខ្លឹម — Khmer Text Summarizer

A Next.js application that summarizes Khmer-language text using three models:

- **mT5-base** — fast Khmer summarizer hosted on Hugging Face Spaces
- **Gemma-4-4B** — higher quality, streamed token-by-token from Hugging Face Spaces
- **Gemini 2.0 Flash** — Google's hosted Gemini, streamed and configurable

It also extracts text from URLs (server-side via Readability), PDFs, and images
(client-side via PDF.js + Tesseract.js for Khmer OCR).

## Stack

- **Next.js 15** (App Router, React 19, Server Route Handlers)
- **Tailwind v4** + shadcn/ui + Radix primitives
- **TanStack Query** for client-side data fetching
- **Zod** for request/response validation
- **Vercel** for hosting

## Project layout

```
app/
  api/
    healthz/route.ts          # GET  /api/healthz
    summarize/route.ts        # POST /api/summarize
    summarize/stream/route.ts # POST /api/summarize/stream  (SSE)
    extract-url/route.ts      # POST /api/extract-url
  layout.tsx                  # Root layout + next/font fonts
  page.tsx                    # Home page
  providers.tsx               # Theme + I18n + Query + Toast providers
  globals.css                 # Tailwind v4 theme + shadcn tokens
components/                   # Feature components + shadcn UI
hooks/                        # use-toast, use-mobile
lib/
  schemas.ts                  # Zod schemas (shared by client + server)
  summarize-core.ts           # Gradio + Gemini orchestration
  api-client.ts               # React Query mutations for /api/*
  i18n.tsx                    # Khmer/English dictionary + provider
  history.ts                  # localStorage-backed summary history
  ocr.ts                      # PDF.js + Tesseract.js (browser only)
  logger.ts                   # JSON line logger for routes
public/                       # favicon.svg, opengraph.jpg
```

## Local development

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY if you want Gemini
npm run dev                   # http://localhost:3000
```

Other scripts:

```bash
npm run typecheck
npm run lint
npm run build
npm run start
```

## Environment variables

| Name              | Required | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| `GEMINI_API_KEY`  | optional | Required only when calling the Gemini model.     |
| `LOG_LEVEL`       | optional | `debug` \| `info` (default) \| `warn` \| `error` |
| `NEXT_PUBLIC_SITE_URL` | optional | Used to resolve OG image URLs in metadata.    |

The mT5 and Gemma models call public Hugging Face Spaces and require no secrets.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in Vercel — it will auto-detect Next.js.
3. Add `GEMINI_API_KEY` in **Project Settings → Environment Variables**
   (only needed for the Gemini model).
4. Deploy.

The summarize routes are configured with `maxDuration = 60` (seconds) and the
URL extraction route with `maxDuration = 30`. These match Vercel's Hobby plan
limits; bump them if you upgrade. Streaming uses `text/event-stream` so it
works behind Vercel's edge buffering.

## API

### `GET /api/healthz`

Returns `{ "status": "ok" }`.

### `POST /api/summarize`

Body:

```jsonc
{
  "text": "<50–50000 chars>",
  "model": "mt5-base | gemma-4-4b | gemini",
  "format": "paragraph | bullets",
  "length": "short | long",                // gemma + gemini
  "summarizeType": "general | meeting-minutes",
  "numBeams": 1-8,                          // mt5-base
  "maxNewTokens": 32-512,                   // mt5-base
  "maxLength": 64-2048                      // gemma-4-4b
}
```

Returns `{ summary, format, model, sourceWordCount, summaryWordCount, compressionRatio, durationMs }`.

### `POST /api/summarize/stream`

Same body, but only supports `gemma-4-4b` and `gemini`. Responds with
Server-Sent Events. Each event is `data: {json}\n\n` carrying either
`{ chunk }`, `{ done: true, ... }`, or `{ error, message }`.

### `POST /api/extract-url`

Body: `{ "url": "https://..." }`. Returns the extracted article body using
Mozilla's Readability.
