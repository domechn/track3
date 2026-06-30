// Non-streaming LLM helper for the orchestrator.
// The orchestrator makes short, discrete LLM calls (analyze, synthesize,
// refine) that don't need streaming — this keeps the integration simple.

import { fetch } from "@tauri-apps/plugin-http";
import { getCurrentUA } from "@/middlelayers/datafetch/utils/http";
import type { LlmCallParams, LlmCallResult } from "./types";

/**
 * Make a non-streaming chat completion call and return the full
 * response.  Timeout defaults to 30 s.
 */
export async function callLlm(
  params: LlmCallParams,
  timeoutMs = 30_000,
): Promise<LlmCallResult> {
  const endpoint = (params.endpoint ?? "").trim().replace(/\/+$/, "");
  if (!endpoint) {
    return { content: "", ok: false, error: "Endpoint is empty" };
  }
  // Validate URL scheme  only http(s) allowed
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { content: "", ok: false, error: "Endpoint is not a valid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { content: "", ok: false, error: "Endpoint must use http or https scheme" };
  }
  const url = endpoint.endsWith("/chat/completions")
    ? endpoint
    : `${endpoint}/chat/completions`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": getCurrentUA(),
  };
  if (params.apiKey) {
    headers.authorization = `Bearer ${params.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: false,
  };
  if (typeof params.temperature === "number") {
    body.temperature = params.temperature;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    } as any);

    clearTimeout(timer);

    if (!resp.ok) {
      const text = await safeReadText(resp);
      return {
        content: "",
        ok: false,
        error: `LLM call failed (${resp.status}): ${text}`,
      };
    }

    const json: any = await resp.json();
    const choice = json?.choices?.[0];
    const content: string = choice?.message?.content ?? "";
    return { content, ok: true };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { content: "", ok: false, error: "LLM call timed out" };
    }
    return { content: "", ok: false, error: err?.message ?? String(err) };
  }
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}
