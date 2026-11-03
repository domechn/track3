import type { GlobalConfig } from "@/middlelayers/datafetch/types";

export function hasActiveSource(config?: GlobalConfig | null): boolean {
  const chains = ["erc20", "sol", "btc", "doge", "trc20", "ton", "sui"] as const;
  return Boolean(config?.others?.length ||
    config?.exchanges?.some((exchange) => exchange.active !== false) ||
    config?.stockConfig?.brokers?.some((broker) => broker.active !== false) ||
    chains.some((chain) => config?.[chain]?.addresses?.some((address) =>
      typeof address === "string" || address.active !== false)));
}
