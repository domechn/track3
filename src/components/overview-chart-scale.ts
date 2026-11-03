export function niceStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const unit = value / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export function shouldShowOverviewDateTick(index: number, count: number) {
  const end = count - 1;
  return index === end || index % 5 === 0 && (end - index >= 4 || index === 0);
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
