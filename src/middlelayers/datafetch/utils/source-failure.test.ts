import { describe, expect, it } from "vitest";
import { HttpRequestError } from "./http";
import { classifySourceError, recordOptionalSourceFailure, recordSourceFailure, safePartialEndpoint, takeOptionalSourceFailures, takeSourceFailure } from "./source-failure";

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

  it("ignores endpoint labels outside the approved catalog", () => {
    const source = {};
    recordOptionalSourceFailure(source, new Error("network error"), "constructor");
    expect(takeOptionalSourceFailures(source)).toBeUndefined();
  });

  it("ignores HTTP permission errors for ordinary optional products", () => {
    const source = {};
    recordOptionalSourceFailure(source, new HttpRequestError("forbidden", 403), "Earn");
    expect(takeOptionalSourceFailures(source)).toBeUndefined();
  });

  it("ignores permission messages even without an HTTP status", () => {
    const source = {};
    recordOptionalSourceFailure(source, new Error("permission denied"), "Futures");
    expect(takeOptionalSourceFailures(source)).toBeUndefined();
  });

  it("keeps the disabled-product skip for Coinbase responses other than 401 or 403", () => {
    const source = {};
    recordOptionalSourceFailure(source, new HttpRequestError("not enabled", 400), "Portfolio INTX", true);
    expect(takeOptionalSourceFailures(source)).toBeUndefined();
  });

  it("keeps auth failures for non-default Coinbase portfolio types", () => {
    const source = {};
    recordOptionalSourceFailure(source, new HttpRequestError("unauthorized", 401), "Portfolio FUTURES", true);
    expect(takeOptionalSourceFailures(source)).toEqual({ category: "auth", endpoints: ["Portfolio FUTURES"] });
    expect(safePartialEndpoint("Portfolio DEFAULT")).toBeUndefined();
  });
});
