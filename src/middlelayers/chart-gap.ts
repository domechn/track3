export function hasPartialGap(start: number, end: number, gaps: number[]): boolean {
  return gaps.some((gap) => gap > start && gap < end);
}
