/** Indices shared by aligned chart series, keeping true data points for tooltips. */
export function downsampleIndices(series: number[][], maxPoints: number): number[] {
  const length = series[0]?.length ?? 0;
  if (length <= maxPoints) return Array.from({ length }, (_, i) => i);
  if (length === 0) return [];

  const budget = Math.max(2, Math.floor(maxPoints));
  const required = new Set([0, length - 1]);
  for (const values of series) {
    if (values.length !== length) throw new Error("Chart series must be aligned");
    let min = 0;
    let max = 0;
    for (let i = 1; i < length; i++) {
      if (values[i] < values[min]) min = i;
      if (values[i] > values[max]) max = i;
    }
    required.add(min);
    required.add(max);
  }
  if (required.size >= budget) {
    return [...required].sort((a, b) => a - b);
  }

  const selected = new Set(required);
  const primary = series[0];
  const buckets = Math.max(1, Math.floor((budget - required.size) / 2));
  for (let bucket = 0; bucket < buckets; bucket++) {
    const start = 1 + Math.floor((bucket * (length - 2)) / buckets);
    const end = 1 + Math.floor(((bucket + 1) * (length - 2)) / buckets);
    let min = start;
    let max = start;
    for (let i = start + 1; i < end; i++) {
      if (primary[i] < primary[min]) min = i;
      if (primary[i] > primary[max]) max = i;
    }
    selected.add(min);
    selected.add(max);
  }
  if (selected.size < budget) {
    for (let i = 1; i < length - 1 && selected.size < budget; i += Math.max(1, Math.floor(length / budget))) {
      selected.add(i);
    }
  }
  return [...selected].sort((a, b) => a - b).slice(0, budget);
}
