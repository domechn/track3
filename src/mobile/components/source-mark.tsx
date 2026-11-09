type Source = { sourceId: string; label: string; kind?: string; provider?: string };

export default function SourceMark({ source, className, initialsOnly = false }: { source: Source; className?: string; initialsOnly?: boolean }) {
  const kind = source.kind ?? (source.sourceId.startsWith("cex:") ? "exchange" :
    source.sourceId.startsWith("stock:") ? "broker" : "wallet");
  const provider = source.provider ?? source.label;
  const mark = provider.toLowerCase() === "binance" ? "Bn" : provider.toLowerCase() === "okx" ? "OK" :
    provider.toLowerCase().includes("interactive brokers") ? "IB" : provider.slice(0, 2).toUpperCase();
  const compactMark = provider.toLowerCase().startsWith("ledger") ? "Lg" : provider.startsWith("0x") ? "0x" : mark;
  return <span className={className} aria-label={kind === "wallet" ? `${provider} wallet` : provider}>
    {kind === "wallet" && !initialsOnly ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M7 6 5.8 4.8a3 3 0 0 0-4.2 4.2l2.1 2.1a3 3 0 0 0 4.2 0L10 9M11 12l1.2 1.2a3 3 0 0 0 4.2-4.2l-2.1-2.1a3 3 0 0 0-4.2 0L8 9M6 12l6-6" />
    </svg> : initialsOnly ? compactMark : mark}
  </span>;
}
