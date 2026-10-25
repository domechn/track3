export function visibleHistoryIndices(timestamps: number[], days: number | null): number[] {
  if (!timestamps.length) return [];
  const cutoff = days === null ? -Infinity : timestamps[timestamps.length - 1] - days * 86_400_000;
  const firstInside = timestamps.findIndex((timestamp) => timestamp >= cutoff);
  const start = Math.max(0, firstInside < 0 ? timestamps.length - 2
    : firstInside === timestamps.length - 1 ? firstInside - 1 : firstInside);
  return Array.from({ length: timestamps.length - start }, (_, index) => start + index);
}
