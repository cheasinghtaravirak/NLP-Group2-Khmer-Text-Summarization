type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const envLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
const minLevel = LEVELS[envLevel] ?? LEVELS.info;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Convert any thrown value into a structured, JSON-serializable shape so
 * logs never end up as the useless string `"[object Object]"`.
 *
 * Handles:
 *   - Error instances              -> { name, message, stack, cause? }
 *   - DOMException / AbortError    -> same as Error
 *   - Plain objects                -> preserves message/error/code/status,
 *                                     plus a JSON dump for unknown fields
 *   - Strings / numbers / etc.     -> { message: String(value) }
 *   - undefined / null             -> { message: "<nullish>" }
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err === null || err === undefined) {
    return { message: err === null ? "<null>" : "<undefined>" };
  }
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    if (err.stack) out.stack = err.stack;
    if ("cause" in err && err.cause !== undefined) {
      out.cause = serializeError(err.cause);
    }
    // Preserve any extra properties some libraries hang off Error objects
    // (e.g. status, code, response).
    for (const key of Object.keys(err) as (keyof Error)[]) {
      if (!(key in out)) out[key as string] = (err as never)[key];
    }
    return out;
  }
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    if (typeof e.message === "string") out.message = e.message;
    if (typeof e.error === "string") out.error = e.error;
    if (typeof e.code === "string" || typeof e.code === "number") out.code = e.code;
    if (typeof e.status === "number") out.status = e.status;
    if (typeof e.statusText === "string") out.statusText = e.statusText;
    if (!out.message) out.message = safeStringify(err);
    return out;
  }
  return { message: String(err) };
}

/** Extract a human-readable, user-facing message from any thrown value. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message) return e.message;
    if (typeof e.error === "string" && e.error) return e.error;
    return safeStringify(err);
  }
  return String(err);
}

function emit(level: LogLevel, payload: Record<string, unknown> | undefined, msg: string) {
  if (LEVELS[level] < minLevel) return;
  const line = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(payload ?? {}),
  };
  const out = safeStringify(line);
  if (level === "error" || level === "warn") {
    console.error(out);
  } else {
    console.log(out);
  }
}

export const logger = {
  debug: (payload: Record<string, unknown> | undefined, msg: string) =>
    emit("debug", payload, msg),
  info: (payload: Record<string, unknown> | undefined, msg: string) =>
    emit("info", payload, msg),
  warn: (payload: Record<string, unknown> | undefined, msg: string) =>
    emit("warn", payload, msg),
  error: (payload: Record<string, unknown> | undefined, msg: string) =>
    emit("error", payload, msg),
};
