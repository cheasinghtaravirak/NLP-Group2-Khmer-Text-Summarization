# ខ្លឹម — Khmer Text Summarizer

**Technical Specification**

| | |
| --- | --- |
| Version | 1.0 |
| Stack | Next.js 15 (App Router) on Vercel |
| Last updated | 2026-05-05 |

---

## 1. Overview

ខ្លឹម (*khlim*, "essence") is a single-page web application that turns long
Khmer-language text into clear, concise summaries. Users can input text via
four sources — direct paste, URL, PDF, or image — and choose between three
summarization models. Output is rendered live (streamed when supported), saved
to a local history, and is fully bilingual (Khmer / English).

The product is delivered as a **single Next.js application** that bundles both
the UI and the backend API into one Vercel deployment.

### High-level user flow

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Pick input  │ → │  Get text    │ → │  Configure   │ → │  Summarize   │
│  (text/url/  │   │  (paste,     │   │  (model,     │   │  (sync or    │
│   pdf/image) │   │   fetch,OCR) │   │   format,…)  │   │   streaming) │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
                                                                │
                                                                ▼
                                                   ┌──────────────────────┐
                                                   │  Render + save to    │
                                                   │  localStorage history│
                                                   └──────────────────────┘
```

---

## 2. Goals & non-goals

### Goals
- Produce high-quality Khmer summaries from long-form text.
- Accept multiple input sources without leaving the page.
- Stream model output for slow models so users see progress.
- Work in both Khmer and English with native-feeling copy.
- Deploy to Vercel with zero infrastructure beyond environment variables.

### Non-goals
- User accounts, authentication, or server-side persistence.
- Editing or post-processing summaries beyond copy / download / share.
- Real-time collaboration or multi-user history.
- Languages other than Khmer for the input text.

---

## 3. System architecture

```
                           ┌──────────────────────────┐
                           │        Browser           │
                           │  ┌────────────────────┐  │
                           │  │  Next.js client    │  │
                           │  │  (React 19, RQ,    │  │
                           │  │   shadcn/ui)       │  │
                           │  │                    │  │
                           │  │  pdfjs-dist  ◄─────┼──┼── PDF parsing
                           │  │  tesseract.js◄─────┼──┼── Khmer OCR (CDN
                           │  │                    │  │   loads worker +
                           │  │  localStorage      │  │   khm.traineddata)
                           │  └─────────┬──────────┘  │
                           └────────────┼─────────────┘
                                        │ fetch /api/*
                                        ▼
                           ┌──────────────────────────┐
                           │  Vercel (Node.js runtime)│
                           │  Next.js Route Handlers  │
                           │  ┌────────────────────┐  │
                           │  │ /api/healthz       │  │
                           │  │ /api/extract-url   │──┼─► fetch + jsdom
                           │  │ /api/summarize     │──┼─► @gradio/client │
                           │  │ /api/summarize/    │  │   @google/       │
                           │  │   stream  (SSE)    │  │   generative-ai  │
                           │  └────────────────────┘  │
                           └──────────┬───────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
        ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
        │ HF Spaces:    │    │ HF Spaces:    │    │ Google        │
        │ khmer-mt5-    │    │ khmer-text-   │    │ Generative AI │
        │ summarizer    │    │ summarizer    │    │ (Gemini 2.0   │
        │ (mT5-base)    │    │ (Gemma-4-4B)  │    │  Flash)       │
        └───────────────┘    └───────────────┘    └───────────────┘
```

The browser does all heavy file processing (PDF parsing + OCR) so the server
remains stateless and the function size stays small. The backend only acts as
a thin **summarization gateway** plus a **URL-extraction proxy**.

---

## 4. Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 15** (App Router) | Single deploy unit (UI + API) |
| Runtime | **Node.js 20+** | All API routes use the Node runtime |
| UI library | **React 19** | Server + client components |
| Styling | **Tailwind v4** + **tw-animate-css** | Theme tokens via CSS vars |
| Component kit | **shadcn/ui** + **Radix UI** primitives | 50+ components copied locally |
| Animations | **framer-motion** | Result transitions |
| Icons | **lucide-react** | Tree-shaken |
| Fonts | **next/font/google** | Outfit, Playfair Display, Space Mono, Noto Sans/Serif Khmer |
| Theming | **next-themes** | Light/dark with `class` strategy |
| Data fetching | **@tanstack/react-query** v5 | Mutations only |
| Validation | **zod** | Shared schemas client + server |
| Logging | Custom JSON-line logger | `lib/logger.ts` |
| URL extraction | **jsdom** + **@mozilla/readability** | Server-side |
| Summarization | **@gradio/client** + **@google/generative-ai** | Server-side |
| OCR | **tesseract.js** (`khm`) | Client-side |
| PDF parsing | **pdfjs-dist** | Client-side, lazy-loaded |
| Hosting | **Vercel** | `framework: "nextjs"` |

---

## 5. Project structure

```
app/
  api/
    healthz/route.ts            # GET  /api/healthz
    extract-url/route.ts        # POST /api/extract-url
    summarize/route.ts          # POST /api/summarize
    summarize/stream/route.ts   # POST /api/summarize/stream  (SSE)
  globals.css                   # Tailwind v4 theme tokens
  layout.tsx                    # Fonts + metadata
  page.tsx                      # Renders <HomeView/>
  providers.tsx                 # Theme + I18n + Query + Tooltip + Toaster
  not-found.tsx                 # 404 page

components/
  home-view.tsx                 # Main page (client component)
  input-source.tsx              # Tabbed input (text/url/pdf/image)
  history-panel.tsx             # localStorage-backed history list
  theme-provider.tsx            # next-themes wrapper
  ui/                           # shadcn/ui (Button, Card, Toast, …)

hooks/
  use-toast.ts                  # Toast state machine
  use-mobile.tsx                # Media-query hook

lib/
  schemas.ts                    # Zod schemas (request + response)
  summarize-core.ts             # Gradio + Gemini orchestration
  api-client.ts                 # React Query mutations for /api/*
  i18n.tsx                      # Khmer/English dictionary + provider
  history.ts                    # localStorage CRUD + subscription
  ocr.ts                        # PDF.js + Tesseract (browser only)
  logger.ts                     # JSON-line logger
  utils.ts                      # cn() class merger

public/
  favicon.svg
  opengraph.jpg

docs/TECHNICAL_SPEC.md          # this file
README.md
next.config.ts
postcss.config.mjs
tsconfig.json
vercel.json
.env.example
```

---

## 6. Data model

All schemas live in `lib/schemas.ts` and are used unchanged on both client and
server.

### `SummarizeTextBody`
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `text` | `string` | yes | 50–50 000 chars |
| `model` | `"mt5-base" \| "gemma-4-4b" \| "gemini"` | no | default `mt5-base` |
| `format` | `"paragraph" \| "bullets"` | no | default `paragraph` |
| `length` | `"short" \| "long"` | no | gemma + gemini only |
| `summarizeType` | `"general" \| "meeting-minutes"` | no | |
| `numBeams` | `1–8` | no | mt5-base only |
| `maxNewTokens` | `32–512` | no | mt5-base only |
| `maxLength` | `64–2048` | no | gemma only |

### `SummarizeTextResponse`
| Field | Type |
| --- | --- |
| `summary` | `string` |
| `format` | `"paragraph" \| "bullets"` |
| `model` | `string` |
| `sourceWordCount` | `number` |
| `summaryWordCount` | `number` |
| `compressionRatio` | `number` (0–1, 4 decimals) |
| `durationMs` | `number` |

### `ExtractUrlBody` / `ExtractUrlResponse`
- Body: `{ url: string }`.
- Response: `{ title?, text, siteName?, excerpt?, url, wordCount }`.

### `HistoryItem` (client-only)
Same shape as `SummarizeTextResponse` plus `{ id, createdAt, sourceText }`.
Persisted to `localStorage["distill.history"]`, capped at 50 items.

---

## 7. API contract

All routes use the **Node.js runtime** and respond with JSON unless noted.

### `GET /api/healthz`
Returns `{ "status": "ok" }`. Used for uptime checks.

### `POST /api/extract-url`
- Validates the body with `ExtractUrlBody`.
- Fetches the URL with a 15 s timeout, 5 MB cap, custom UA.
- Parses HTML through `jsdom` + `Readability`.
- Rejects pages that aren't HTML or yield < 50 chars of text.
- `maxDuration = 30` seconds.

### `POST /api/summarize`
- Validates with `SummarizeTextBody`.
- Routes to one of three backends:
  - **mt5-base** → Gradio Space `lonewolf168/khmer-mt5-summarizer-demo`,
    endpoint `/summarize`. Optionally post-processes into bullets or
    meeting-minutes section headings.
  - **gemma-4-4b** → Gradio Space `lonewolf168/khmer-text-summarizer`,
    endpoint `/summarize`. Iterates the streaming job to capture the final
    output.
  - **gemini** → `gemini-2.0-flash` via `@google/generative-ai`. Requires
    `GEMINI_API_KEY` (returns 503 if missing).
- Computes word counts and compression ratio before responding.
- `maxDuration = 60` seconds.

### `POST /api/summarize/stream`
- Same body validation; **only `gemma-4-4b` and `gemini` are accepted**.
- Responds with `Content-Type: text/event-stream`, sending `data: {json}\n\n`
  events:
  - `{ "chunk": "…" }` for partial output (cumulative, not deltas).
  - `{ "done": true, "summary": "…", … }` once with final stats.
  - `{ "error": "code", "message": "…" }` on failure.
- Headers: `Cache-Control: no-cache, no-transform`,
  `X-Accel-Buffering: no` (avoids Vercel/edge buffering).
- `maxDuration = 60` seconds.

### Error envelope
All non-2xx responses share the same shape:
```json
{ "error": "machine_code", "message": "Human-readable explanation." }
```

---

## 8. Frontend architecture

### Rendering model
- `app/page.tsx` is a **server component** that simply renders the
  `HomeView` client component. The home page is therefore statically
  prerendered (`○ /` in the build output) and hydrated on the client.
- All shadcn/ui components and feature components are tagged
  `"use client"`.

### State (in `home-view.tsx`)
| State | Purpose |
| --- | --- |
| `text` | Source text |
| `inputMode` | `text \| url \| pdf \| image` |
| `model`, `format`, `length`, `summarizeType` | Request parameters |
| `numBeams`, `maxNewTokens`, `maxLength` | Model-specific knobs |
| `isStreaming`, `streamingText`, `streamError`, `streamResult` | SSE state |
| React Query `mutate` / `data` / `isPending` / `error` | Sync request state |

### Data fetching
- Sync (`mt5-base`) goes through React Query mutations defined in
  `lib/api-client.ts` (`useSummarizeText`, `useExtractUrl`).
- Streaming (`gemma`, `gemini`) uses `fetch` + `ReadableStream` directly,
  decoding the SSE frames into events.

### History (`lib/history.ts`)
- Module-level pub/sub keeps every `useHistory()` consumer in sync without
  a global store.
- Reads/writes wrapped in `try/catch` to tolerate quota/SSR.
- Hydration happens in `useEffect` to avoid mismatches.

### i18n (`lib/i18n.tsx`)
- Two flat dictionaries (`km`, `en`), each typed by the same `Dict` shape so
  missing keys are caught at compile time.
- Locale persisted to `localStorage["distill.locale"]`.
- On change, the provider also updates `<html lang>`, `<title>`, and
  `<meta name="description">` so SEO and a11y track the active language.

### Theming
- `next-themes` with `attribute="class"`, `enableSystem`,
  `disableTransitionOnChange`.
- Light + dark palettes are CSS variables in `app/globals.css`.

---

## 9. Client-side OCR & PDF parsing

`lib/ocr.ts` is `"use client"`-only. Both libraries are **lazy-loaded** so
neither appears in the SSR bundle:

```ts
const pdfjs = await import("pdfjs-dist");
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
```

```ts
const { createWorker } = await import("tesseract.js");
const worker = await createWorker("khm", 1, { logger: … });
```

### PDF flow
1. Read all pages with `getTextContent()`.
2. If average extracted text density ≥ 100 chars/page, return that text
   directly (born-digital PDFs).
3. Otherwise, render each page to a canvas at scale 2 and send the PNG
   blob through Tesseract for Khmer OCR.

### Image flow
Image → Tesseract worker (`khm` traineddata, loaded from CDN once) → text.

The PDF and OCR chunks are dynamically imported on first use, which keeps the
home route's First Load JS at ~62 kB (vs ~172 kB if the libraries were eagerly
imported).

---

## 10. Streaming details

```
Client                         Server                    Upstream
  │ POST /api/summarize/stream    │
  │──────────────────────────────►│
  │                               │ start ReadableStream
  │                               │
  │                               │ for await chunk:
  │                               │   send({chunk: cumulative})
  │ data: {"chunk":"..."}\n\n    │◄────────────────── Gemini stream
  │◄──────────────────────────────│                or Gradio job
  │ ...                           │
  │ data: {"done":true,...}\n\n  │
  │◄──────────────────────────────│ controller.close()
```

- The frontend buffers by `\n\n`, parses each `data: …` line, and updates
  `streamingText` (chunk) or `streamResult` (done).
- Errors are sent as a single `error` event followed by `controller.close()`.

---

## 11. Configuration

### Environment variables (`.env.example`)

| Name | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | only for the Gemini model | Authenticates `@google/generative-ai`. Without it, `/api/summarize` returns 503 only when `model = "gemini"`. |
| `LOG_LEVEL` | optional | `debug` \| `info` (default) \| `warn` \| `error`. |
| `NEXT_PUBLIC_SITE_URL` | optional | Used by `metadataBase` to resolve OG image URLs. Falls back to `VERCEL_URL`, then `http://localhost:3000`. |

### `next.config.ts`
- `reactStrictMode: true`.
- `serverExternalPackages: ["jsdom", "@mozilla/readability", "@gradio/client"]`
  — keeps these CommonJS-heavy packages out of webpack's tracing so they
  resolve at runtime via `require`.
- Webpack fallback shims `canvas`, `fs`, `path` to `false` on the client.

### `vercel.json`
Just declares the framework — per-route limits live in each route file via
`export const maxDuration`.

---

## 12. Build & deploy

### Local development
```bash
npm install
cp .env.example .env.local        # add GEMINI_API_KEY if testing Gemini
npm run dev                        # http://localhost:3000
```

### Quality gates
```bash
npm run typecheck     # tsc --noEmit
npm run lint          # next lint (ESLint + next/core-web-vitals)
npm run build         # Next.js production build
```

### Vercel deployment
1. Push to GitHub.
2. Import the repo in Vercel — it auto-detects Next.js.
3. Add `GEMINI_API_KEY` under **Project Settings → Environment Variables**
   if the Gemini model should be enabled (Production + Preview).
4. Click **Deploy**.

#### Function limits (Hobby plan)

| Route | `maxDuration` | Reason |
| --- | --- | --- |
| `/api/summarize` | 60 s | Gemma cold-start + inference can exceed 30 s |
| `/api/summarize/stream` | 60 s | Same |
| `/api/extract-url` | 30 s | Bounded by 15 s remote-fetch timeout |
| `/api/healthz` | default | Trivial |

If upgraded to Pro, these can be raised to 300 s.

#### Caching & headers
- The home page is statically prerendered.
- API routes are fully dynamic (`ƒ` in build output) — no caching.
- The streaming route ships explicit `Cache-Control: no-cache, no-transform`
  and `X-Accel-Buffering: no` to prevent buffering between Vercel and the
  client.

---

## 13. Performance budget

Measured at build time:

| Route | Size | First Load JS |
| --- | --- | --- |
| `/` | 62.6 kB | 182 kB |
| Shared chunks | — | 102 kB |

Notable optimizations:
- `next/font/google` self-hosts and subsets all five font families.
- PDF.js + Tesseract loaded via dynamic `import()` on first use.
- shadcn components live in the repo, so unused ones get tree-shaken.

---

## 14. Limits & failure modes

| Scenario | Behaviour |
| --- | --- |
| Text < 50 or > 50 000 chars | 400 with Khmer/English message via toast |
| URL is non-HTTP / non-HTML / > 5 MB | 502 with specific `error` code |
| URL fetch times out (15 s) | 502 `fetch_failed`, message "Request timed out." |
| `GEMINI_API_KEY` missing for Gemini | 503 `gemini_not_configured` |
| Model returns empty string | 502 `empty_summary` |
| Gradio Space cold-start fails | 502 `summarization_failed` (cache invalidated, next call retries) |
| Streaming requested for `mt5-base` | 400 `streaming_not_supported` |
| `localStorage` unavailable / over quota | History silently no-ops |
| OCR worker fails to download | Toast with `ocrFailed`, worker promise reset on next try |

---

## 15. Security

- No PII is collected or persisted server-side.
- The URL extractor sets a custom UA and a strict 5 MB / 15 s budget; it does
  **not** follow `file://`, `gopher://`, etc. (only `http(s):`).
- `GEMINI_API_KEY` is a **server-only** env var; it is never exposed to the
  client (no `NEXT_PUBLIC_` prefix).
- All inputs go through Zod validation before reaching upstream models.

---

## 16. Future improvements (non-binding)

- Add unit tests for `summarize-core.ts` (Gradio + Gemini paths) using msw.
- Stream summaries straight into the page using React Server Actions.
- Re-implement the URL extractor on the Edge runtime for lower latency
  once `jsdom` has a slimmer alternative (e.g. `linkedom`).
- Replace the Tesseract CDN traineddata with a self-hosted asset for
  air-gapped reliability.
- Persist history per-user via Vercel KV when authentication is added.
