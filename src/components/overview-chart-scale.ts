export function niceStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const unit = value / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export function shouldShowOverviewDateTick(index: number, count: number, maxLabels?: number) {
  const end = count - 1;
  const step = maxLabels ? Math.max(5, Math.ceil(end / Math.max(1, maxLabels - 1))) : 5;
  return index === end || index % step === 0 && (end - index >= (maxLabels ? Math.ceil(step / 2) : 4) || index === 0);
}

export function formatOverviewAxisTicks(ticks: number[]) {
  const largest = Math.max(0, ...ticks.map(Math.abs));
  const [unit, suffix] = largest >= 1e9 ? [1e9, "b"] : largest >= 1e6 ? [1e6, "m"] :
    largest >= 1e3 ? [1e3, "k"] : [1, ""];
  let precision = 0;
  while (precision < 15 && (
    new Set(ticks.map((tick) => Number((tick / unit).toFixed(precision)))).size < ticks.length ||
    ticks.some((tick) =>
      Math.abs(Number((tick / unit).toFixed(precision)) * unit - tick) > Math.max(1e-7, Math.abs(tick) * 1e-10))
  )) {
    precision++;
  }
  const labels = ticks.map((tick) => `${Number((tick / unit).toFixed(precision))}${suffix}`);
  return new Set(labels).size === ticks.length ? labels : ticks.map((tick) => tick.toExponential());
}

export function chartBounds<T extends { totalValue: number }>(points: T[]) {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.totalValue)) continue;
    minimum = Math.min(minimum, point.totalValue);
    maximum = Math.max(maximum, point.totalValue);
  }
  if (!Number.isFinite(minimum)) return { low: 0, high: 1 };
  const step = niceStep((maximum - minimum) / 3 || maximum / 4);
  const low = Math.max(0, Math.floor(minimum / step) * step - step);
  const high = Math.max(low + step, Math.ceil(maximum / step) * step + (maximum % step === 0 ? step : 0));
  return { low, high };
}
