// Atomic context helpers.

export interface CurrentContext {
  iso: string;
  date: string;
  time: string;
  timezone: string;
  unixTimestampMs: number;
}

/** Return the current date, time, timezone, and unix timestamp. */
export function getCurrentContext(): CurrentContext {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    iso: now.toISOString(),
    date: dateFormatter.format(now),
    time: timeFormatter.format(now),
    timezone: tz,
    unixTimestampMs: now.getTime(),
  };
}
