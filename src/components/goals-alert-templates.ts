import type { AlertDraft } from "@/middlelayers/ui-state/alert-draft";
import type { AlertSnapshot } from "@/middlelayers/alerts";

export const alertTemplates = ["btc.price", "portfolio.value", "allocation.drift", "daily.change"] as const;
export type AlertTemplate = typeof alertTemplates[number];

export function alertTemplateDraft(template: AlertTemplate, latest?: AlertSnapshot): AlertDraft {
  const btcPrice = latest?.assets.find((asset) => asset.assetType === "crypto" && asset.symbol === "BTC" && asset.price > 0)?.price;
  const portfolioValue = latest?.assets.reduce((sum, asset) => sum + asset.value, 0);
  const base: AlertDraft = {
    id: 0, kind: "total_value_target", assetType: "crypto", symbol: "",
    comparator: "gte", threshold: "", window: "24h", cooldownMinutes: "1440",
  };
  switch (template) {
    case "btc.price":
      return { ...base, kind: "asset_price_target", symbol: "BTC", threshold: btcPrice
        ? String(Math.ceil(btcPrice * 110) / 100) : "70000" };
    case "portfolio.value":
      return { ...base, threshold: portfolioValue && portfolioValue > 0
        ? String(Math.ceil(portfolioValue * 110) / 100) : "800000" };
    case "allocation.drift":
      return { ...base, kind: "allocation_deviation", symbol: "BTC", threshold: "2" };
    case "daily.change":
      return { ...base, kind: "portfolio_value_change", comparator: "lte", threshold: "-5" };
  }
}
