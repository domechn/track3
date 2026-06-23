import { describe, expect, it } from "vitest";
import {
  maskSensitive,
  truncateAddress,
  encodedAttachTo,
  parseAttachTo,
} from "@/utils/attach-to";
import type { OtherAttachment } from "@/middlelayers/datafetch/types";

// ---------------------------------------------------------------------------
// maskSensitive
// ---------------------------------------------------------------------------
describe("maskSensitive", () => {
  it('returns "-" for falsy values', () => {
    expect(maskSensitive("")).toBe("-");
  });

  it("returns the value unchanged when length <= 8", () => {
    expect(maskSensitive("abc")).toBe("abc");
    expect(maskSensitive("12345678")).toBe("12345678");
  });

  it("masks middle characters when length > 8", () => {
    expect(maskSensitive("123456789")).toBe("1234...6789");
    expect(maskSensitive("abcdefghij")).toBe("abcd...ghij");
    expect(maskSensitive("abcdefghijklmnop")).toBe("abcd...mnop");
  });
});

// ---------------------------------------------------------------------------
// truncateAddress
// ---------------------------------------------------------------------------
describe("truncateAddress", () => {
  it('returns "-" for falsy values', () => {
    expect(truncateAddress("")).toBe("-");
  });

  it("returns the value unchanged when length <= 12", () => {
    expect(truncateAddress("1A1zP1eP5QG")).toBe("1A1zP1eP5QG");
    expect(truncateAddress("short")).toBe("short");
  });

  it("truncates middle when length > 12", () => {
    expect(truncateAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(
      "1A1zP1...vfNa",
    );
  });
});

// ---------------------------------------------------------------------------
// encodedAttachTo / parseAttachTo round-trip
// ---------------------------------------------------------------------------
describe("encodedAttachTo", () => {
  it("encodes a CEX attachment", () => {
    const a: OtherAttachment = {
      kind: "cex",
      type: "binance",
      identity: "api-key-123",
    };
    expect(encodedAttachTo(a)).toBe("cex:binance:api-key-123");
  });

  it("encodes a wallet attachment", () => {
    const a: OtherAttachment = {
      kind: "wallet",
      type: "btc",
      identity: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    };
    expect(encodedAttachTo(a)).toBe(
      "wallet:btc:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    );
  });
});

describe("parseAttachTo", () => {
  it("returns undefined for falsy input", () => {
    expect(parseAttachTo("")).toBeUndefined();
  });

  it("returns undefined when the string has no colons", () => {
    expect(parseAttachTo("just-a-string")).toBeUndefined();
  });

  it("returns undefined when the string has only one colon", () => {
    expect(parseAttachTo("cex:binance")).toBeUndefined();
  });

  it("returns undefined for an unknown kind", () => {
    expect(parseAttachTo("unknown:binance:key")).toBeUndefined();
  });

  it("returns undefined when type or identity is empty", () => {
    expect(parseAttachTo("cex::key")).toBeUndefined();
    expect(parseAttachTo("cex:binance:")).toBeUndefined();
    expect(parseAttachTo("cex::")).toBeUndefined();
  });

  it("parses a valid CEX attachment", () => {
    const result = parseAttachTo("cex:binance:api-key-123");
    expect(result).toEqual({
      kind: "cex",
      type: "binance",
      identity: "api-key-123",
    });
  });

  it("parses a valid wallet attachment", () => {
    const result = parseAttachTo(
      "wallet:btc:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    );
    expect(result).toEqual({
      kind: "wallet",
      type: "btc",
      identity: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    });
  });

  it("round-trips: encodedAttachTo(parseAttachTo(x)) === x for valid input", () => {
    const inputs = [
      "cex:okx:secret-key",
      "wallet:eth:0x1234567890abcdef",
      "wallet:sol:solana-address-here",
    ];
    for (const input of inputs) {
      const parsed = parseAttachTo(input);
      expect(parsed).toBeDefined();
      expect(encodedAttachTo(parsed!)).toBe(input);
    }
  });

  it("round-trips: parseAttachTo(encodedAttachTo(a)) === a for valid attachment", () => {
    const attachments: OtherAttachment[] = [
      { kind: "cex", type: "binance", identity: "key" },
      { kind: "wallet", type: "btc", identity: "addr" },
    ];
    for (const a of attachments) {
      expect(parseAttachTo(encodedAttachTo(a))).toEqual(a);
    }
  });
});
