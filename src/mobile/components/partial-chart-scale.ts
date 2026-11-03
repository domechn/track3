export function chartTicks(values: number[]): number[] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1, 2, 3, 4];
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const desired = (high - low || Math.max(Math.abs(high) * 0.1, 1)) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(desired));
  const step = ([1, 2, 5, 10].find((multiplier) => multiplier * magnitude >= desired) ?? 10) * magnitude;
  const lower = Math.max(0, Math.floor((low - step / 2) / step) * step);
  return Array.from({ length: 5 }, (_, index) => Number((lower + index * step).toPrecision(12)));
}
