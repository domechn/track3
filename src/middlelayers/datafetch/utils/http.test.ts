import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HttpRequestError,
  retryOnHttpStatus,
  sendHttpRequest,
  sendHttpTextRequest,
} from "./http";
import { fetch } from "@tauri-apps/plugin-http";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function pendingPromise<T>() {
  return new Promise<T>(() => {});
}

async function outcomeAfter<T>(promise: Promise<T>, timeout: number) {
  const outcome: {
    status: "pending" | "fulfilled" | "rejected";
    error?: unknown;
  } = { status: "pending" };
  void promise.then(
    () => {
      outcome.status = "fulfilled";
    },
    (error) => {
      outcome.status = "rejected";
      outcome.error = error;
    },
  );

  await vi.advanceTimersByTimeAsync(timeout);
  return outcome;
}

function expectTimedRequest(timeout: number) {
  const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit & {
    connectTimeout?: number;
  };
  expect(init.connectTimeout).toBe(timeout);
  expect(init.signal).toBeInstanceOf(AbortSignal);
  expect(init.signal?.aborted).toBe(true);
}

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

  it("redacts standalone provider keys in an HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 401, text: vi.fn().mockResolvedValue("invalid sk-abcdefghijklmnop1234567890"),
    } as unknown as Response);
    await expect(sendHttpTextRequest("GET", "https://api.example.com/private")).rejects.not.toThrow("sk-abcdefghijklmnop1234567890");
  });

  it("redacts secret-shaped response codes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 401,
      text: vi.fn().mockResolvedValue('{"msg":"request rejected","code":"sk-abcdefghijklmnop1234567890"}'),
    } as unknown as Response);
    await expect(sendHttpRequest("GET", "https://api.example.com/private"))
      .rejects.not.toThrow("sk-abcdefghijklmnop1234567890");
  });

  it("uses the sanitized HTTP error for text responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 403,
      text: vi
        .fn()
        .mockResolvedValue(
          "token=body-token password=body-password access denied",
        ),
    } as unknown as Response);

    await expect(
      sendHttpTextRequest(
        "GET",
        "https://api.example.com/private?apiKey=query-secret",
      ),
    ).rejects.toThrow(
      "Request failed (GET https://api.example.com/private) with status 403, detail: token=<REDACTED> password=<REDACTED> access denied",
    );
  });

  it("does not leak parser errors or response secrets", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      json: vi
        .fn()
        .mockRejectedValue(
          new Error("Unexpected token in secret=body-secret"),
        ),
    } as unknown as Response);

    const error = await sendHttpRequest(
      "GET",
      "https://api.example.com/data?token=query-secret",
    ).catch((reason: unknown) => reason);

    expect(error).toEqual(
      new Error(
        "Request failed (GET https://api.example.com/data) while parsing JSON response",
      ),
    );
    expect(String(error)).not.toContain("body-secret");
    expect(String(error)).not.toContain("query-secret");
  });

  it("does not leak text reader errors or response secrets", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      text: vi
        .fn()
        .mockRejectedValue(new Error("stream failed secret=body-secret")),
    } as unknown as Response);

    const error = await sendHttpTextRequest(
      "GET",
      "https://api.example.com/data?token=query-secret",
    ).catch((reason: unknown) => reason);

    expect(error).toEqual(
      new Error(
        "Request failed (GET https://api.example.com/data) while reading text response",
      ),
    );
    expect(String(error)).not.toContain("body-secret");
    expect(String(error)).not.toContain("query-secret");
  });

  it("does not leak transport errors or URL secrets", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      new Error("network failed for apiKey=query-secret"),
    );

    const error = await sendHttpRequest(
      "GET",
      "https://api.example.com/data?apiKey=query-secret",
    ).catch((reason: unknown) => reason);

    expect(error).toEqual(
      new Error("Request failed (GET https://api.example.com/data)"),
    );
    expect(String(error)).not.toContain("query-secret");
  });
});

describe("total request timeout", () => {
  it("times out and aborts a stalled JSON fetch", async () => {
    vi.mocked(fetch).mockReturnValueOnce(pendingPromise<Response>());

    const outcome = await outcomeAfter(
      sendHttpRequest(
        "GET",
        "https://api.example.com/data?token=query-secret",
        25,
      ),
      25,
    );

    expect(outcome).toEqual({
      status: "rejected",
      error: new Error(
        "Request timed out (GET https://api.example.com/data) after 25ms",
      ),
    });
    expectTimedRequest(25);
  });

  it("times out and aborts a stalled text fetch", async () => {
    vi.mocked(fetch).mockReturnValueOnce(pendingPromise<Response>());

    const outcome = await outcomeAfter(
      sendHttpTextRequest(
        "GET",
        "https://api.example.com/data?token=query-secret",
        25,
      ),
      25,
    );

    expect(outcome).toEqual({
      status: "rejected",
      error: new Error(
        "Request timed out (GET https://api.example.com/data) after 25ms",
      ),
    });
    expectTimedRequest(25);
  });

  it("times out while parsing a stalled JSON body", async () => {
    const json = vi.fn().mockReturnValue(pendingPromise<unknown>());
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      json,
    } as unknown as Response);

    const outcome = await outcomeAfter(
      sendHttpRequest("GET", "https://api.example.com/data", 25),
      25,
    );

    expect(json).toHaveBeenCalledOnce();
    expect(outcome).toEqual({
      status: "rejected",
      error: new Error(
        "Request timed out (GET https://api.example.com/data) after 25ms",
      ),
    });
    expectTimedRequest(25);
  });

  it("times out while reading a stalled text body", async () => {
    const text = vi.fn().mockReturnValue(pendingPromise<string>());
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      text,
    } as unknown as Response);

    const outcome = await outcomeAfter(
      sendHttpTextRequest("GET", "https://api.example.com/data", 25),
      25,
    );

    expect(text).toHaveBeenCalledOnce();
    expect(outcome).toEqual({
      status: "rejected",
      error: new Error(
        "Request timed out (GET https://api.example.com/data) after 25ms",
      ),
    });
    expectTimedRequest(25);
  });

  it("clears timeout timers after JSON and text requests settle", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        status: 200,
        json: vi.fn().mockResolvedValue({ ok: true }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 200,
        text: vi.fn().mockResolvedValue("ok"),
      } as unknown as Response);

    await sendHttpRequest("GET", "https://api.example.com/data", 25);
    await sendHttpTextRequest("GET", "https://api.example.com/data", 25);

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("429 retry utilities", () => {
  it("captures status and retry-after metadata from 429 responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 429,
      headers: new Headers({
        "Retry-After": "2",
      }),
      text: vi.fn().mockResolvedValue("[API Gateway] Too many requests"),
    } as unknown as Response);

    const error = await sendHttpRequest(
      "GET",
      "https://lite-api.jup.ag/ultra/v1/holdings/address",
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpRequestError);
    expect((error as HttpRequestError).status).toBe(429);
    expect((error as HttpRequestError).retryAfterMs).toBe(2000);
  });

  it("retries on 429 and honors retry-after delay", async () => {
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new HttpRequestError("too many requests", 429, 2000),
      )
      .mockResolvedValueOnce("ok");

    const promise = retryOnHttpStatus(attempt, {
      status: 429,
      maxRetries: 2,
      baseDelayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(1999);
    expect(attempt).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failed request just because a wallet URL contains 429", async () => {
    const attempt = vi.fn<() => Promise<string>>()
      .mockRejectedValue(new Error("Request failed (GET https://example.test/wallet/429401)"));
    const result = retryOnHttpStatus(attempt, { status: 429, maxRetries: 1, baseDelayMs: 10 });
    const rejected = expect(result).rejects.toThrow("Request failed");
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("caps an excessive retry-after delay at maxDelayMs", async () => {
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new HttpRequestError("too many requests", 429, 3_600_000),
      )
      .mockResolvedValueOnce("ok");

    const promise = retryOnHttpStatus(attempt, {
      status: 429,
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 5000,
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(attempt).toHaveBeenCalledTimes(2);
    await expect(promise).resolves.toBe("ok");
  });
});
