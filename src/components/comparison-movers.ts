type ComparedAsset = {
  symbol: string;
  value: { base: number; head: number; changePercent: number };
};

export function comparisonMovers<T extends ComparedAsset>(rows: readonly T[]) {
  const byValue = [...rows]
    .sort((a, b) => Math.abs(b.value.head - b.value.base) - Math.abs(a.value.head - a.value.base));
  const byPercent = [...rows]
    .sort((a, b) => Math.abs(b.value.changePercent) - Math.abs(a.value.changePercent));
  return {
    byValue,
    byPercent,
  };
}
