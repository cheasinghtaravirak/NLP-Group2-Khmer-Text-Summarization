/**
 * Tiny direct HTTP client for the public Hugging Face Gradio queue API.
 *
 * The official `@gradio/client` SDK is convenient but adds a heavy
 * connect/handshake step (config fetch, session setup, optional websocket)
 * that costs 500–1500 ms before the first token. This module skips all of
 * that and talks to the Space the same way the HF web UI does:
 *
 *   1. POST /gradio_api/call/{api_name}        body { data: [...] }
 *      → { event_id: string }
 *   2. GET  /gradio_api/call/{api_name}/{event_id}
 *      → SSE stream with `generating` / `complete` / `error` events
 *
 * No connect step, no websocket, no SDK bloat — works on any runtime that
 * supports `fetch` + `ReadableStream` (including Vercel Edge).
 */

/** Convert an HF repo id like "user/repo" into its `*.hf.space` host. */
function spaceHost(repo: string): string {
  const sub = repo.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `https://${sub}.hf.space`;
}

type ParsedEvent = { event: string; data: string };

/**
 * HF Spaces emit `event: error` with a JSON body like
 *   {"error":"ZeroGPU quota exceeded","duration":10,"title":"..."}
 * Pull out the most useful human-readable string and fall back to the
 * raw payload if the body isn't JSON.
 */
function formatGradioError(rawData: string): string {
  if (!rawData) return "unknown error";
  try {
    const parsed = JSON.parse(rawData) as Record<string, unknown>;
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.title === "string") return parsed.title;
  } catch {
    // not JSON — fall through
  }
  return rawData;
}

/** Parse a Gradio SSE response body into discrete events. */
async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        if (!block.trim()) continue;
        let event = "message";
        const dataLines: string[] = [];
        for (const rawLine of block.split("\n")) {
          const line = rawLine.replace(/\r$/, "");
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
          // ignore `id:`, `retry:`, comments
        }
        yield { event, data: dataLines.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

type SubmitHandle = { host: string; apiPath: string; eventId: string };

/**
 * POST the payload to the Space's queue. Retries once on transient
 * failure (sleeping/booting Space, network blip).
 */
async function gradioSubmit(
  repo: string,
  apiName: string,
  data: unknown[],
  signal?: AbortSignal,
): Promise<SubmitHandle> {
  const host = spaceHost(repo);
  const apiPath = apiName.startsWith("/") ? apiName.slice(1) : apiName;
  const url = `${host}/gradio_api/call/${apiPath}`;

  const attempt = async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(
        `Gradio submit failed (${res.status} ${res.statusText}): ${text.slice(0, 300)}`,
      );
      (err as Error & { status: number }).status = res.status;
      throw err;
    }
    const body = (await res.json()) as { event_id?: string };
    if (!body.event_id) throw new Error("Gradio submit returned no event_id");
    return { host, apiPath, eventId: body.event_id };
  };

  try {
    return await attempt();
  } catch (firstErr) {
    // One retry — covers HF Space cold-boot and transient network blips.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      return await attempt();
    } catch {
      throw firstErr;
    }
  }
}

/** Open the SSE stream for a previously-submitted event_id. */
async function openEventStream(
  handle: SubmitHandle,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const url = `${handle.host}/gradio_api/call/${handle.apiPath}/${handle.eventId}`;
  const res = await fetch(url, {
    headers: { Accept: "text/event-stream" },
    signal,
  });
  if (!res.ok || !res.body) {
    const text = res.body ? await res.text().catch(() => "") : "";
    const err = new Error(
      `Gradio stream failed (${res.status} ${res.statusText}): ${text.slice(0, 300)}`,
    );
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.body;
}

/**
 * Single-shot call: returns the Gradio function's output array.
 * Equivalent to `client.predict(apiName, data)` with the SDK.
 */
export async function gradioCall(
  repo: string,
  apiName: string,
  data: unknown[],
  signal?: AbortSignal,
): Promise<unknown[]> {
  const handle = await gradioSubmit(repo, apiName, data, signal);
  const stream = await openEventStream(handle, signal);
  for await (const evt of parseSseStream(stream)) {
    if (evt.event === "complete") {
      return JSON.parse(evt.data) as unknown[];
    }
    if (evt.event === "error") {
      throw new Error(formatGradioError(evt.data));
    }
    // ignore `generating`, `heartbeat`, etc.
  }
  throw new Error("Gradio stream ended without a complete event");
}

/**
 * Streaming call: yields the data array from each `generating` event and
 * finally the `complete` event. Equivalent to iterating `client.submit(...)`.
 */
export async function* gradioStream(
  repo: string,
  apiName: string,
  data: unknown[],
  signal?: AbortSignal,
): AsyncGenerator<unknown[]> {
  const handle = await gradioSubmit(repo, apiName, data, signal);
  const stream = await openEventStream(handle, signal);
  for await (const evt of parseSseStream(stream)) {
    if (evt.event === "generating" || evt.event === "complete") {
      const parsed = JSON.parse(evt.data) as unknown[];
      yield parsed;
      if (evt.event === "complete") return;
    } else if (evt.event === "error") {
      throw new Error(formatGradioError(evt.data));
    }
    // ignore `heartbeat` and unknown events
  }
  throw new Error("Gradio stream ended without a complete event");
}
