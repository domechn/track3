type Point = { x: number; y: number };
type Segment = { start: Point; end: Point; value: number };

export function splitDirectionLine(
  values: readonly number[],
  x: (index: number) => number,
  y: (value: number) => number,
): Segment[] {
  return values.slice(1).flatMap((value, offset) => {
    const previous = values[offset];
    const start = { x: x(offset), y: y(previous) };
    const end = { x: x(offset + 1), y: y(value) };
    if (previous * value >= 0) {
      return [{ start, end, value: previous || value }];
    }
    const fraction = Math.abs(previous) / (Math.abs(previous) + Math.abs(value));
    const zero = { x: start.x + (end.x - start.x) * fraction, y: y(0) };
    return [{ start, end: zero, value: previous }, { start: zero, end, value }];
  });
}
