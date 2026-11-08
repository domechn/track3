import type { GlobalConfig } from "./datafetch/types";
import type { PortfolioSourceStatus } from "./portfolio-baseline";
import { CEX_OPTIONS, STOCK_BROKER_OPTIONS } from "./constants";
import md5 from "md5";
import { maskSourceIdentifier } from "./source-status";
import { configuredSecretValues, redactSecrets } from "./security/redact";

const walletKinds = ["btc", "erc20", "sol", "doge", "trc20", "ton", "sui"] as const;
export type CurrentSourceStatus = PortfolioSourceStatus & { walletId?: string };

export function sourceStatusMatches(
  status: PortfolioSourceStatus,
  source: { kind: "exchange" | "wallet" | "broker"; type: string; identifier: string; ordinal?: number },
): boolean {
  const provider = source.kind === "wallet" ? source.type.toUpperCase()
    : source.kind === "exchange" ? CEX_OPTIONS.find((option) => option.value === source.type.toLowerCase())?.label
      ?? (source.type.toLowerCase() === "okx" ? "OKX" : source.type.charAt(0).toUpperCase() + source.type.slice(1))
    : STOCK_BROKER_OPTIONS.find((option) => option.value === source.type.toLowerCase())?.label
      ?? source.type.charAt(0).toUpperCase() + source.type.slice(1);
  const hint = source.kind === "broker" ? source.ordinal && `#${source.ordinal}`
    : maskSourceIdentifier(source.identifier, source.kind === "wallet" ? 6 : 4);
  return (!status.kind || status.kind === source.kind) && status.provider === provider &&
    !!hint && status.hint === hint;
}

export function currentSourceStatusLabels(
  statuses: readonly PortfolioSourceStatus[],
  config: GlobalConfig,
): CurrentSourceStatus[] {
  const secrets = configuredSecretValues(config);
  return statuses.map((status) => {
    const match = /^(cex|stock|btc|erc20|sol|doge|trc20|ton|sui):\d+$/.exec(status.sourceId);
    if (!match) return status;
    if (status.provider && status.hint && statuses.filter((other) =>
      other.provider === status.provider && other.hint === status.hint).length > 1) return status;
    const matches: Array<{ label: string; walletId?: string }> = [];
    if (match[1] === "cex") {
      const active = config.exchanges?.filter((row) => row.active !== false) ?? [];
      active.forEach((source, index) => {
        if (sourceStatusMatches(status, { kind: "exchange", type: source.name,
          identifier: source.initParams.apiKey })) {
          matches.push({ label: source.alias?.trim() || `${source.name} ${index + 1}`,
            walletId: md5(`${source.name === "okx" ? "okex" : source.name}-${source.initParams.apiKey}`) });
        }
      });
    } else if (match[1] === "stock") {
      const active = config.stockConfig?.brokers.filter((row) => row.active !== false) ?? [];
      active.forEach((source, index) => {
        if (sourceStatusMatches(status, { kind: "broker", type: source.name,
          identifier: source.initParams.queryId,
          ordinal: active.slice(0, index + 1).filter((row) => row.name === source.name).length })) {
          matches.push({ label: source.alias?.trim() || `${source.name.toUpperCase()} ${index + 1}`,
            walletId: md5(`${source.name}:${source.initParams.queryId}`) });
        }
      });
    } else {
      const kind = walletKinds.find((item) => item === match[1]);
      const active = kind ? config[kind]?.addresses
        ?.filter((entry) => typeof entry === "string" || entry.active !== false) ?? [] : [];
      active.forEach((source, index) => {
        if (!kind) return;
        const address = typeof source === "string" ? source : source.address;
        if (sourceStatusMatches(status, { kind: "wallet", type: kind,
          identifier: address })) matches.push({
          label: typeof source === "string" ? `${kind.toUpperCase()} wallet ${index + 1}`
            : source.alias?.trim() || `${kind.toUpperCase()} wallet ${index + 1}`,
          walletId: md5(address),
        });
      });
    }
    return matches.length === 1 ? { ...status, label: redactSecrets(matches[0].label, secrets),
      ...(matches[0].walletId ? { walletId: matches[0].walletId } : {}) } : status;
  });
}
