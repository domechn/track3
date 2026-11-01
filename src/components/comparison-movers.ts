type ComparedAsset = {
  symbol: string;
  value: { base: number; head: number; changePercent: number };
};

export function comparisonMovers<T extends ComparedAsset>(rows: readonly T[], limit = 8) {
  const changed = rows.filter((row) => row.value.head !== row.value.base);
  const byValue = [...changed]
    .sort((a, b) => Math.abs(b.value.head - b.value.base) - Math.abs(a.value.head - a.value.base))
    .slice(0, limit);
  const byPercent = [...changed]
    .sort((a, b) => Math.abs(b.value.changePercent) - Math.abs(a.value.changePercent))
    .slice(0, limit);
  return {
    byValue,
    byPercent,
    maximumValue: Math.max(0, ...byValue.map((row) => Math.abs(row.value.head - row.value.base))),
    maximumPercent: Math.max(0, ...byPercent.map((row) => Math.abs(row.value.changePercent))),
  };
}
