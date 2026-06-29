import type { ChartSpec } from "../types";

// Stream events yielded by the provider. The chat hook consumes these
// and turns them into assistant blocks.
export type StreamEvent =
  | { kind: "think"; delta: string }
  | { kind: "text"; delta: string }
  | { kind: "tool_call"; id: string; name: string; args: unknown }
  | { kind: "tool_result"; id: string; name: string; content: string }
  | { kind: "chart"; chart: ChartSpec }
  | { kind: "error"; message: string }
  | { kind: "done" };

// OpenAI-compatible role types.
export type ChatRole = "user" | "assistant" | "system" | "tool";

// Flat message format sent to the model. tool messages carry the result
// of a previous tool call so the model can read its own outputs.
export type ProviderMessage = {
  role: ChatRole;
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ProviderToolCall[];
};

export type ProviderToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ProviderFunctionDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type StreamRequest = {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: ProviderMessage[];
  tools?: ProviderFunctionDef[];
  signal?: AbortSignal;
  advanced?: import("../types").AIAdvancedOptions;
  // when true, the provider should issue a tiny smoke-test request
  // (used by the Settings → AI "Test Connection" button).
  probe?: boolean;
};

export type StreamOptions = {
  // request timeout in milliseconds. Defaults to 60s.
  timeoutMs?: number;
};
