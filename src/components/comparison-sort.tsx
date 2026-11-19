export type ComparisonSort = "currentValue" | "valueChange" | "percentChange";

type SortableRow = {
  value: { base: number; head: number; changePercent: number };
};

export function sortComparisonRows<T extends SortableRow>(rows: readonly T[], sort: ComparisonSort): T[] {
  const metric = (row: T) => sort === "currentValue" ? row.value.head
    : sort === "valueChange" ? Math.abs(row.value.head - row.value.base)
    : Math.abs(row.value.changePercent);
  return [...rows].sort((a, b) => metric(b) - metric(a) || b.value.head - a.value.head);
}

export function ComparisonSortSelect({ value, onChange, t }: {
  value: ComparisonSort;
  onChange: (value: ComparisonSort) => void;
  t: (key: string) => string;
}) {
  return <label className="comparison-sort mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
    {t("comparison.sort.label")}
    <select className="rounded-md border border-input bg-background px-2 py-1 text-foreground"
      value={value} onChange={(event) => onChange(event.target.value as ComparisonSort)}>
      <option value="currentValue">{t("comparison.sort.currentValue")}</option>
      <option value="valueChange">{t("comparison.sort.valueChange")}</option>
      <option value="percentChange">{t("comparison.sort.percentChange")}</option>
    </select>
  </label>;
}
