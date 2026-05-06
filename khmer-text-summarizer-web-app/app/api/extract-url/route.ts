import { NextResponse, type NextRequest } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import {
  ExtractUrlBody,
  ExtractUrlResponse as ExtractUrlResponseSchema,
} from "@/lib/schemas";
import { logger, serializeError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

const FETCH_TIMEOUT_MS = 15000;
const MAX_BYTES = 5 * 1024 * 1024;

function isHttpUrl(input: string): URL | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parseResult = ExtractUrlBody.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message:
          parseResult.error.issues[0]?.message ??
          "Invalid request body. Provide a `url` field.",
      },
      { status: 400 },
    );
  }

  const url = isHttpUrl(parseResult.data.url);
  if (!url) {
    return NextResponse.json(
      { error: "invalid_url", message: "URL must be an http(s) URL." },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KhlumSummarizer/1.0; +https://khlum.app)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "km,en;q=0.8",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "fetch_failed",
          message: `Remote server returned ${response.status}.`,
        },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      return NextResponse.json(
        {
          error: "unsupported_content_type",
          message: `Unsupported content type: ${contentType || "unknown"}.`,
        },
        { status: 502 },
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: "fetch_failed", message: "Empty response from remote server." },
        { status: 502 },
      );
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json(
          {
            error: "page_too_large",
            message: "Page exceeds maximum size (5 MB).",
          },
          { status: 502 },
        );
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    const html = buffer.toString("utf-8");

    const dom = new JSDOM(html, { url: url.toString() });
    const reader2 = new Readability(dom.window.document);
    const article = reader2.parse();

    if (
      !article ||
      !article.textContent ||
      article.textContent.trim().length < 50
    ) {
      return NextResponse.json(
        {
          error: "extraction_failed",
          message:
            "Could not extract readable article content from this page.",
        },
        { status: 502 },
      );
    }

    const text = article.textContent
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const wordCount = countWords(text);

    const payload = ExtractUrlResponseSchema.parse({
      title: article.title ?? undefined,
      text,
      siteName: article.siteName ?? undefined,
      excerpt: article.excerpt ?? undefined,
      url: url.toString(),
      wordCount,
    });

    return NextResponse.json(payload);
  } catch (err) {
    logger.error(
      { err: serializeError(err), url: url.toString() },
      "URL extraction failed",
    );
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Request timed out."
          : err.message
        : "Failed to fetch URL.";
    return NextResponse.json(
      { error: "fetch_failed", message },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
