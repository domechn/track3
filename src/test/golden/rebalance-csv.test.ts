// Regenerate only from 0.9.4: UPDATE_GOLDEN=1 corepack yarn vitest run src/test/golden/rebalance-csv.test.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { suggestionsToCsv, type RebalanceResult } from "@/middlelayers/rebalance";
import desktopEn from "@/i18n/locales/en.json";
import desktopZh from "@/i18n/locales/zh.json";
import mobileEn from "@/mobile/en.json";
import mobileZh from "@/mobile/zh.json";

const result: RebalanceResult = {
  currentTotal: 120,
  projectedTotal: 150,
  warnings: [],
  rows: [
    {
      kind: "asset", assetType: "crypto", symbol: "BTC", amount: 1, value: 60,
      price: 60, currentPercent: 50, targetPercent: 60, deviationPercent: -10,
      tradeValue: 15.25, tradeQuantity: 0.25416667,
    },
    {
      kind: "asset", assetType: "stock", symbol: '=DANGEROUS,"ticker"',
      amount: 2, value: 60, price: 30, currentPercent: 50, targetPercent: 40,
      deviationPercent: 10, tradeValue: -12.5, tradeQuantity: -0.41666667,
      note: "below-threshold",
    },
    {
      kind: "asset", assetType: "crypto", symbol: "SOL", amount: 0, value: 0,
      price: 0, currentPercent: 0, targetPercent: 0, deviationPercent: 0,
      tradeValue: 0, tradeQuantity: null, note: "missing-price",
    },
    {
      kind: "cash", symbol: "CASH", amount: 0, value: 0, price: 1,
      currentPercent: 0, targetPercent: 0, deviationPercent: 0,
      tradeValue: 27.25, tradeQuantity: 27.25, note: "cash-reserve",
    },
  ],
};

describe("0.9.4 rebalance CSV", () => {
  for (const [name, catalog] of [
    ["desktop-en", desktopEn], ["desktop-zh", desktopZh],
    ["mobile-en", mobileEn], ["mobile-zh", mobileZh],
  ] as const) {
    it(name, () => {
      const t = (key: string) => (catalog as Record<string, string>)[key] ?? key;
      const actual = suggestionsToCsv(result, "USD", t);
      const path = resolve(`tests/golden/rebalance-${name}.csv`);
      if (process.env.UPDATE_GOLDEN === "1") {
        mkdirSync(resolve("tests/golden"), { recursive: true });
        writeFileSync(path, actual);
      }
      expect(actual).toBe(readFileSync(path, "utf8"));
    });
  }
});
