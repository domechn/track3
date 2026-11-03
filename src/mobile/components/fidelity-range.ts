import { differenceInCalendarDays } from "date-fns";
import type { TDateRange } from "@/middlelayers/types";

export function rangeLabel({ start, end }: TDateRange): string {
  if (start.getTime() === 0) return "All";
  const days = differenceInCalendarDays(end, start);
  return ({ 1: "1D", 7: "7D", 30: "30D", 90: "90D", 365: "1Y" } as Record<number, string>)[days] ?? "Custom";
}
