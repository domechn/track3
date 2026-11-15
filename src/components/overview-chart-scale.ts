export function niceStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const unit = value / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

const dateFormatters = new Map<string, {
  time: Intl.DateTimeFormat;
  month: Intl.DateTimeFormat;
  dayMonth: Intl.DateTimeFormat;
  monthYear: Intl.DateTimeFormat;
}>();

function formattersFor(locale: string) {
  let formatters = dateFormatters.get(locale);
  if (!formatters) {
    formatters = {
      time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }),
      month: new Intl.DateTimeFormat(locale, { month: "short" }),
      dayMonth: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }),
      monthYear: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }),
    };
    dateFormatters.set(locale, formatters);
  }
  return formatters;
}

export function formatOverviewDateTick(timestamps: number[], index: number, locale: string) {
  const date = new Date(timestamps[index]);
  const spanDays = (timestamps.at(-1)! - timestamps[0]) / 86_400_000;
  const formatters = formattersFor(locale);
  if (spanDays <= 1) return formatters.time.format(date);
  if (spanDays <= 60) {
    return locale.startsWith("en")
      ? `${formatters.month.format(date)} ${date.getDate()}`
      : formatters.dayMonth.format(date);
  }
  return index === 0 || date.getMonth() === 0
    ? formatters.monthYear.format(date) : formatters.month.format(date);
}

export function pickDateTicks({
  timestamps, plotWidthPx, labelWidthPx, minGapPx, locale,
}: {
  timestamps: number[];
  plotWidthPx: number;
  labelWidthPx: number;
  minGapPx: number;
  locale: string;
}) {
  const count = timestamps.length;
  if (!count) return [];
  if (count === 1) return [0];
  const spanDays = (timestamps[count - 1] - timestamps[0]) / 86_400_000;
  const gap = labelWidthPx + minGapPx;
  const distance = (a: number, b: number) => Math.abs(a - b) / (count - 1) * plotWidthPx;
  const labels = timestamps.map((_, index) => formatOverviewDateTick(timestamps, index, locale));
  const picked = [count - 1];
  if (distance(0, count - 1) >= gap && labels[0] !== labels[count - 1]) picked.push(0);
  const candidates: number[] = [];
  for (let index = 1; index < count - 1; index++) {
    const date = new Date(timestamps[index]);
    const previous = new Date(timestamps[index - 1]);
    const newDay = date.toDateString() !== previous.toDateString();
    const newMonth = date.getMonth() !== previous.getMonth() || date.getFullYear() !== previous.getFullYear();
    if (spanDays <= 1 ||
      spanDays <= 14 && newDay ||
      spanDays <= 60 && newDay && (date.getDay() === 1 || date.getDate() === 1 || date.getDate() === 15) ||
      spanDays <= 60 && newMonth ||
      spanDays <= 730 && newDay && date.getDate() === 1 ||
      spanDays > 730 && date.getFullYear() !== previous.getFullYear()) {
      candidates.push(index);
    }
  }
  const slots = Math.max(0, Math.floor(plotWidthPx / gap) - picked.length + 1);
  for (let slot = 1; slot <= slots; slot++) {
    const target = slot / (slots + 1) * (count - 1);
    const candidate = candidates
      .filter((index) => picked.every((other) => distance(index, other) >= gap && labels[index] !== labels[other]))
      .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    if (candidate !== undefined) picked.push(candidate);
  }
  return picked.sort((a, b) => a - b);
}

export function overlapsEndValue(tickY: number, endY: number, tagHeight: number) {
  return Math.abs(tickY - endY) < tagHeight / 2 + 12;
}

export function bestDayLabelPosition({
  left, right, top, bottom, markerX, peakY, dashedY, labelWidth, labelHeight, linePoints = [],
}: {
  left: number;
  right: number;
  top: number;
  bottom: number;
  markerX: number;
  peakY: number;
  dashedY: number;
  labelWidth: number;
  labelHeight: number;
  linePoints?: { x: number; y: number }[];
}) {
  const leftSpace = Math.max(0, markerX - left - 6);
  const rightSpace = Math.max(0, right - markerX - 6);
  const useLeft = leftSpace >= rightSpace;
  const width = Math.min(labelWidth, useLeft ? leftSpace : rightSpace);
  const x = useLeft ? markerX - width - 6 : markerX + 6;
  const labelPeakY = linePoints.reduce((highest, point) =>
    point.x >= x && point.x <= x + width ? Math.min(highest, point.y) : highest, peakY);
  const above = Math.min(labelPeakY, dashedY) - labelHeight - 6;
  const below = Math.max(peakY, dashedY) + 6;
  const between = Math.min(peakY, dashedY) + 6;
  let y = above;
  if (above < top) {
    if (below + labelHeight <= bottom) y = below;
    else if (between + labelHeight + 6 <= Math.max(peakY, dashedY)) y = between;
    else y = Math.min(bottom - labelHeight, below);
  }
  return { x, y, width };
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
