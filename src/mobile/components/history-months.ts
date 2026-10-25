export function groupHistoryMonths<T extends { createdAt: string }>(rows: T[]): { key: string; rows: T[] }[] {
  const groups: { key: string; rows: T[] }[] = [];
  for (const row of rows) {
    const date = new Date(row.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (groups.at(-1)?.key !== key) groups.push({ key, rows: [] });
    groups.at(-1)!.rows.push(row);
  }
  return groups;
}
