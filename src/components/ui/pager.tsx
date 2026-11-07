import { useEffect, useMemo, useState } from "react";

const sessionPageSizes = new Map<string, number>();

export function usePager<T>(rows: readonly T[], resetKey: string, initialPageSize = 10, onPageChange?: () => void, memoryKey?: string) {
  const [selection, setSelection] = useState(() => ({ key: resetKey, page: 1,
    pageSize: memoryKey ? sessionPageSizes.get(memoryKey) ?? initialPageSize : initialPageSize }));
  const pageSize = selection.pageSize;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = selection.key === resetKey ? Math.min(selection.page, pages) : 1;
  useEffect(() => {
    if (selection.key === resetKey && selection.page <= pages) return;
    setSelection((current) => current.key !== resetKey ? { ...current, key: resetKey, page: 1 }
      : current.page > pages ? { ...current, page: pages } : current);
  }, [resetKey, pages, selection]);
  const visibleRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);
  const goTo = (nextPage: number) => {
    const target = Math.max(1, Math.min(pages, nextPage));
    if (target === page) return;
    setSelection({ key: resetKey, page: target, pageSize });
    onPageChange?.();
  };
  return {
    page, pages, pageSize, rows: visibleRows,
    goTo,
    previous: () => goTo(page - 1),
    next: () => goTo(page + 1),
    first: () => goTo(1),
    last: () => goTo(pages),
    setPageSize: (size: number) => {
      if (memoryKey) sessionPageSizes.set(memoryKey, size);
      setSelection({ key: resetKey, page: 1, pageSize: size });
      onPageChange?.();
    },
  };
}

export function Pager({ count, page, pages, pageSize = 10, previous, next, first, last, setPageSize, pageSizes, t, labelPrefix = "profit.attribution", ariaLabel }: {
  count: number; page: number; pages: number; pageSize?: number;
  previous: () => void; next: () => void; first?: () => void; last?: () => void;
  setPageSize?: (size: number) => void; pageSizes?: number[];
  t: (key: string) => string; labelPrefix?: string; ariaLabel?: string;
}) {
  if (count <= pageSize) return null;
  const buttonClass = "min-h-11 min-w-11 rounded-md px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
  return <nav className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
    aria-label={ariaLabel ?? t(`${labelPrefix}.table`)}>
    <span aria-live="polite" aria-atomic="true">{t(`${labelPrefix}.showing`)
      .replace("{from}", String((page - 1) * pageSize + 1))
      .replace("{to}", String(Math.min(count, page * pageSize)))
      .replace("{total}", String(count))}</span>
    <div className="flex flex-wrap items-center gap-1">
      {pages > 5 && first && <button type="button" className={buttonClass} onClick={first} disabled={page === 1}>{t(`${labelPrefix}.firstPage`)}</button>}
      <button type="button" className={buttonClass} onClick={previous} disabled={page === 1}>{t(`${labelPrefix}.previous`)}</button>
      <span className="px-1">{t(`${labelPrefix}.page`).replace("{page}", String(page)).replace("{pages}", String(pages))}</span>
      <button type="button" className={buttonClass} onClick={next} disabled={page === pages}>{t(`${labelPrefix}.next`)}</button>
      {pages > 5 && last && <button type="button" className={buttonClass} onClick={last} disabled={page === pages}>{t(`${labelPrefix}.lastPage`)}</button>}
      {pageSizes && setPageSize && <label className="ml-1 flex items-center gap-1">{t(`${labelPrefix}.pageSize`)}
        <select className="min-h-11 rounded-md border border-border bg-background px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t(`${labelPrefix}.pageSize`)} value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
          {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>}
    </div>
  </nav>;
}
