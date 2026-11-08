import type { TDateRange } from "./types";

export type SummaryRange = {
  baseline?: Date;
  snapshots: Date[];
  databaseCount: number;
};

export type SummaryPreset = "1D" | "7D" | "30D" | "90D" | "1Y" | "All";

export function summaryPresetRange(availableDates: readonly Date[], preset: SummaryPreset): TDateRange | undefined {
  const dates = [...availableDates].sort((a, b) => a.getTime() - b.getTime());
  const latest = dates.at(-1);
  if (!latest) return undefined;
  if (preset === "All") return { start: dates[0], end: latest };
  if (preset === "1D") return { start: latest, end: latest };
  const days = preset === "7D" ? 7 : preset === "30D" ? 30 : preset === "90D" ? 90 : 365;
  return { start: dates.find((date) => date.getTime() >= latest.getTime() - days * 86_400_000) ?? latest, end: latest };
}

export function selectSummaryRange(availableDates: readonly Date[], range: TDateRange): SummaryRange {
  const dates = [...new Map(availableDates.map((date) => [date.getTime(), date])).values()]
    .sort((a, b) => a.getTime() - b.getTime());
  const snapshots = dates.filter((date) => date >= range.start && date <= range.end);
  const previous = dates.filter((date) => date < range.start).at(-1);
  return {
    baseline: previous ?? (snapshots.length > 1 ? snapshots[0] : undefined),
    snapshots,
    databaseCount: dates.length,
  };
}
