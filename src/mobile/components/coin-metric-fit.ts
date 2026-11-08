type Bounds = Pick<DOMRect, "left" | "right" | "top">;
type MetricBounds = { strong?: Bounds; small?: Bounds; contentRight?: number };

export function needsMetricStack(grid: Bounds, metrics: readonly MetricBounds[]): boolean {
  return metrics.some((metric, index) =>
    (["strong", "small"] as const).some((tag) => {
      const value = metric[tag];
      if (!value) return false;
      const next = metrics[index + 1]?.[tag];
      return value.left < grid.left - 1 || value.right > grid.right + 1 ||
        (metric.contentRight !== undefined && value.right > metric.contentRight + 1) ||
        Boolean(next && Math.abs(value.top - next.top) <= 1 && next.left - value.right < 16);
    }));
}

export function fittingDateTickIndices(ticks: readonly { index: number; left: number; right: number }[]): number[] {
  if (ticks.length < 2) return ticks.map((tick) => tick.index);
  const first = ticks[0];
  const last = ticks[ticks.length - 1];
  if (last.left - first.right < 6) return [last.index];
  const visible = [first];
  for (const tick of ticks.slice(1, -1)) {
    if (tick.left - visible[visible.length - 1].right >= 6 && last.left - tick.right >= 6)
      visible.push(tick);
  }
  return [...visible.map((tick) => tick.index), last.index];
}
