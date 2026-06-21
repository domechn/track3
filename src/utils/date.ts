import _ from "lodash";

const pad = (n: number) => (n < 10 ? `0${n}` : "" + n);

export const timeToDateStr = (
  timestamp: number | Date,
  showTime = false,
  locale?: string,
) => {
  const date = _(timestamp).isDate() ? (timestamp as Date) : new Date(timestamp);

  if (locale) {
    try {
      const dateStr = new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
      if (!showTime) {
        return dateStr;
      }
      const timeStr = new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date);
      return `${dateStr} ${timeStr}`;
    } catch {
      // fall back to default formatting below
    }
  }

  const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  if (!showTime) {
    return dateStr;
  }

  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${dateStr} ${timeStr}`;
};

export const parseDateToTS = (dateStr: string): number => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
};

export const listAllFirstAndLastDays = (start: Date, end: Date) => {
  const dates = [];

  let currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  while (currentMonth <= end) {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    dates.push({
      firstDay,
      lastDay,
    });

    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  return dates;
};

export function getMonthAbbreviation(monthNumber: number, locale?: string) {
  if (locale) {
    try {
      const sample = new Date(2000, monthNumber - 1, 1);
      const formatted = new Intl.DateTimeFormat(locale, {
        month: "short",
      }).format(sample);
      return formatted;
    } catch {
      // fall back
    }
  }
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (monthNumber >= 1 && monthNumber <= 12) {
    return months[monthNumber - 1];
  }

  return "";
}

export function daysBetweenDates(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
