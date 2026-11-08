import type { CurrentSourceStatus } from "@/middlelayers/source-status-labels";

type Source = { id: string; label: string };
type Identity = { wallet?: string; type?: string };
const providerName = (name?: string) => name?.toUpperCase().replace("OKEX", "OKX").replace("IBKR", "INTERACTIVE BROKERS");

export function matchSourceStatus(
  source: Source,
  identities: Record<string, Identity | undefined>,
  sources: readonly Source[],
  statuses: readonly CurrentSourceStatus[],
) {
  const provider = providerName(identities[source.id]?.type);
  const direct = statuses.find((status) => (status.sourceId === source.id || status.walletId === source.id) &&
    (!provider || providerName(status.provider) === provider));
  if (direct) return direct;
  if (!provider) return undefined;
  const candidates = statuses.filter((status) => !status.walletId && providerName(status.provider) === provider);
  const wallet = identities[source.id]?.wallet;
  const hint = wallet && wallet.length >= 14 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : undefined;
  const hinted = candidates.filter((status) => status.hint === hint);
  const peers = sources.filter((item) => providerName(identities[item.id]?.type) === provider);
  if (hinted.length === 1 && peers.filter((item) => {
    const address = identities[item.id]?.wallet;
    return address && `${address.slice(0, 6)}…${address.slice(-4)}` === hint;
  }).length === 1) return hinted[0];
  const walletStatus = candidates[0]?.kind === "wallet" ||
    /^(btc|erc20|sol|doge|trc20|ton|sui):/.test(candidates[0]?.sourceId ?? "");
  return peers.length === 1 && candidates.length === 1 && (!walletStatus || !hint)
    ? candidates[0] : undefined;
}
