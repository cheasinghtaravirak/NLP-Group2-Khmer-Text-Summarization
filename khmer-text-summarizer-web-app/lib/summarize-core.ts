import { GoogleGenerativeAI } from "@google/generative-ai";
import { gradioCall, gradioStream } from "./gradio-direct";

export type GradioModelId = "mt5-base" | "gemma-4-4b";
export type ModelId = GradioModelId | "gemini";
export type Format = "paragraph" | "bullets";
export type Length = "short" | "long";
export type SummarizeType = "general" | "meeting-minutes";

export const SPACES: Record<GradioModelId, string> = {
  "mt5-base": "lonewolf168/khmer-mt5-summarizer-demo",
  "gemma-4-4b": "lonewolf168/khmer-text-summarizer",
};

export const GEMINI_MODEL = "gemini-2.0-flash";

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function toBullets(text: string): string {
  const sentences = text
    .split(/(?<=[។?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length <= 1) return text;
  return sentences.map((s) => `- ${s}`).join("\n");
}

/**
 * Canonical, ordered list of Khmer headings used for meeting-minutes mode
 * across all three models. Single source of truth — the Gemini prompt and
 * the bold-cleanup step both read from here.
 */
export const MEETING_HEADINGS = [
  "ចំណុចពិភាក្សា",
  "សេចក្តីសម្រេចចិត្ត",
  "ភារកិច្ចដែលត្រូវធ្វើ",
  "ជំហានបន្ទាប់",
] as const;

export function toMeetingMinutes(text: string, format: Format): string {
  const sentences = text
    .split(/(?<=[។?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const total = sentences.length;
  const q1 = Math.ceil(total * 0.4);
  const q2 = Math.ceil(total * 0.7);
  const q3 = Math.ceil(total * 0.85);

  const slices: string[][] = [
    sentences.slice(0, q1),
    sentences.slice(q1, q2),
    sentences.slice(q2, q3),
    sentences.slice(q3),
  ];

  return MEETING_HEADINGS.map((heading, i) => {
    const items = slices[i];
    if (!items?.length) return null;
    const body =
      format === "bullets"
        ? items.map((s) => `  - ${s}`).join("\n")
        : items.join(" ");
    return `**${heading}:**\n${body}`;
  })
    .filter((s): s is string => s !== null)
    .join("\n\n");
}

function firstString(value: unknown): string {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  if (typeof value === "string") return value.trim();
  return "";
}

/**
 * Run the mT5 summarizer Space and return the trimmed summary string.
 * Uses the Gradio queue HTTP API directly — no SDK overhead.
 */
export async function summarizeWithMt5(
  text: string,
  numBeams: number,
  maxNewTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const out = await gradioCall(
    SPACES["mt5-base"],
    "/summarize",
    [text, numBeams, maxNewTokens],
    signal,
  );
  return firstString(out);
}

/**
 * Stream the Gemma summarizer Space token-by-token. Each yielded string is
 * the cumulative output so far (matches the Space's own behaviour).
 */
export async function* streamWithGemma(
  text: string,
  maxLength: number,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const stream = gradioStream(
    SPACES["gemma-4-4b"],
    "/summarize",
    [text, maxLength],
    signal,
  );
  for await (const data of stream) {
    const chunk = firstString(data);
    if (chunk) yield chunk;
  }
}

export function buildGeminiPrompt(
  text: string,
  format: Format,
  length: Length,
  summarizeType: SummarizeType,
): string {
  const lengthInstruction =
    length === "short"
      ? "Keep the summary concise — around 100–150 words."
      : "Provide a detailed summary — around 300–400 words.";

  const formatInstruction =
    format === "bullets"
      ? "Format the output as a bullet list. Each bullet should be a clear, standalone point."
      : "Format the output as flowing paragraphs with no bullet points.";

  if (summarizeType === "meeting-minutes") {
    const headingTemplate = MEETING_HEADINGS.map((h) => `  **${h}:**`).join("\n");
    return `You are a professional meeting-minutes writer. Analyze the following text and produce structured meeting minutes entirely in Khmer.

STRICT RULES:
- Write 100% in Khmer. Zero English words, zero English letters — not even in parentheses or brackets.
- Do NOT include any dates, metadata, or introductory lines unless they appear in the source text.
- Each section heading MUST appear on its own line in markdown bold with a trailing colon, EXACTLY in this form (do not rename, translate, or omit any heading):
${headingTemplate}
- Bold (** **) is reserved exclusively for those four section headings. Do NOT bold anything else.
- Do NOT use any other markdown formatting (no hashes, no underscores, no inline code).
- ${formatInstruction}
- ${lengthInstruction}

Text to process:
${text}`;
  }

  return `You are an expert Khmer-language summarizer. Summarize the following text accurately and naturally in Khmer.

${formatInstruction}
${lengthInstruction}
Write entirely in Khmer. Preserve the key facts, figures, and named entities from the source. Do not add information not present in the source text.

Text to summarize:
${text}`;
}

export function cleanGeminiMeetingOutput(text: string, summarizeType: string): string {
  if (summarizeType !== "meeting-minutes") return text;

  // Strip any bold wrapper the model puts around non-heading text. We only
  // want **heading:** to survive so the markdown renderer bolds exactly the
  // four section titles.
  const allowed = new Set<string>(MEETING_HEADINGS);
  const cleaned = text.replace(/\*\*([^*]+?)\*\*/g, (match, inner: string) => {
    const stripped = inner.replace(/[:\s៖]+$/u, "").trim();
    return allowed.has(stripped) ? match : inner;
  });

  return cleaned
    .replace(/\([^)]*[a-zA-Z][^)]*\)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getGeminiClient(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: GEMINI_MODEL });
}
