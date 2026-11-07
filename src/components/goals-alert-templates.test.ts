import { expect, it } from "vitest";
import { alertRuleFromDraft } from "@/middlelayers/ui-state/alert-draft";
import { alertTemplateDraft, alertTemplates } from "./goals-alert-templates";
import type { AlertSnapshot } from "@/middlelayers/alerts";

it("provides four immediately editable templates backed by supported rule fields", () => {
  expect(alertTemplates).toEqual(["btc.price", "portfolio.value", "allocation.drift", "daily.change"]);
  expect(alertRuleFromDraft(alertTemplateDraft("btc.price"))).toMatchObject({
    kind: "asset_price_target", assetType: "crypto", symbol: "BTC", comparator: "gte",
    threshold: 70000, window: null,
  });
  expect(alertRuleFromDraft(alertTemplateDraft("portfolio.value"))).toMatchObject({
    kind: "total_value_target", assetType: null, symbol: null, comparator: "gte",
    threshold: 800000, window: null,
  });
  expect(alertRuleFromDraft(alertTemplateDraft("allocation.drift"))).toMatchObject({
    kind: "allocation_deviation", assetType: "crypto", symbol: "BTC", comparator: "gte",
    threshold: 2, window: null,
  });
  expect(alertRuleFromDraft(alertTemplateDraft("daily.change"))).toMatchObject({
    kind: "portfolio_value_change", assetType: null, symbol: null, comparator: "lte",
    threshold: -5, window: "24h",
  });
});

it("sets price and portfolio targets above the latest saved values", () => {
  const latest: AlertSnapshot = {
    at: "2026-11-01T00:00:00.000Z",
    assets: [
      { assetType: "crypto", symbol: "BTC", wallet: "one", amount: 1, price: 63000, value: 63000 },
      { assetType: "crypto", symbol: "ETH", wallet: "one", amount: 10, price: 3700, value: 37000 },
    ],
  };
  expect(alertTemplateDraft("btc.price", latest).threshold).toBe("69300");
  expect(alertTemplateDraft("portfolio.value", latest).threshold).toBe("110000");
});
