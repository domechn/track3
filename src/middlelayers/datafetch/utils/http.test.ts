import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "./http";
import { fetch } from "@tauri-apps/plugin-http";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendHttpRequest error details", () => {
  it("includes method, endpoint path, and API message for non-2xx JSON responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 401,
      text: vi
        .fn()
        .mockResolvedValue('{"msg":"Invalid API key","code":"1002"}'),
    } as unknown as Response);

    await expect(
      sendHttpRequest(
        "GET",
        "https://api.bitget.com/api/v2/spot/account/assets?apiKey=abc&signature=xyz",
      ),
    ).rejects.toThrow(
      "Request failed (GET https://api.bitget.com/api/v2/spot/account/assets) with status 401, detail: Invalid API key, code 1002",
    );
  });

  it("redacts obvious secrets for plain-text error responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 400,
      text: vi
        .fn()
        .mockResolvedValue(
          "signature=abc123 apiKey=test-key secret=my-secret message=invalid sign",
        ),
    } as unknown as Response);

    await expect(
      sendHttpRequest("GET", "https://api.example.com/private"),
    ).rejects.toThrow(
      "Request failed (GET https://api.example.com/private) with status 400, detail: signature=<REDACTED> apiKey=<REDACTED> secret=<REDACTED> message=invalid sign",
    );
  });
});
