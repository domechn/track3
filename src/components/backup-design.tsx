import { ArchiveIcon, CheckIcon, DownloadIcon, ExclamationTriangleIcon, UploadIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import type { BackupSummary } from "@/middlelayers/backup-summary";
import BackupRestoreList from "@/components/backup-restore-list";
import type { ExportData, ImportPreviewRow } from "@/middlelayers/datamanager";
import type { Locale } from "@/i18n";
import { useState } from "react";

type Props = {
  summary?: BackupSummary;
  directory?: string;
  lastBackupAt?: Date;
  exportConfiguration: boolean;
  setExportConfiguration: (value: boolean) => void;
  onExport: () => Promise<void>;
  onReviewImport: () => void;
  onChooseFolder: () => void;
  onClearFolder: () => void;
  onPreview: (data: ExportData, rows: ImportPreviewRow[]) => void;
  locale: Locale;
};

function CountRow({ label, note, value, checked, onToggle }: { label: string; note: string; value: string; checked: boolean; onToggle?: () => void }) {
  return <div className="t3-b-backup-row"><button className={`t3-b-check ${checked ? "on" : ""}`} aria-label={label} aria-pressed={checked}
    onClick={onToggle} disabled={!onToggle}>{checked && <CheckIcon />}</button>
    <div><b>{label}</b><small>{note}</small></div><span>{value}</span></div>;
}

export function BackupDesign(p: Props) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const exportJson = async () => {
    if (exporting) return;
    setExporting(true);
    try { await p.onExport(); }
    finally { setExporting(false); }
  };
  const count = (value?: number) => value?.toLocaleString(p.locale === "zh" ? "zh-CN" : "en-US") ?? "—";
  return <div className="t3-b-backup t3-b-grid">
    <section className="t3-b-card t3-b-backup-export">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.backup.export")}</h3><p>{t("fidelity.settingsB.backup.exportDesc")}</p></div></div>
      <CountRow label={t("fidelity.settingsB.backup.history")} note={t("fidelity.settingsB.backup.historyNote").replace("{count}", count(p.summary?.snapshots))}
        value={count(p.summary?.snapshots)} checked />
      <CountRow label={t("fidelity.settingsB.backup.configuration")} note={t("fidelity.settingsB.backup.configurationNote")}
        value="—" checked={p.exportConfiguration} onToggle={() => p.setExportConfiguration(!p.exportConfiguration)} />
      <div className="t3-b-backup-export-foot"><div className="t3-b-result"><ArchiveIcon />{t("fidelity.settingsB.backup.secretsNote")}</div>
        <div><span>{t("fidelity.settingsB.backup.sizeUnknown")}</span><button className="t3-b-button primary" onClick={() => { void exportJson(); }} disabled={exporting}><DownloadIcon />{t(exporting ? "fidelity.settingsB.backup.exporting" : "fidelity.settingsB.backup.exportJson")}</button></div></div>
    </section>
    <section className="t3-b-card t3-b-backup-import">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.backup.import")}</h3><p>{t("fidelity.settingsB.backup.importDesc")}</p></div></div>
      <div className="t3-b-notice"><UploadIcon /><b>{t("fidelity.settingsB.backup.noFile")}</b>{t("fidelity.settingsB.backup.chooseFileHint")}</div>
      <div className="t3-b-backup-import-foot"><div className="t3-b-result"><ExclamationTriangleIcon />{t("fidelity.settingsB.backup.importPreviewNote")}</div>
        <button className="t3-b-button primary" onClick={p.onReviewImport}>{t("fidelity.settingsB.backup.reviewImport")}</button></div>
    </section>
    <section className="t3-b-card t3-b-backup-folder">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.backup.folderTitle")}</h3><p>{t("fidelity.settingsB.backup.folderDesc")}</p></div></div>
      <div className="t3-b-backup-folder-status"><div><b>{t("fidelity.settingsB.backup.backupEnabled")}</b><small>{p.directory ? t("fidelity.settingsB.backup.folderConfigured") : t("fidelity.settingsB.backup.folderMissing")}</small></div>
        <span className={`t3-b-pill ${p.directory ? "connected" : ""}`}>{t(p.directory ? "fidelity.settingsB.backup.configured" : "fidelity.settingsB.backup.notSet")}</span></div>
      <div className="t3-b-field"><label>{t("fidelity.settingsB.backup.folder")}</label><div className="t3-b-backup-path"><span className="t3-b-input mono">{p.directory || t("fidelity.settingsB.backup.notSet")}</span>
        <button className="t3-b-button small" onClick={p.onChooseFolder}>{t(p.directory ? "fidelity.settingsB.backup.change" : "fidelity.settingsB.backup.choose")}</button>
        {p.directory && <button className="t3-b-button small" onClick={p.onClearFolder}>{t("fidelity.settingsB.backup.clear")}</button>}</div></div>
      <div className="t3-b-backup-stats"><div><small>{t("fidelity.settingsB.backup.lastBackup")}</small><b>{p.lastBackupAt && p.lastBackupAt.getTime() > 0 ? p.lastBackupAt.toLocaleDateString(p.locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</b></div>
        <div><small>{t("fidelity.settingsB.backup.snapshots")}</small><b>{count(p.summary?.snapshots)}</b></div></div>
      <div className="t3-b-backup-restore"><h4>{t("fidelity.settingsB.backup.restoreList")}</h4><BackupRestoreList directory={p.directory} onPreview={p.onPreview} t={t} locale={p.locale} /></div>
      <section className="t3-b-backup-device">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.backup.onDevice")}</h3><p>{t("fidelity.settingsB.backup.onDeviceDesc")}</p></div></div>
      <dl className="t3-b-dl">
        <dt>{t("fidelity.settingsB.backup.database")}</dt><dd>SQLite</dd>
        <dt>{t("fidelity.settingsB.backup.snapshots")}</dt><dd>{count(p.summary?.snapshots)}</dd>
        <dt>{t("fidelity.settingsB.backup.assets")}</dt><dd>{count(p.summary?.assets)}</dd>
        <dt>{t("fidelity.settingsB.backup.transactions")}</dt><dd>{count(p.summary?.transactions)}</dd>
        <dt>{t("fidelity.settingsB.backup.backupFolder")}</dt><dd className="mono">{p.directory || "—"}</dd>
      </dl>
      </section>
    </section>
  </div>;
}
