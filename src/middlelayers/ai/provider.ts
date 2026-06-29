import { fetch } from "@tauri-apps/plugin-http";
import { getCurrentUA } from "../datafetch/utils/http";
import type {
  ProviderFunctionDef,
  ProviderMessage,
  ProviderToolCall,
  StreamEvent,
  StreamRequest,
} from "./types";

// Normalize the endpoint so we can append /chat/completions reliably.
export function normalizeEndpoint(endpoint: string): string {
  return (endpoint ?? "").trim().replace(/\/+$/, "");
}

function buildUrl(endpoint: string, path: string): string {
  const base = normalizeEndpoint(endpoint);
  if (!base) {
    throw new Error("AI endpoint is empty");
  }
  // If the endpoint already includes the suffix, use it as-is.
  if (base.endsWith(path)) {
    return base;
  }
  return `${base}${path}`;
}

function buildHeaders(apiKey: string, advanced?: StreamRequest["advanced"]): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": getCurrentUA(),
  };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  if (advanced?.headers) {
    for (const [k, v] of Object.entries(advanced.headers)) {
      if (typeof v === "string") {
        headers[k] = v;
      }
    }
  }
  return headers;
}

function buildBody(
  req: StreamRequest,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream,
  };
  if (stream) {
    body.stream_options = { include_usage: false };
  }
  if (req.tools && req.tools.length > 0 && !req.probe) {
    body.tools = req.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = "auto";
  }
  if (req.advanced) {
    const a = req.advanced;
    if (typeof a.temperature === "number") body.temperature = a.temperature;
    if (typeof a.top_p === "number") body.top_p = a.top_p;
    if (a.extraBody) {
      for (const [k, v] of Object.entries(a.extraBody)) {
        body[k] = v;
      }
    }
  }
  return body;
}

// Build a probe request — a tiny chat completion used by the Settings
// "Test Connection" button. Kept short to avoid spending tokens.
function buildProbeMessages(req: StreamRequest): ProviderMessage[] {
  return [
    { role: "system", content: "ping" },
    { role: "user", content: "ok" },
  ];
}

// parseSSEStream reads a fetch ReadableStream and yields parsed JSON
// payloads. The OpenAI stream protocol is `data: {json}\n\n` with a
// terminating `data: [DONE]`.
async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      // SSE events are separated by a blank line. Split into records.
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const record = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const lines = record.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            return;
          }
          if (!payload) {
            continue;
          }
          try {
            yield JSON.parse(payload);
          } catch {
            // ignore malformed chunks; some endpoints pad the stream
          }
        }
      }
    }
    // Drain any trailing data after EOF.
    const tail = buffer.trim();
    if (tail.startsWith("data:") && tail.slice(5).trim() !== "[DONE]") {
      try {
        yield JSON.parse(tail.slice(5).trim());
      } catch {
        // ignore
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

// Extract the first choice delta/message from a chunk. Some endpoints
// return multiple choices; we always pick the first.
function pickChoice(chunk: any): any {
  const choices = chunk?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }
  return choices[0];
}

function safeParseArgs(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { __raw: raw };
  }
}

// Accumulate streamed tool calls. The OpenAI streaming protocol sends
// tool call fragments across many chunks, indexed by `index`. We glue
// them together so the consumer sees a single tool call per id.
type ToolCallAcc = {
  id: string;
  name: string;
  args: string;
};

function mergeToolCall(acc: ToolCallAcc | undefined, frag: any): ToolCallAcc {
  const id = frag?.id ?? acc?.id ?? "";
  const fn = frag?.function ?? {};
  const name = (fn.name as string) ?? acc?.name ?? "";
  const args = ((acc?.args ?? "") + (fn.arguments ?? "")).slice(
    0,
    1024 * 1024,
  );
  return { id, name, args };
}

// streamChatCompletion yields a sequence of StreamEvents for a single
// request. It supports both streaming and non-streaming endpoints: if
// the response is not SSE it falls back to a single JSON event.
export async function* streamChatCompletion(
  req: StreamRequest,
): AsyncGenerator<StreamEvent> {
  if (req.signal?.aborted) {
    yield { kind: "done" };
    return;
  }

  const url = buildUrl(req.endpoint, "/chat/completions");
  const headers = buildHeaders(req.apiKey, req.advanced);
  const body = buildBody(
    req.probe
      ? { ...req, messages: buildProbeMessages(req) }
      : req,
    true,
  );

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    } as any);
  } catch (err) {
    if (req.signal?.aborted) {
      yield { kind: "done" };
      return;
    }
    yield { kind: "error", message: (err as Error).message ?? String(err) };
    yield { kind: "done" };
    return;
  }

  if (resp.status > 299) {
    const text = await safeReadText(resp);
    yield {
      kind: "error",
      message: `Request failed with status ${resp.status}: ${text}`,
    };
    yield { kind: "done" };
    return;
  }

  const contentType = resp.headers.get("content-type") ?? "";
  const isEventStream = contentType.includes("text/event-stream");

  if (!isEventStream || !resp.body) {
    // Non-streaming JSON fallback. Some endpoints ignore `stream: true`.
    try {
      const json = await resp.json();
      const choice = pickChoice(json);
      const message = choice?.message ?? {};
      if (typeof message?.content === "string" && message.content.length > 0) {
        yield { kind: "text", delta: message.content };
      }
      const calls: ProviderToolCall[] = Array.isArray(message?.tool_calls)
        ? message.tool_calls
        : [];
      for (const c of calls) {
        const fn = c?.function ?? {};
        yield {
          kind: "tool_call",
          id: c.id ?? "",
          name: fn.name ?? "",
          args: safeParseArgs(fn.arguments ?? "{}"),
        };
      }
    } catch (err) {
      yield { kind: "error", message: (err as Error).message ?? String(err) };
    }
    yield { kind: "done" };
    return;
  }

  const toolAcc: Record<number, ToolCallAcc> = {};
  let finishReason: string | undefined;

  try {
    for await (const chunk of parseSSEStream(resp.body)) {
      if (req.signal?.aborted) {
        break;
      }
      const choice = pickChoice(chunk);
      if (!choice) {
        continue;
      }
      const delta = choice.delta ?? choice.message ?? {};
      const thinkContent = delta?.reasoning_content;
      if (typeof thinkContent === "string" && thinkContent.length > 0) {
        yield { kind: "think", delta: thinkContent };
      }
      const content = delta?.content;
      if (typeof content === "string" && content.length > 0) {
        yield { kind: "text", delta: content };
      }
      const toolCalls = delta?.tool_calls;
      if (Array.isArray(toolCalls)) {
        for (const frag of toolCalls) {
          const idx = typeof frag?.index === "number" ? frag.index : 0;
          toolAcc[idx] = mergeToolCall(toolAcc[idx], frag);
        }
      }
      if (typeof choice.finish_reason === "string" && choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }
  } catch (err) {
    if (!req.signal?.aborted) {
      yield { kind: "error", message: (err as Error).message ?? String(err) };
    }
  }

  // Emit accumulated tool calls in index order.
  const ordered = Object.keys(toolAcc)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((k) => toolAcc[k])
    .filter((c) => c && (c.id || c.name));

  for (const c of ordered) {
    yield {
      kind: "tool_call",
      id: c.id,
      name: c.name,
      args: safeParseArgs(c.args),
    };
  }

  if (finishReason) {
    yield { kind: "done", reason: finishReason };
  } else {
    yield { kind: "done" };
  }
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

// Provider-agnostic endpoint probe. Issues a tiny chat completion and
// returns the error message if the request fails, otherwise undefined.
export async function probeConnection(req: StreamRequest): Promise<string | undefined> {
  let lastError: string | undefined;
  for await (const ev of streamChatCompletion({ ...req, probe: true })) {
    if (ev.kind === "error") {
      lastError = ev.message;
    }
    if (ev.kind === "done") {
      break;
    }
  }
  return lastError;
}
