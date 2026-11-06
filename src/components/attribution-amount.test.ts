import { describe, expect, it } from "vitest";
import { attributionAmount, attributionCompactAmount, attributionRange } from "./attribution-amount";

const currency = { currency: "EUR", symbol: "€", rate: 2, alias: "eur" };

describe("attribution amounts", () => {
  it("shows whole converted units while retaining exact values", () => {
    expect(attributionAmount(-3_434_659.1335, currency)).toBe("−€6,869,318");
    expect(attributionAmount(-3_434_659.1335, currency, true)).toBe("−€6,869,318.27");
  });

  it("shows unsigned zero for sub-unit amounts while keeping cents in the title value", () => {
    expect(attributionAmount(0.185, currency)).toBe("€0");
    expect(attributionAmount(0.185, currency, true)).toBe("+€0.37");
    expect(attributionAmount(0.12345678, currency)).toBe("€0");
    expect(attributionAmount(0.12345678, currency, true)).toBe("+€0.25");
    expect(attributionAmount(-0.185, currency)).toBe("€0");
    expect(attributionAmount(0, currency)).toBe("€0");
  });

  it("limits precise titles to cents", () => {
    expect(attributionAmount(2_867.924528301905, currency, true)).toBe("+€5,735.85");
  });

  it("offers whole values and compact values so a range can use the one that fits", () => {
    expect(attributionRange(499_999.5, 500_000, currency)).toEqual({
      text: "€999,999 → €1,000,000", compact: "€1M → €1M",
      full: "€999,999.00 → €1,000,000.00",
    });
    expect(attributionRange(-6_003_301.05, 22_503_902.94, { ...currency, rate: 1, symbol: "$" })).toEqual({
      text: "−$6,003,301 → $22,503,903", compact: "−$6M → $22.5M",
      full: "−$6,003,301.05 → $22,503,902.94",
    });
  });

  it("provides a shorter fallback for ranges below one million", () => {
    expect(attributionRange(310_000, 763_809, { ...currency, rate: 1, symbol: "$" }).compact)
      .toBe("$310K → $764K");
  });

  it("uses Chinese compact units for Chinese labels", () => {
    expect(attributionCompactAmount(85_500_000, { ...currency, rate: 1, symbol: "¥" }, "zh")).toBe("+¥8550万");
    expect(attributionRange(85_500_000, 321_000_000, { ...currency, rate: 1, symbol: "¥" }, "zh").compact)
      .toBe("¥8550万 → ¥3.21亿");
  });

  it("compacts a rank amount only when whole digits need room", () => {
    expect(attributionCompactAmount(1_999_999.75, currency)).toBe("+€4M");
    expect(attributionCompactAmount(-500_000.25, currency)).toBe("−€1M");
    expect(attributionCompactAmount(0, currency)).toBe("€0");
    expect(attributionCompactAmount(0.185, currency)).toBe("€0");
  });
});
