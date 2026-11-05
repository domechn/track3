import { useEffect, useState } from "react";

const PAGE_SIZE = 10;

export function useAttributionPage<T>(rows: readonly T[], resetKey: string) {
  const [selection, setSelection] = useState({ key: resetKey, page: 1 });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = selection.key === resetKey ? Math.min(selection.page, pages) : 1;
  useEffect(() => {
    setSelection((current) => current.key !== resetKey ? { key: resetKey, page: 1 }
      : current.page > pages ? { key: resetKey, page: pages } : current);
  }, [resetKey, pages]);
  return {
    page,
    pages,
    rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    previous: () => setSelection({ key: resetKey, page: Math.max(1, page - 1) }),
    next: () => setSelection({ key: resetKey, page: Math.min(pages, page + 1) }),
  };
}

export function AttributionPager({ count, page, pages, previous, next, t }: {
  count: number; page: number; pages: number; previous: () => void; next: () => void;
  t: (key: string) => string;
}) {
  if (count <= PAGE_SIZE) return null;
  return <nav className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
    aria-label={t("profit.attribution.table")}>
    <span aria-live="polite" aria-atomic="true">{t("profit.attribution.showing")
      .replace("{from}", String((page - 1) * PAGE_SIZE + 1))
      .replace("{to}", String(Math.min(count, page * PAGE_SIZE)))
      .replace("{total}", String(count))}</span>
    <div className="flex items-center gap-1">
      <button type="button" className="min-h-11 min-w-11 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onClick={previous} disabled={page === 1}>{t("profit.attribution.previous")}</button>
      <span className="px-1">{t("profit.attribution.page").replace("{page}", String(page)).replace("{pages}", String(pages))}</span>
      <button type="button" className="min-h-11 min-w-11 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onClick={next} disabled={page === pages}>{t("profit.attribution.next")}</button>
    </div>
  </nav>;
}
