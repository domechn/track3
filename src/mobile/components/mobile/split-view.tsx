import type { ReactNode } from "react";

export function SplitView({ selected, master, detail, className = "", masterLabel = "List", detailLabel = "Detail" }: {
  selected: boolean;
  master: ReactNode;
  detail: ReactNode;
  className?: string;
  masterLabel?: string;
  detailLabel?: string;
}) {
  return <div className={`mobile-split-view ${className}`} data-selected={selected}>
    <section className="mobile-split-master" role="region" aria-label={masterLabel} data-active={!selected}>
      {master}
    </section>
    <section className="mobile-split-detail" role="region" aria-label={detailLabel} data-active={selected}>
      {detail}
    </section>
  </div>;
}
