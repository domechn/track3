import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listBackupClients, readBackupClient, type BackupClient } from "@/middlelayers/backup-folder";
import { previewImport } from "@/middlelayers/data";
import type { ExportData, ImportPreviewRow } from "@/middlelayers/datamanager";
import type { Locale } from "@/i18n";

type Translate = (key: string) => string;

export function BackupRestoreSummary({ data, rows, t, locale }: {
  data: ExportData;
  rows: ImportPreviewRow[];
  t: Translate;
  locale: Locale;
}) {
  const monthly = new Map<string, number>();
  for (const row of rows) {
    const month = row.createdAt.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + 1);
  }
  const dates = rows.map((row) => new Date(row.createdAt).getTime()).filter(Number.isFinite);
  const formatter = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  const counts = { new: 0, same: 0, different: 0 };
  for (const row of rows) counts[row.status]++;
  return <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
    <p className="font-medium">{t("data.restore.currentCopyOf").replace("{client}", data.client ?? "")}</p>
    {dates.length > 0 && <p className="text-muted-foreground">{t("data.restore.dateRange")
      .replace("{start}", formatter.format(new Date(Math.min(...dates))))
      .replace("{end}", formatter.format(new Date(Math.max(...dates))))}</p>}
    <p>{t("data.restore.statusCounts")
      .replace("{new}", String(counts.new))
      .replace("{same}", String(counts.same))
      .replace("{different}", String(counts.different))}</p>
    <div className="flex flex-wrap gap-2">
      {[...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) =>
        <span key={month} className="rounded-full border border-border bg-background px-2 py-1 text-xs">
          {t(count === 1 ? "data.restore.monthOne" : "data.restore.monthMany").replace("{month}", month).replace("{count}", String(count))}
        </span>)}
    </div>
  </div>;
}

export default function BackupRestoreList({ directory, prepare, onPreview, t, locale }: {
  directory?: string;
  prepare?: (path: string) => Promise<void>;
  onPreview: (data: ExportData, rows: ImportPreviewRow[]) => void;
  t: Translate;
  locale: Locale;
}) {
  const [clients, setClients] = useState<BackupClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeClient, setActiveClient] = useState<string>();
  const [error, setError] = useState("");
  async function reload(path: string) {
    setLoading(true);
    setError("");
    try {
      await prepare?.(path);
      setClients(await listBackupClients(path));
    } catch (failure) {
      setClients([]);
      setError(String(failure).includes("timed out") ? t("data.restore.timeout") : t("data.restore.listFailed"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setClients([]);
    if (directory) void reload(directory);
  }, [directory]);
  async function review(client: string) {
    if (!directory) return;
    setActiveClient(client);
    setError("");
    try {
      await prepare?.(directory);
      const data = await readBackupClient(directory, client);
      const { rows } = await previewImport(data);
      onPreview(data, rows);
    } catch (failure) {
      setError(String(failure).includes("timed out") ? t("data.restore.timeout") : t("data.restore.readFailed"));
    } finally {
      setActiveClient(undefined);
    }
  }
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{t("data.restore.explanation")}</p>
    {!directory ? <p className="text-sm text-muted-foreground">{t("data.restore.noFolder")}</p> : <>
      <Button size="sm" variant="outline" disabled={loading || !!activeClient} onClick={() => void reload(directory)}>{t("data.restore.refresh")}</Button>
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t("data.restore.loading")}</p> :
        clients.length === 0 && !error ? <p className="text-sm text-muted-foreground">{t("data.restore.empty")}</p> :
          <div className="space-y-2">{clients.map(({ client, exportAt, months, snapshots }) =>
            <div key={client} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background/40 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium" title={client}>{t("data.restore.device").replace("{client}", client.slice(0, 8))}</p>
                <p className="text-xs text-muted-foreground">{t("data.restore.copyDetail")
                  .replace("{time}", new Date(exportAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US"))
                  .replace("{months}", String(months))
                  .replace("{snapshots}", String(snapshots))}</p>
              </div>
              <Button size="sm" variant="outline" disabled={!!activeClient || snapshots === 0} onClick={() => void review(client)}
                aria-label={t("data.restore.reviewClient").replace("{client}", client)}>
                {activeClient === client ? t("data.restore.loading") : t("data.restore.review")}
              </Button>
            </div>)}</div>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
