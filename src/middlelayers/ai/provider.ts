/**
 * AI provider utilities.
 *
 * Retained from the old provider module: normalizeEndpoint for URL
 * handling and probeConnection for the Settings "Test Connection" button.
 * The full streaming pipeline (streamChatCompletion) has been replaced
 * by the Pi Agent SDK's AgentSession.
 */

import { fetch } from "@tauri-apps/plugin-http";
import type { StreamRequest } from "./types";

// Normalize the endpoint so we can append /chat/completions reliably.
export function normalizeEndpoint(endpoint: string): string {
  return (endpoint ?? "").trim().replace(/\/+$/, "");
}

function buildUrl(endpoint: string, path: string): string {
  const base = normalizeEndpoint(endpoint);
  if (!base) throw new Error("AI endpoint is empty");
  if (base.endsWith(path)) return base;
  return `${base}${path}`;
}

function safeReadText(resp: Response): Promise<string> {
  try {
    return resp.text().then((t) => t.slice(0, 500));
  } catch {
    return Promise.resolve("");
  }
}

/**
 * Issue a minimal non-streaming chat completion to verify the provider
 * connection. Returns undefined on success, or an error message string.
 */
export async function probeConnection(
  req: StreamRequest,
): Promise<string | undefined> {
  const url = buildUrl(req.endpoint, "/chat/completions");
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (req.apiKey) headers.authorization = `Bearer ${req.apiKey}`;
  if (req.advanced?.headers) {
    for (const [k, v] of Object.entries(req.advanced.headers)) {
      if (typeof v === "string") headers[k] = v;
    }
  }
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        stream: false,
      }),
    } as any);
    if (resp.status > 299) {
      const text = await safeReadText(resp);
      return `Request failed with status ${resp.status}: ${text}`;
    }
    return undefined;
  } catch (err) {
    return (err as Error).message ?? String(err);
  }
}
