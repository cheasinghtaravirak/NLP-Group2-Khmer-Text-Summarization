import { type NextRequest } from "next/server";
import { SummarizeTextBody } from "@/lib/schemas";
import {
  buildGeminiPrompt,
  cleanGeminiMeetingOutput,
  countWords,
  getGeminiClient,
  streamWithGemma,
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
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        message: "Request body must be valid JSON.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const parseResult = SummarizeTextBody.safeParse(body);
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        message:
          parseResult.error.issues[0]?.message ?? "Invalid request body.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const data = parseResult.data;
  const model: ModelId = (data.model ?? "mt5-base") as ModelId;
  const format = (data.format ?? "paragraph") as Format;
  const length = (data.length ?? "short") as Length;
  const summarizeType = (data.summarizeType ?? "general") as SummarizeType;

  if (model !== "gemma-4-4b" && model !== "gemini") {
    return new Response(
      JSON.stringify({
        error: "streaming_not_supported",
        message: "Streaming is only supported for gemma-4-4b and gemini.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        let summary = "";

        if (model === "gemma-4-4b") {
          const maxLength = length === "short" ? 512 : 1024;
          for await (const chunk of streamWithGemma(data.text, maxLength)) {
            summary = chunk;
            send({ chunk });
          }
          // Apply meeting-minutes / bullets shaping once at the end so the
          // viewer sees the structured headings on the final result; mid-
          // stream chunks stay raw because re-bucketing every partial output
          // would jitter the rendered text.
          if (summarizeType === "meeting-minutes") {
            summary = toMeetingMinutes(summary, format);
            send({ chunk: summary });
          } else if (format === "bullets") {
            summary = toBullets(summary);
            send({ chunk: summary });
          }
        } else {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            send({
              error: "gemini_not_configured",
              message: "GEMINI_API_KEY is not set.",
            });
            controller.close();
            return;
          }
          const geminiModel = getGeminiClient(apiKey);
          const prompt = buildGeminiPrompt(data.text, format, length, summarizeType);
          const streamResult = await geminiModel.generateContentStream(prompt);
          for await (const chunk of streamResult.stream) {
            summary += chunk.text();
            send({ chunk: cleanGeminiMeetingOutput(summary, summarizeType) });
          }
        }

        if (!summary) {
          send({
            error: "empty_summary",
            message: "The model did not return a summary. Please try again.",
          });
          controller.close();
          return;
        }

        const sourceWordCount = countWords(data.text);
        const summaryWordCount = countWords(summary);
        const compressionRatio =
          sourceWordCount > 0
            ? Number((summaryWordCount / sourceWordCount).toFixed(4))
            : 0;
        const durationMs = Date.now() - startedAt;

        send({
          done: true,
          summary,
          format,
          model,
          sourceWordCount,
          summaryWordCount,
          compressionRatio,
          durationMs,
        });
        controller.close();
      } catch (err) {
        logger.error(
          { err: serializeError(err), model },
          "Streaming summarization failed",
        );
        send({
          error: "summarization_failed",
          message: getErrorMessage(err) || "Failed to generate a summary.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
