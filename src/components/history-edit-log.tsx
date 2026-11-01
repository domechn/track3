import { useMemo } from "react";
import { useTranslation } from "@/i18n";
import { displayEditValue, type SnapshotEdit } from "@/middlelayers/charts-history";

export default function HistoryEditLog({ edits, error = false }: { edits: SnapshotEdit[] | null; error?: boolean }) {
  const { t, locale } = useTranslation();
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }), [locale]);
  return (
    <section className="rounded-lg border border-border/40 bg-background/30 p-3" aria-label={t("history.editLog.title")}>
      <h3 className="text-sm font-semibold">{t("history.editLog.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("history.editLog.sinceUpdate")}</p>
      {error ? <p role="alert" className="mt-2 text-sm text-destructive">{t("history.editLog.loadFailed")}</p>
        : edits === null ? <p role="status" className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
        : edits.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t("history.editLog.empty")}</p>
        : <ol className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {edits.map((edit) => {
            const label = t(`history.editLog.${edit.target}.${edit.action}`);
            const valueLabels = {
              assets: t("history.editLog.assets"),
              amount: t("common.amountLabel"),
              value: t("common.valueLabel"),
            };
            const before = displayEditValue(edit.old_value, locale === "zh" ? "zh-CN" : "en-US", valueLabels);
            const after = displayEditValue(edit.new_value, locale === "zh" ? "zh-CN" : "en-US", valueLabels);
            const delta = before && after ? `${before} → ${after}` : before || after;
            return <li key={edit.id} className="rounded-md border border-border/30 bg-card/50 px-3 py-2 text-sm">
              <p>{label}{edit.symbol ? ` ${edit.symbol}` : ""}{delta ? `${edit.target === "transaction" ? " " : " · "}${delta}` : ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`history.editLog.origin.${edit.origin}`)} · {formatter.format(new Date(edit.edited_at))}
              </p>
            </li>;
          })}
        </ol>}
    </section>
  );
}
