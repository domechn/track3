export type SnapshotAsset = {
  assetType: "crypto" | "stock";
  symbol: string;
  wallet?: string;
  value: number;
};

export function deriveSourceChanges(
  baseline: readonly SnapshotAsset[],
  latest: readonly SnapshotAsset[],
  aliases: Record<string, string>,
) {
  const sources = new Map<string, { before: number; after: number }>();
  const assets = new Map<string, { symbol: string; values: Record<string, number> }>();
  const collect = (rows: readonly SnapshotAsset[], field: "before" | "after", sign: number) => {
    for (const row of rows) {
      const source = row.wallet ?? "unknown";
      const sourceTotals = sources.get(source) ?? { before: 0, after: 0 };
      sourceTotals[field] += row.value;
      sources.set(source, sourceTotals);
      const key = `${row.assetType}:${row.symbol}`;
      const asset = assets.get(key) ?? { symbol: row.symbol, values: {} };
      asset.values[source] = (asset.values[source] ?? 0) + row.value * sign;
      assets.set(key, asset);
    }
  };
  collect(baseline, "before", -1);
  collect(latest, "after", 1);
  return {
    sources: [...sources].map(([id, values]) => ({
      id,
      label: aliases[id] ?? id,
      value: values.after,
      change: values.after - values.before,
      percentage: values.before ? (values.after - values.before) / values.before * 100 : null,
    })).sort((a, b) => b.value - a.value),
    assets: [...assets].map(([key, asset]) => ({
      key,
      symbol: asset.symbol,
      values: asset.values,
      total: Object.values(asset.values).reduce((sum, value) => sum + value, 0),
    })),
    totalChange: [...sources.values()].reduce((sum, values) => sum + values.after - values.before, 0),
  };
}
