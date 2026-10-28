import { describe, expect, it } from "vitest";
import { HttpRequestError } from "./http";
import { classifySourceError, recordOptionalSourceFailure, recordSourceFailure, safePartialEndpoint, takeOptionalSourceFailures, takeSourceFailure } from "./source-failure";

describe("source error categories", () => {
  const proEndpoint = "https://track3-pro-api.domc.me/api/erc20/assetsBalances";

  it("classifies a Pro API 500 as a service failure and preserves only approved detail", () => {
    const error = new HttpRequestError("Request failed", 500, undefined, {
      endpoint: proEndpoint, serverMessage: "ERC20 balance provider is not configured",
    });
    expect(classifySourceError(error)).toBe("service");
    const source = {};
    recordSourceFailure(source, error);
    expect(takeSourceFailure(source)).toMatchObject({
      category: "service", message: "Pro service error",
      detail: "ERC20 balance provider is not configured",
    });
  });

  it("keeps Pro upstream timeouts and HTTP 504 as network failures", () => {
    expect(classifySourceError(new HttpRequestError("Request failed", 500, undefined, {
      endpoint: proEndpoint, serverMessage: "UPSTREAM_TIMEOUT, code UPSTREAM_TIMEOUT",
    }))).toBe("network");
    expect(classifySourceError(new HttpRequestError("Request failed", 504, undefined, {
      endpoint: proEndpoint, serverMessage: "Upstream provider error",
    }))).toBe("network");
  });

  it("does not reveal unapproved Pro response text as a detail", () => {
    const source = {};
    recordSourceFailure(source, new HttpRequestError("Request failed", 500, undefined, {
      endpoint: proEndpoint, serverMessage: "No duneApiKey or defiApiKey or debankApiKey",
    }));
    const error = takeSourceFailure(source);
    expect(error).toMatchObject({ category: "service", message: "Pro service error" });
    expect((error as { detail?: string }).detail).toBeUndefined();
  });

  it("keeps non-Pro HTTP 500 and Pro quota classification", () => {
    expect(classifySourceError(new HttpRequestError("Request failed", 500, undefined, {
      endpoint: "https://api.exchange.test/balances", serverMessage: "Upstream provider error",
    }))).toBe("network");
    expect(classifySourceError(new HttpRequestError("code USAGE_LIMIT_EXCEEDED", 429, undefined, {
      endpoint: proEndpoint, serverMessage: "USAGE_LIMIT_EXCEEDED",
    }))).toBe("quota");
  });

  it("classifies only the metering 429 as quota", () => {
    expect(classifySourceError(new HttpRequestError("code USAGE_LIMIT_EXCEEDED", 429))).toBe("quota");
    expect(classifySourceError(new HttpRequestError("rate limit", 429))).toBe("rateLimit");
  });
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
