import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { useTranslation, type Locale } from "@/i18n";
import type { ImportChoice, ImportPreviewRow, ImportResult, ImportStatus } from "@/middlelayers/datamanager";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";

type Props = {
  rows: ImportPreviewRow[];
  busy: boolean;
  result?: ImportResult;
  onImport: (choices: Record<string, ImportChoice>) => void;
  onCancel: () => void;
  translate?: (key: string) => string;
  locale?: Locale;
  currency?: CurrencyRateDetail;
};

const usd: CurrencyRateDetail = { currency: "USD", alias: "US Dollar", symbol: "$", rate: 1 };

const failureKeys: Record<string, string> = {
  "Cannot replace snapshot without losing local cost prices": "data.importPreview.error.costPrices",
  "Import file cannot replace local cost prices": "data.importPreview.error.costPrices",
  "Import choice no longer matches this snapshot": "data.importPreview.error.choiceChanged",
  "Snapshot already exists": "data.importPreview.error.alreadyExists",
  "Invalid sync transaction asset": "data.importPreview.error.invalidTransaction",
};

export default function ImportPreview({ rows, busy, result, onImport, onCancel, translate, locale, currency = usd }: Props) {
  const { t: desktopT, locale: desktopLocale } = useTranslation();
  const t = translate ?? desktopT;
  const dateFormatter = new Intl.DateTimeFormat((locale ?? desktopLocale) === "zh" ? "zh-CN" : "en-US",
    { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const [choices, setChoices] = useState<Record<string, ImportChoice>>(
    Object.fromEntries(rows.map((row) => [row.uuid, row.choice])),
  );
  const [pendingChoices, setPendingChoices] = useState<Record<string, ImportChoice>>();
  useEffect(() => {
    setChoices(Object.fromEntries(rows.map((row) => [row.uuid, row.choice])));
  }, [rows]);
  function setGroup(status: ImportStatus, choice: ImportChoice) {
    setChoices((previous) => ({
      ...previous,
      ...Object.fromEntries(rows.filter((row) => row.status === status).map((row) => [row.uuid, choice])),
    }));
  }
  const collisions = rows.reduce((sum, row) => sum + row.transactionIdCollisions, 0);
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{t("data.importPreview.description")}</p>
    {collisions > 0 && <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
      {t("data.importPreview.collision").replace("{count}", String(collisions))}
    </p>}
    <div className="flex flex-wrap gap-2">
      {rows.some((row) => row.status === "new") && <>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setGroup("new", "import")}>{t("data.importPreview.importAllNew")}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setGroup("new", "skip")}>{t("data.importPreview.skipAllNew")}</Button>
      </>}
      {rows.some((row) => row.status === "same") &&
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setGroup("same", "skip")}>{t("data.importPreview.skipAllSame")}</Button>}
      {rows.some((row) => row.status === "different") && <>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setGroup("different", "keep")}>{t("data.importPreview.keepAllDifferent")}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setGroup("different", "replace")}>{t("data.importPreview.replaceAllDifferent")}</Button>
      </>}
    </div>
    <div className="max-h-[min(50dvh,30rem)] space-y-2 overflow-y-auto">
      {rows.map((row) => {
        const options: ImportChoice[] = row.status === "new" ? ["import", "skip"] :
          row.status === "same" ? ["skip"] : ["keep", "replace"];
        const date = new Date(row.createdAt);
        const recordedAt = Number.isNaN(date.getTime()) ? String(row.createdAt) : dateFormatter.format(date);
        return <div key={row.uuid} data-testid={`import-row-${row.uuid}`} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{recordedAt} <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs">{t(`data.importPreview.status.${row.status}`)}</span></p>
            <p className="text-xs text-muted-foreground">{t("data.importPreview.rowDetail").replace("{total}", `${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(row.total))}`).replace("{assets}", String(row.assetCount))}</p>
          </div>
          <select
            aria-label={t("data.importPreview.choiceFor").replace("{date}", recordedAt)}
            className="min-h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={choices[row.uuid]}
            disabled={busy}
            onChange={(event) => setChoices((previous) => ({ ...previous, [row.uuid]: event.target.value as ImportChoice }))}
          >
            {options.map((choice) => <option key={choice} value={choice}>{t(`data.importPreview.choice.${choice}`)}</option>)}
          </select>
        </div>;
      })}
    </div>
    {result && <div role="status" className="rounded-md border border-border bg-muted/30 p-3 text-sm">
      <p>{t("data.importPreview.result").replace("{imported}", String(result.imported)).replace("{replaced}", String(result.replaced)).replace("{skipped}", String(result.skipped))}</p>
      {result.failures.map((failure) => <p key={failure.uuid} className="mt-1 text-destructive">
        {failure.uuid}: {failureKeys[failure.error] ? t(failureKeys[failure.error]) : failure.error}
      </p>)}
    </div>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={onCancel} disabled={busy}>{t("common.cancel")}</Button>
      <Button onClick={() => {
        if (Object.values(choices).includes("replace")) setPendingChoices({ ...choices });
        else onImport(choices);
      }} disabled={busy || rows.length === 0}>{t("data.importPreview.apply")}</Button>
    </div>
    <ConfirmDeleteDialog
      open={!!pendingChoices}
      onOpenChange={(open) => { if (!open) setPendingChoices(undefined); }}
      title={t("data.importPreview.confirmReplaceTitle")}
      description={t("data.importPreview.confirmReplaceDescription").replace("{count}", String(Object.values(pendingChoices ?? {}).filter((choice) => choice === "replace").length))}
      cancelLabel={t("common.cancel")}
      actions={[{ label: t("data.importPreview.confirmReplaceAction"), onClick: () => {
        if (pendingChoices) onImport(pendingChoices);
        setPendingChoices(undefined);
      } }]}
    />
  </div>;
}
