export type DailyChange = { timestamp: number; value: number };
export type DailyBucket = { start: number; end: number; value: number; count: number; best: number; worst: number };
export type DailyPeriod = "snapshot" | "day" | "week" | "month";

export function maxDailyBars(width: number, phone: boolean) {
  return Math.max(1, Math.min(phone ? 40 : 60, Math.floor(width / (phone ? 5 : 6))));
}

function periodStart(timestamp: number, period: Exclude<DailyPeriod, "snapshot">) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  if (period === "week") date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  if (period === "month") date.setDate(1);
  return date.getTime();
}

function grouped(daily: DailyChange[], period: Exclude<DailyPeriod, "snapshot">): DailyBucket[] {
  const buckets: DailyBucket[] = [];
  for (const item of daily) {
    const start = periodStart(item.timestamp, period);
    const last = buckets.at(-1);
    if (last?.start === start) {
      last.value += item.value;
      last.count++;
      last.best = Math.max(last.best, item.value);
      last.worst = Math.min(last.worst, item.value);
    } else {
      buckets.push({ start, end: start, value: item.value, count: 1, best: item.value, worst: item.value });
    }
  }
  return buckets;
}

export function bucketDailyChanges(daily: DailyChange[], maxBars: number): { period: DailyPeriod; buckets: DailyBucket[] } {
  if (daily.length <= maxBars || daily.length <= 30) return {
    period: "snapshot",
    buckets: daily.map((item) => ({
      start: item.timestamp, end: item.timestamp, value: item.value, count: 1, best: item.value, worst: item.value,
    })),
  };
  const byDay = grouped(daily, "day");
  if (byDay.length <= maxBars) return { period: "day", buckets: byDay };
  const spanDays = (daily.at(-1)!.timestamp - daily[0].timestamp) / 86_400_000;
  if (spanDays <= 124) {
    const byWeek = grouped(daily, "week");
    if (byWeek.length <= maxBars) return { period: "week", buckets: byWeek };
  }
  const byMonth = grouped(daily, "month");
  if (byMonth.length <= maxBars) return { period: "month", buckets: byMonth };
  const monthsPerBucket = Math.ceil(byMonth.length / maxBars);
  const buckets: DailyBucket[] = [];
  for (let index = 0; index < byMonth.length; index += monthsPerBucket) {
    const months = byMonth.slice(index, index + monthsPerBucket);
    buckets.push({
      start: months[0].start,
      end: months.at(-1)!.end,
      value: months.reduce((sum, month) => sum + month.value, 0),
      count: months.reduce((sum, month) => sum + month.count, 0),
      best: Math.max(...months.map((month) => month.best)),
      worst: Math.min(...months.map((month) => month.worst)),
    });
  }
  return { period: "month", buckets };
}
