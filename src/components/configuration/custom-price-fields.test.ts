import { describe, expect, it } from "vitest";
import { parsePriceDraft, priceDraft } from "./custom-price-fields";

describe("custom price in the selected base currency", () => {
  it("stores a EUR entry as USD and displays the stored price in EUR", () => {
    const draft = { ...priceDraft(), kind: "manual" as const, amount: "9" };
    const parsed = parsePriceDraft(draft, [], "NOVA", undefined, 0.9);
    expect(parsed.valid).toBe(true);
    expect(parsed.price).toMatchObject({ kind: "manual", usd: 10 });
    expect(priceDraft(parsed.price, 0.9).amount).toBe("9");
  });

  it("keeps the timestamp when an existing price is saved without edits", () => {
    const previous = { kind: "manual" as const, usd: 10, setAt: "2026-11-01T10:00:00.000Z" };
    expect(parsePriceDraft(priceDraft(previous, 0.9), [], "NOVA", previous, 0.9).price).toEqual(previous);
  });

  it("displays a rounded base-currency value without changing the stored USD price", () => {
    const previous = { kind: "manual" as const, usd: 0.42, setAt: "2026-11-01T10:00:00.000Z" };
    const draft = priceDraft(previous, 7.1);
    expect(draft.amount).toBe("2.982");
    expect(parsePriceDraft(draft, [], "NOVA", previous, 7.1).price).toEqual(previous);
  });

  it("rejects manual input while the base currency rate is unavailable", () => {
    const draft = { ...priceDraft(), kind: "manual" as const, amount: "9" };
    expect(parsePriceDraft(draft, [], "NOVA", undefined, Number.NaN).valid).toBe(false);
  });
});
