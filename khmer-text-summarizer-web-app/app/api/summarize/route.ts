import { NextResponse, type NextRequest } from "next/server";
import {
  SummarizeTextBody,
  SummarizeTextResponse,
} from "@/lib/schemas";
import {
  buildGeminiPrompt,
  cleanGeminiMeetingOutput,
  countWords,
  getGeminiClient,
  streamWithGemma,
  summarizeWithMt5,
  toBullets,
  toMeetingMinutes,
  type Format,
  type Length,
  type ModelId,
  type SummarizeType,
} from "@/lib/summarize-core";
import { getErrorMessage, logger, serializeError } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parseResult = SummarizeTextBody.safeParse(body);
  if (!parseResult.success) {
    logger.warn(
      { issues: parseResult.error.issues },
      "Invalid summarize request",
    );
    return NextResponse.json(
      {
        error: "invalid_request",
        message:
          parseResult.error.issues[0]?.message ??
          "Invalid request body. Provide `text` (50-50000 chars) and optional model parameters.",
      },
      { status: 400 },
    );
  }

  const data = parseResult.data;
  const model: ModelId = (data.model ?? "mt5-base") as ModelId;
  const format = (data.format ?? "paragraph") as Format;
  const length = (data.length ?? "short") as Length;
  const summarizeType = (data.summarizeType ?? "general") as SummarizeType;

  try {
    let summary = "";

    if (model === "mt5-base") {
      const numBeams = data.numBeams ?? 4;
      const maxNewTokens = data.maxNewTokens ?? 256;
      summary = await summarizeWithMt5(data.text, numBeams, maxNewTokens);
      if (summarizeType === "meeting-minutes") {
        summary = toMeetingMinutes(summary, format);
      } else if (format === "bullets") {
        summary = toBullets(summary);
      }
    } else if (model === "gemma-4-4b") {
      const maxLength = length === "short" ? 512 : 1024;
      for await (const chunk of streamWithGemma(data.text, maxLength)) {
        summary = chunk;
      }
      if (summarizeType === "meeting-minutes") {
        summary = toMeetingMinutes(summary, format);
      } else if (format === "bullets") {
        summary = toBullets(summary);
      }
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            error: "gemini_not_configured",
            message:
              "GEMINI_API_KEY is not set. Please add it in the project secrets.",
          },
          { status: 503 },
        );
      }
      const geminiModel = getGeminiClient(apiKey);
      const prompt = buildGeminiPrompt(data.text, format, length, summarizeType);
      const gemResult = await geminiModel.generateContent(prompt);
      summary = cleanGeminiMeetingOutput(
        gemResult.response.text().trim(),
        summarizeType,
      );
    }

    if (!summary) {
      logger.error({ model }, "Empty summary returned by model");
      return NextResponse.json(
        {
          error: "empty_summary",
          message: "The model did not return a summary. Please try again.",
        },
        { status: 502 },
      );
    }

    const sourceWordCount = countWords(data.text);
    const summaryWordCount = countWords(summary);
    const compressionRatio =
      sourceWordCount > 0
        ? Number((summaryWordCount / sourceWordCount).toFixed(4))
        : 0;
    const durationMs = Date.now() - startedAt;

    const payload = SummarizeTextResponse.parse({
      summary,
      format,
      model,
      sourceWordCount,
      summaryWordCount,
      compressionRatio,
      durationMs,
    });

    return NextResponse.json(payload);
  } catch (err) {
    logger.error(
      { err: serializeError(err), model },
      "Summarization failed",
    );
    return NextResponse.json(
      {
        error: "summarization_failed",
        message:
          getErrorMessage(err) ||
          "Failed to generate a summary. Please try again.",
      },
      { status: 502 },
    );
  }
}
