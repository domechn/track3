// Non-streaming LLM helper for the orchestrator.
// The orchestrator makes short, discrete LLM calls (analyze, synthesize,
// refine) that don't need streaming — this keeps the integration simple.

import { fetch } from "@tauri-apps/plugin-http";
import { getCurrentUA } from "@/middlelayers/datafetch/utils/http";
import { estimateMessages, estimateTokens, parseUsage } from "../budget";
import { redactSecrets } from "../../security/redact";
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
  for (const [key, value] of Object.entries(params.advanced?.headers ?? {})) {
    if (typeof value === "string" && !["cookie", "host", "content-length", "connection"].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: false,
  };
  if (typeof params.advanced?.top_p === "number") body.top_p = params.advanced.top_p;
  for (const [key, value] of Object.entries(params.advanced?.extraBody ?? {})) {
    if (!["model", "messages", "stream", "stream_options", "tools", "tool_choice"].includes(key)) body[key] = value;
  }
  const temperature = params.temperature ?? params.advanced?.temperature;
  if (typeof temperature === "number") body.temperature = temperature;

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  params.signal?.addEventListener("abort", onAbort, { once: true });
  if (params.signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    } as any);

    if (!resp.ok) {
      const text = await safeReadText(resp);
      return {
        content: "",
        ok: false,
        error: redactSecrets(`LLM call failed (${resp.status}): ${text}`, [params.apiKey, ...(params.secrets ?? [])]),
      };
    }

    const json: any = await resp.json();
    const choice = json?.choices?.[0];
    const content: unknown = choice?.message?.content;
    if (typeof content !== "string") {
      return { content: "", ok: false, error: "LLM response did not contain text" };
    }
    const usage = parseUsage(json?.usage) ?? {
      promptTokens: estimateMessages(params.messages as import("../types").ProviderMessage[]),
      completionTokens: estimateTokens(content),
      source: "estimated" as const,
    };
    params.onUsage?.(usage);
    return { content, ok: true, usage };
  } catch (err: any) {
    if (timedOut) {
      return { content: "", ok: false, error: "LLM call timed out" };
    }
    return { content: "", ok: false, error: redactSecrets(err?.message ?? String(err), [params.apiKey, ...(params.secrets ?? [])]) };
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener("abort", onAbort);
  }
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return (await resp.text()).slice(0, 1000);
  } catch {
    return "";
  }
}
