import { z } from "zod";

export const HealthCheckResponse = z.object({
  status: z.literal("ok"),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponse>;

export const SummarizeRequestModel = z.enum(["mt5-base", "gemma-4-4b", "gemini"]);
export type SummarizeRequestModel = z.infer<typeof SummarizeRequestModel>;

export const SummarizeRequestFormat = z.enum(["paragraph", "bullets"]);
export type SummarizeRequestFormat = z.infer<typeof SummarizeRequestFormat>;

export const SummarizeRequestLength = z.enum(["short", "long"]);
export type SummarizeRequestLength = z.infer<typeof SummarizeRequestLength>;

export const SummarizeRequestType = z.enum(["general", "meeting-minutes"]);
export type SummarizeRequestType = z.infer<typeof SummarizeRequestType>;

export const SummarizeTextBody = z.object({
  text: z
    .string()
    .min(50, "Provide at least 50 characters of text to summarize.")
    .max(50000, "Limit text to 50,000 characters."),
  model: SummarizeRequestModel.optional(),
  format: SummarizeRequestFormat.optional(),
  length: SummarizeRequestLength.optional(),
  summarizeType: SummarizeRequestType.optional(),
  numBeams: z.number().int().min(1).max(8).optional(),
  maxNewTokens: z.number().int().min(32).max(512).optional(),
  maxLength: z.number().int().min(64).max(2048).optional(),
});
export type SummarizeTextBody = z.infer<typeof SummarizeTextBody>;

export const SummarizeTextResponse = z.object({
  summary: z.string(),
  format: SummarizeRequestFormat,
  model: z.string(),
  sourceWordCount: z.number(),
  summaryWordCount: z.number(),
  compressionRatio: z.number(),
  durationMs: z.number(),
});
export type SummarizeTextResponse = z.infer<typeof SummarizeTextResponse>;

export const ExtractUrlBody = z.object({
  url: z.string().url("Provide a valid URL."),
});
export type ExtractUrlBody = z.infer<typeof ExtractUrlBody>;

export const ExtractUrlResponse = z.object({
  title: z.string().optional(),
  text: z.string(),
  siteName: z.string().optional(),
  excerpt: z.string().optional(),
  url: z.string(),
  wordCount: z.number(),
});
export type ExtractUrlResponse = z.infer<typeof ExtractUrlResponse>;

export const ErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
