import { expect, it } from "vitest";
import { roundedSummaryBreakdown, summaryProfitPercentage } from "./summary-breakdown";

it("makes displayed market, added money, and other changes add to displayed gain", () => {
  const amounts = roundedSummaryBreakdown({
    priceEffect: 391_721.4, flowEffect: 1_041_826.7, residual: 12_383.9, totalChange: 1_445_932,
  }, 1);
  expect(amounts).toEqual({ market: 391_721, added: 1_041_827, other: 12_384, gain: 1_445_932 });
  expect(amounts.market + amounts.added + amounts.other).toBe(amounts.gain);
});

it("uses the invested amount shown on the P&L card as the percentage denominator", () => {
  expect(summaryProfitPercentage(188_809.27, 763_809.27, 30.41)).toBeCloseTo(32.84, 1);
  expect(summaryProfitPercentage(50, 100, null)).toBeNull();
  expect(summaryProfitPercentage(50, 50, undefined)).toBeUndefined();
});
