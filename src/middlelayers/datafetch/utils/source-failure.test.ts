import { describe, expect, it } from "vitest";
import { HttpRequestError } from "./http";
import { classifySourceError, recordSourceFailure, takeSourceFailure } from "./source-failure";

describe("source error categories", () => {
  it("classifies transport errors as network without reading address digits", () => {
    expect(classifySourceError(new Error("Request failed (GET https://example.test/wallet/429401)"))).toBe("network");
    expect(classifySourceError(new Error("Request timed out (GET https://example.test/wallet/403)"))).toBe("network");
  });

  it("uses HTTP status ahead of response text", () => {
    expect(classifySourceError(new HttpRequestError("Request failed (GET https://example.test/401)", 429))).toBe("rateLimit");
    expect(classifySourceError(new HttpRequestError("Request failed (GET https://example.test/429)", 403))).toBe("auth");
    expect(classifySourceError(new HttpRequestError("Request failed (GET https://example.test/429)", 503))).toBe("network");
  });

  it("uses a bad signature in an HTTP 400 response to identify an auth failure", () => {
    expect(classifySourceError(new HttpRequestError("invalid signature", 400))).toBe("auth");
  });

  it("returns a safe refresh error without the provider's credentials", () => {
    const source = {};
    recordSourceFailure(source, new Error("bad key sk-abcdefghijklmnop1234567890"));
    expect(takeSourceFailure(source)?.message).not.toContain("sk-abcdefghijklmnop1234567890");
  });
});
