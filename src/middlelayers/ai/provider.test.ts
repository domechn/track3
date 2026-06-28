import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import { normalizeEndpoint, probeConnection } from "./provider";
import type { StreamRequest } from "./types";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeErrorResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

const baseReq: StreamRequest = {
  endpoint: "https://api.openai.com/v1",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "ping" }],
};

beforeEach(() => {
  vi.mocked(fetch).mockReset();
});

describe("normalizeEndpoint", () => {
  it("strips trailing slashes", () => {
    expect(normalizeEndpoint("https://x.test/v1///")).toBe(
      "https://x.test/v1",
    );
  });
  it("trims whitespace", () => {
    expect(normalizeEndpoint("  https://x.test/v1  ")).toBe(
      "https://x.test/v1",
    );
  });
});

describe("probeConnection", () => {
  it("returns undefined when the endpoint replies successfully", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({ choices: [{ message: { content: "ok" } }] }) as any,
    );
    const err = await probeConnection(baseReq);
    expect(err).toBeUndefined();
  });

  it("returns the error message when the endpoint returns 4xx", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(403, "nope") as any);
    const err = await probeConnection(baseReq);
    expect(err).toContain("403");
  });
});
