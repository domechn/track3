import { expect, it } from "vitest";
import { formatGapAmount, prepareCostBasisGaps } from "./cost-basis-gaps";
import type { CostBasisWarning } from "@/middlelayers/cost-basis";

const warning = (code: CostBasisWarning["code"], symbol: string, amount: number, date = "2026-09-18"): CostBasisWarning =>
  ({ eventId: `${code}-${symbol}-${amount}`, date, assetType: "crypto", symbol, amount, code });

it("folds floating residue and sub-cent value into one dust row without hiding substantive gaps", () => {
  const rows = prepareCostBasisGaps([
    warning("missing-lots", "BTC", 0.000000001),
    warning("unknown-basis", "SOL", 0.00002),
    warning("unknown-disposal", "BTC", 0.5),
  ], { SOL: 100, BTC: 100_000 });
  expect(rows).toMatchObject([
    { kind: "gap", code: "unknown-disposal", symbol: "BTC", amount: 0.5 },
    { kind: "dust", count: 2 },
  ]);
});

it("preserves a small coin amount when its price is unknown and it exceeds the coin threshold", () => {
  expect(prepareCostBasisGaps([warning("unknown-basis", "NOVA", 0.00000002)], {}))
    .toMatchObject([{ kind: "gap", symbol: "NOVA", amount: 0.00000002 }]);
  expect(prepareCostBasisGaps([warning("unknown-basis", "NOVA", 8000)], { NOVA: 0 }))
    .toMatchObject([{ kind: "gap", symbol: "NOVA", amount: 8000 }]);
});

it("groups substantive gaps by reason, newest first within each reason", () => {
  const rows = prepareCostBasisGaps([
    warning("unknown-disposal", "SOL", 35, "2026-09-18"),
    warning("unknown-basis", "NOVA", 8000, "2026-08-22"),
    warning("unknown-basis", "ABC", 5, "2026-10-01"),
  ], {});
  expect(rows.map((row) => row.kind === "gap" ? `${row.code}:${row.symbol}` : "dust"))
    .toEqual(["unknown-basis:ABC", "unknown-basis:NOVA", "unknown-disposal:SOL"]);
});

it("formats gap quantities with grouping and at most eight decimal places", () => {
  expect(formatGapAmount(12345.123456789)).toBe("12,345.12345679");
  expect(formatGapAmount(35)).toBe("35.0000");
  expect(formatGapAmount(30, "stock")).toBe("30");
});
