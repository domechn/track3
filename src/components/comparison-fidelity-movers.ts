type Mover = {
  symbol: string;
  assetType: "crypto" | "stock";
  isStable?: boolean;
  value: { base: number; head: number; changePercent: number };
};

const finite = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value : 0;

export function divergingScale(values: readonly (number | undefined)[]) {
  const positive = Math.max(0, ...values.map((value) => finite(value)));
  const negative = Math.max(0, ...values.map((value) => -finite(value)));
  const zero = positive || negative
    ? Math.max(15, Math.min(85, negative / (negative + positive) * 100))
    : 50;
  const maximum = Math.max(positive, negative);
  const unit = maximum ? Math.max(zero, 100 - zero) / maximum : 0;
  return { zero, unit };
}

export function barGeometry(value: number, scale: ReturnType<typeof divergingScale>) {
  if (!Number.isFinite(value) || value === 0) return null;
  const side = value < 0 ? scale.zero : 100 - scale.zero;
  return {
    left: value < 0 ? undefined : scale.zero,
    right: value < 0 ? 100 - scale.zero : undefined,
    width: Math.min(side, Math.abs(value) * scale.unit),
    side,
    minimumPixels: 2,
  };
}

export function comparisonMoverFacts<T extends Mover>(rows: readonly T[]) {
  const byValue = [...rows].sort((a, b) =>
    Math.abs(b.value.head - b.value.base) - Math.abs(a.value.head - a.value.base));
  const byPercent = [...rows].sort((a, b) =>
    Math.abs(b.value.changePercent) - Math.abs(a.value.changePercent));
  const total = rows.reduce((sum, row) => sum + Math.abs(row.value.head - row.value.base), 0);
  const topChange = byValue.slice(0, 2).reduce((sum, row) => sum + Math.abs(row.value.head - row.value.base), 0);
  const stable = rows.filter((row) => row.isStable)
    .sort((a, b) => Math.abs(b.value.changePercent) - Math.abs(a.value.changePercent))[0];
  return {
    byValue,
    byPercent,
    topSymbols: byValue.slice(0, 2).map((row) => row.symbol),
    topShare: total ? Math.round(topChange / total * 100) : 0,
    topRiser: [...rows].filter((row) => row.value.changePercent > 0)
      .sort((a, b) => b.value.changePercent - a.value.changePercent)[0]?.symbol ?? "",
    mostMovedStable: stable ? { symbol: stable.symbol, changePercent: stable.value.changePercent } : null,
    stableWithinBasisPoint: !!stable && Math.abs(stable.value.changePercent) <= 0.01,
  };
}
