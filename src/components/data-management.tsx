import { useEffect, useState, useSyncExternalStore } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { useOptimisticDelete } from "@/components/common/use-optimistic-delete";
import {
  checkIfDuplicatedHistoricalData,
  exportHistoricalData,
  importHistoricalData,
  importSelected,
  previewImport,
  readHistoricalDataFromFile,
} from "@/middlelayers/data";
import { UniqueIndexConflictResolver } from "@/middlelayers/types";
import {
  addToBlacklist,
  cleanAutoBackupDirectory,
  getAutoBackupDirectory,
  getBlacklistCoins,
  getLastAutoImportAt,
  getLastAutoBackupAt,
  getConfiguration,
  loadAIConfig,
  removeFromBlacklist,
  saveAutoBackupDirectory,
} from "@/middlelayers/configuration";
import { type ExportData, type ImportChoice, type ImportPreviewRow, type ImportResult } from "@/middlelayers/datamanager";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import ImportPreview from "@/components/import-preview";
import BackupRestoreList, { BackupRestoreSummary } from "@/components/backup-restore-list";
import { timeToDateStr } from "@/utils/date";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Input } from "@/components/ui/input";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import "@/components/common/scrollbar/index.css";
import { useTranslation } from "@/i18n";
import {
  isRecoveryRequiredRotationError,
  isRotationCommandError,
  runEncryptionKeyRotation,
} from "@/middlelayers/encryption-write-gate";
import { redactSecrets } from "@/middlelayers/security/redact";
import { useOutletContext } from "react-router-dom";
import { queryBackupSummary, type BackupSummary } from "@/middlelayers/backup-summary";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { loadSyncSettings } from "@/middlelayers/sync/settings";
import { SyncRecoveryExport } from "@/components/settings/sync-recovery";
import { BlacklistDesign } from "@/components/blacklist-design";
import { SecurityDesign } from "@/components/security-design";
import { BackupDesign } from "@/components/backup-design";
import { useWideDesktop } from "@/components/use-wide-desktop";
import { usePassphraseRequest } from "@/components/common/use-passphrase-request";

const App = ({ onDataImported, currency }: { onDataImported?: () => void; currency?: CurrencyRateDetail }) => {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const wide = useWideDesktop();
  const section = useOutletContext<string | null>();
  const showBackup = !section || section === "backup";
  const showBlacklist = !section || section === "blacklist";
  const showSecurity = !section || section === "security";
  const syncStatus = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const [exportConfiguration, setExportConfiguration] = useState(false);
  const passphraseDialog = usePassphraseRequest();
  const [showConflictResolverDialog, setShowConflictResolverDialog] =
    useState(false);
  const [exportData, setExportData] = useState<ExportData | undefined>(
    undefined,
  );
  const [itemPreview, setItemPreview] = useState<{ data: ExportData; rows: ImportPreviewRow[]; backup?: boolean }>();
  const [itemResult, setItemResult] = useState<ImportResult>();
  const [itemBusy, setItemBusy] = useState(false);
  const [autoBackupDirectory, setAutoBackupDirectory] = useState<string>();
  const { run: runBackupFolderDelete } = useOptimisticDelete(setAutoBackupDirectory);
  const [lastBackupAt, setLastBackupAt] = useState<Date>();
  const [lastImportAt, setLastImportAt] = useState<Date>();
  const [backupSummary, setBackupSummary] = useState<BackupSummary>();
  const [blacklist, setBlacklist] = useState<string[]>([]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("t3-blacklist-count", { detail: blacklist.length }));
  }, [blacklist]);
  const { run: runBlacklistDelete } = useOptimisticDelete(setBlacklist);
  const [encKeyInput, setEncKeyInput] = useState("");
  const [encKeyConfirm, setEncKeyConfirm] = useState("");
  const [encKeySaving, setEncKeySaving] = useState(false);
  const [keyRotated, setKeyRotated] = useState(false);
  const [customKey, setCustomKey] = useState<boolean>();
  useEffect(() => {
    if (!showSecurity) return;
    void invoke<boolean>("encryption_key_status").then(setCustomKey).catch(() => undefined);
  }, [showSecurity]);
  const [secretInventory, setSecretInventory] = useState<{ exchanges: string[]; brokers: string[]; assistant?: string; sync?: string }>();
  useEffect(() => {
    if (!showSecurity || !wide) return;
    let active = true;
    void Promise.all([
      getConfiguration().catch(() => undefined),
      loadAIConfig().catch(() => undefined),
      loadSyncSettings().catch(() => undefined),
    ]).then(([config, ai, sync]) => {
      if (!active) return;
      setSecretInventory({
        exchanges: config?.exchanges.filter((item) => item.active !== false).map((item) => item.alias || item.name) ?? [],
        brokers: config?.stockConfig?.brokers.filter((item) => item.active !== false).map((item) => item.alias || item.name) ?? [],
        assistant: ai?.endpoint ? (() => { try { return new URL(ai.endpoint).hostname; } catch { return ai.endpoint; } })() : undefined,
        sync: sync?.enabled ? sync.bucket : undefined,
      });
    });
    return () => { active = false; };
  }, [showSecurity, wide]);
  async function handleChangeEncryptionKey(confirmStorage = true) {
    if (!encKeyInput || encKeyInput !== encKeyConfirm) {
      toast({
        description: t("data.encryption.key.mismatch"),
        variant: "destructive",
      });
      return;
    }
    if (encKeyInput.length < 8) {
      toast({
        description: t("data.encryption.key.minLength"),
        variant: "destructive",
      });
      return;
    }
    if (encKeyInput.trim() !== encKeyInput) {
      toast({
        description: t("data.encryption.key.whitespace"),
        variant: "destructive",
      });
      return;
    }
    if (confirmStorage && !(await window.confirm(t("data.encryption.key.storageWarning")))) return;
    setEncKeySaving(true);
    try {
      await runEncryptionKeyRotation(() =>
        invoke("rotate_encryption_key", { newKey: encKeyInput }),
      );
      setKeyRotated(true);
      setCustomKey(true);
      toast({ description: t("data.encryption.key.success"), tone: "success" });
      setEncKeyInput("");
      setEncKeyConfirm("");
    } catch (e) {
      const description = isRecoveryRequiredRotationError(e)
        ? t("data.encryption.key.recovery.required")
        : isRotationCommandError(e)
          ? e.message
          : String(e);
      toast({ description: redactSecrets(description, [encKeyInput]), variant: "destructive" });
    } finally {
      setEncKeySaving(false);
    }
  }

  async function handleResetEncryptionKey() {
    if (!(await window.confirm(t("data.encryption.key.removeConfirm")))) return;
    setEncKeySaving(true);
    try {
      await runEncryptionKeyRotation(() => invoke("reset_encryption_key"));
      setCustomKey(false);
      setKeyRotated(true);
      toast({ description: t("data.encryption.key.success"), tone: "success" });
    } catch (error) {
      const description = isRecoveryRequiredRotationError(error)
        ? t("data.encryption.key.recovery.required")
        : isRotationCommandError(error) ? error.message : String(error);
      toast({ description: redactSecrets(description), variant: "destructive" });
    } finally {
      setEncKeySaving(false);
    }
  }


  useEffect(() => {
    loadAutoBackupDirectory().then((isSet) => {
      if (isSet) {
        loadAutoBackupTime();
      }
    });
    getBlacklistCoins().then(setBlacklist);
  }, []);

  useEffect(() => {
    if (showBackup) void queryBackupSummary().then(setBackupSummary).catch(() => undefined);
  }, [showBackup]);

  async function loadAutoBackupDirectory() {
    const d = await getAutoBackupDirectory();
    setAutoBackupDirectory(d);
    return !!d;
  }

  async function loadAutoBackupTime() {
    const laia = await getLastAutoImportAt();
    setLastImportAt(laia);
    const laba = await getLastAutoBackupAt();
    setLastBackupAt(laba);
  }

  async function onExportDataClick() {
    const passphrase = exportConfiguration ? await passphraseDialog.ask("export") : undefined;
    if (exportConfiguration && !passphrase) return;
    try {
      const exported = await exportHistoricalData(exportConfiguration, passphrase);
      if (exported) toast({ description: t("data.exportSuccess"), tone: "success" });
    } catch {
      toast({ description: t("data.exportFailed"), variant: "destructive" });
    }
  }

  async function onImportDataClick() {
    const ed = await readHistoricalDataFromFile();
    setExportData(ed);
    if (!ed) {
      return;
    }
    const hasConflicts = await checkIfDuplicatedHistoricalData(ed);
    if (hasConflicts) {
      setShowConflictResolverDialog(true);
    } else {
      importData("IGNORE", ed);
    }
  }

  async function onReviewImportClick() {
    try {
      const data = await readHistoricalDataFromFile();
      if (!data) return;
      const { rows } = await previewImport(data);
      setItemResult(undefined);
      setItemPreview({ data, rows });
    } catch (error) {
      toast({ description: redactSecrets(String(error), [encKeyInput]), variant: "destructive" });
    }
  }

  async function applyItemChoices(choices: Record<string, ImportChoice>) {
    if (!itemPreview) return;
    setItemBusy(true);
    try {
      const result = await importSelected(itemPreview.data, choices);
      if (result.imported + result.replaced > 0) {
        onDataImported?.();
        void queryBackupSummary().then(setBackupSummary).catch(() => undefined);
      }
      if (result.failures.length) {
        setItemResult(result);
        const { rows } = await previewImport(itemPreview.data);
        setItemPreview({ ...itemPreview, rows });
      }
      else {
        setItemPreview(undefined);
        toast({ description: t("data.importSuccess"), tone: "success" });
      }
    } catch (error) {
      toast({ description: redactSecrets(String(error), [encKeyInput]), variant: "destructive" });
    } finally {
      setItemBusy(false);
    }
  }

  async function importData(cr: UniqueIndexConflictResolver, selectedData = exportData) {
    if (!selectedData) {
      toast({
        description: t("data.noDataToImport"),
        variant: "destructive",
      });
      return;
    }
    return importHistoricalData(cr, selectedData, passphraseDialog.ask)
      .then((imported) => {
        if (!imported) {
          return;
        }
        toast({ description: t("data.importSuccess"), tone: "success" });
        if (onDataImported) {
          onDataImported();
        }
        void queryBackupSummary().then(setBackupSummary).catch(() => undefined);
      })
      .catch((err) => {
        toast({
          description: redactSecrets(err instanceof Error ? err.message : String(err), [encKeyInput]),
          variant: "destructive",
        });
      })
      .finally(() => {
        setExportData(undefined);
        setShowConflictResolverDialog(false);
      });
  }

  async function onChooseAutoBackupFolderButtonClick() {
    const selected = await open({
      multiple: false,
      directory: true,
      recursive: true,
    });
    if (selected) {
      const path = selected as string;
      await saveAutoBackupDirectory(path);
      setAutoBackupDirectory(path);
      await loadAutoBackupTime();
    }
  }

  function onClearAutoBackupFolderButtonClick() {
    const path = autoBackupDirectory;
    if (!path) return;
    void runBackupFolderDelete({
      update: () => undefined,
      rollback: () => path,
      commit: cleanAutoBackupDirectory,
      undo: () => saveAutoBackupDirectory(path),
      successMessage: t("data.clearFolderRemoved"),
      undoLabel: t("common.undo"),
      undoAltText: t("data.undoClearFolder"),
      undoWindowMs: 5000,
    });
  }

  function onRemoveFromBlacklist(symbol: string) {
    const index = blacklist.findIndex((value) => value.toUpperCase() === symbol.toUpperCase());
    void runBlacklistDelete({
      update: (prev) => prev.filter((s) => s.toUpperCase() !== symbol.toUpperCase()),
      rollback: (prev) => {
        if (prev.some((value) => value.toUpperCase() === symbol.toUpperCase())) return prev;
        const next = [...prev];
        next.splice(Math.max(0, index), 0, symbol);
        return next;
      },
      undoUpdate: (prev) => prev.some((value) => value.toUpperCase() === symbol.toUpperCase())
        ? prev : [...prev, symbol],
      commit: () => removeFromBlacklist(symbol),
      undo: () => addToBlacklist(symbol),
      successTitle: t("fidelity.blacklist.removedTitle").replace("{symbol}", symbol),
      successMessage: t("fidelity.blacklist.removedDesc"),
      undoLabel: t("common.undo"),
      undoAltText: t("data.undoBlacklistRemoval"),
      undoWindowMs: 5000,
    });
  }

  async function onAddToBlacklist(symbol: string) {
    await addToBlacklist(symbol);
    setBlacklist((current) => [...current, symbol]);
  }

  const securityDesign = section === "security" && wide;
  const backupDesign = section === "backup" && wide;
  return (
    <div className="space-y-6">
      <Dialog open={!!passphraseDialog.request} onOpenChange={(open) => { if (!open) passphraseDialog.answer(); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t(passphraseDialog.request?.kind === "export" ? "data.export" : "data.import")}</DialogTitle>
            <DialogDescription>{t(passphraseDialog.request?.kind === "export"
              ? "data.encryption.key.exportPassphrase"
              : passphraseDialog.request?.kind === "legacy"
                ? "data.encryption.key.legacyImportKey"
                : "data.encryption.key.importPassphrase")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); passphraseDialog.answer(passphraseDialog.passphrase); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backup-passphrase">{t("data.encryption.key.passphraseLabel")}</Label>
              <Input id="backup-passphrase" type="password" autoComplete="off" value={passphraseDialog.passphrase}
                onChange={(event) => passphraseDialog.setPassphrase(event.target.value)} />
              {passphraseDialog.request?.kind === "export" && passphraseDialog.passphrase.length > 0 && Array.from(passphraseDialog.passphrase).length < 8 &&
                <p className="text-sm text-destructive">{t("data.encryption.key.exportPassphraseShort")}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => passphraseDialog.answer()}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={!passphraseDialog.passphrase.trim() ||
                (passphraseDialog.request?.kind === "export" && Array.from(passphraseDialog.passphrase).length < 8)}>{t("common.confirm")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {securityDesign && <SecurityDesign
        syncReady={syncStatus.mode === "ready"} encKeyInput={encKeyInput} setEncKeyInput={setEncKeyInput}
        encKeyConfirm={encKeyConfirm} setEncKeyConfirm={setEncKeyConfirm}
        encKeySaving={encKeySaving} keyRotated={keyRotated} customKey={customKey} secretInventory={secretInventory}
        onRotate={() => { void handleChangeEncryptionKey(false); }} onReset={() => { void handleResetEncryptionKey(); }} />}
      <Dialog open={!!itemPreview} onOpenChange={(open) => { if (!open && !itemBusy) setItemPreview(undefined); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader><DialogTitle>{t("data.importPreview.title")}</DialogTitle></DialogHeader>
          {itemPreview?.backup && <BackupRestoreSummary data={itemPreview.data} rows={itemPreview.rows} t={t} locale={locale} />}
          {itemPreview && <ImportPreview rows={itemPreview.rows} result={itemResult} busy={itemBusy} currency={currency}
            onImport={(choices) => void applyItemChoices(choices)} onCancel={() => setItemPreview(undefined)} />}
        </DialogContent>
      </Dialog>
      <Dialog
        open={showConflictResolverDialog}
        onOpenChange={setShowConflictResolverDialog}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("data.conflictTitle")}</DialogTitle>
            <DialogDescription>
              {t("data.conflictDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => importData("REPLACE")}>
              {t("data.conflictOverwrite")}
            </Button>
            <Button onClick={() => importData("IGNORE")} variant="outline">
              {t("data.conflictIgnore")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {backupDesign && <BackupDesign summary={backupSummary} directory={autoBackupDirectory} lastBackupAt={lastBackupAt}
        exportConfiguration={exportConfiguration} setExportConfiguration={setExportConfiguration}
        onExport={onExportDataClick} onReviewImport={() => { void onReviewImportClick(); }}
        onChooseFolder={() => { void onChooseAutoBackupFolderButtonClick(); }} onClearFolder={onClearAutoBackupFolderButtonClick}
        onPreview={(data, rows) => { setItemResult(undefined); setItemPreview({ data, rows, backup: true }); }} locale={locale} />}

      <div className={securityDesign || backupDesign ? "t3-b-legacy-header" : ""}>
        <h3 className="text-lg font-medium tracking-tight">{t(section === "backup" ? "settings.phase6.backup" : section === "blacklist" ? "settings.phase6.blacklist" : section === "security" ? "settings.phase6.security" : "data.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("data.subtitle")}
        </p>
      </div>

      {showBackup && !backupDesign && <Card role="region" aria-label={t("data.phase6.onDevice")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t("data.phase6.onDevice")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          {(["snapshots", "assets", "transactions"] as const).map((field) => <div key={field} className="rounded-md border border-border/50 bg-background/40 p-3">
            <p className="text-xl font-semibold tabular-nums">{backupSummary?.[field].toLocaleString() ?? t("data.na")}</p>
            <p className="text-xs text-muted-foreground">{t(`data.phase6.${field}`)}</p>
          </div>)}
        </CardContent>
      </Card>}

      {showBackup && !backupDesign && <div className="grid gap-4 2xl:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("data.import")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t("data.importDesc")}
            </p>
            <Button onClick={onImportDataClick} size="sm" className="mt-auto w-fit">
              {t("data.importButton")}
            </Button>
            <Button onClick={onReviewImportClick} size="sm" variant="outline" className="w-fit">
              {t("data.importPreview.open")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("data.export")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-md border border-border/50 bg-background/40 p-3">
              <Checkbox
                id="exportConfigurationCheckbox"
                checked={exportConfiguration}
                onCheckedChange={(v) => setExportConfiguration(!!v)}
                aria-label={t("data.includeConfig")}
              />
              <Label htmlFor="exportConfigurationCheckbox" className="data-export-configuration-label min-w-0 flex-1 cursor-pointer text-sm">
                <span className="block">{t("data.phase6.configuration")}</span>
                <span className="block text-xs font-normal text-muted-foreground">{t("data.phase6.configDetail")}</span>
              </Label>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-border/50 bg-background/40 p-3">
              <Checkbox id="exportDataCheckbox" checked={true} disabled aria-label={t("data.includeHistory")} />
              <Label htmlFor="exportDataCheckbox" className="min-w-0 flex-1 text-sm">
                <span className="block">{t("data.phase6.portfolioHistory")}</span>
                <span className="block text-xs font-normal text-muted-foreground">{t("data.phase6.historyDetail").replace("{snapshots}", backupSummary?.snapshots.toLocaleString() ?? t("data.na")).replace("{transactions}", backupSummary?.transactions.toLocaleString() ?? t("data.na"))}</span>
              </Label>
            </div>
            <Button onClick={onExportDataClick} size="sm">
              {t("data.exportButton")}
            </Button>
          </CardContent>
        </Card>
      </div>}

      {showBackup && !backupDesign && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("data.autoBackup")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="text-muted-foreground w-4 h-4 mt-0.5" />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1 text-xs">
                    <div>
                      {t("data.lastBackupAt")}{" "}
                      {lastBackupAt ? timeToDateStr(lastBackupAt, true) : t("data.na")}
                    </div>
                    <div>
                      {t("data.lastImportAt")}{" "}
                      {lastImportAt ? timeToDateStr(lastImportAt, true) : t("data.na")}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span>
              {t("data.autoBackupDesc")}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div
              className={cn(
                "text-sm text-muted-foreground whitespace-nowrap overflow-x-auto scrollbar-hide",
                autoBackupDirectory ? "block" : "hidden",
              )}
            >
              {autoBackupDirectory}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onChooseAutoBackupFolderButtonClick} size="sm">
                {t("data.chooseFolder")}
              </Button>
              <ConfirmDeleteDialog
                trigger={<Button variant="outline" size="sm">{t("data.clearFolder")}</Button>}
                title={t("data.clearFolderTitle")}
                description={t("data.clearFolderDesc")}
                cancelLabel={t("common.cancel")}
                actions={[{
                  label: t("data.clearFolder"),
                  onClick: onClearAutoBackupFolderButtonClick,
                }]}
              />
            </div>
          </div>
        </CardContent>
      </Card>}

      {showBackup && !backupDesign && <Card role="region" aria-label={t("data.restore.title")}>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("data.restore.title")}</CardTitle></CardHeader>
        <CardContent>
          <BackupRestoreList directory={autoBackupDirectory} t={t} locale={locale}
            onPreview={(data, rows) => { setItemResult(undefined); setItemPreview({ data, rows, backup: true }); }} />
        </CardContent>
      </Card>}

      {showBlacklist && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("data.blacklist")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("data.blacklistDesc")}
          </p>
          {blacklist.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("data.blacklistEmpty")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blacklist.map((symbol) => (
                <div
                  key={symbol}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/30 px-3 py-1 text-sm"
                >
                  <span>{symbol}</span>
                  <ConfirmDeleteDialog
                    trigger={<button
                      aria-label={t("data.removeFromBlacklistAria").replace("{symbol}", symbol)}
                      className="text-muted-foreground hover:text-foreground transition-colors text-xs leading-none"
                    >✕</button>}
                    title={t("data.removeBlacklistTitle")}
                    description={t("data.removeBlacklistDesc")}
                    cancelLabel={t("common.cancel")}
                    actions={[{
                      label: t("data.removeBlacklistAction"),
                      onClick: () => onRemoveFromBlacklist(symbol),
                    }]}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>}
      {section === "blacklist" && <BlacklistDesign symbols={blacklist} onAdd={onAddToBlacklist} onRemove={onRemoveFromBlacklist} />}

      {showSecurity && !securityDesign && syncStatus.mode === "ready" && <Card className="t3-b-security-legacy">
        <CardHeader className="pb-2"><CardTitle>{t("sync.recovery.title")}</CardTitle></CardHeader>
        <CardContent><SyncRecoveryExport t={t} /></CardContent>
      </Card>}

      {showSecurity && !securityDesign && <Card className="t3-b-security-legacy">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("data.encryption.key.title")}
          </CardTitle>
          {customKey !== undefined && <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t(customKey ? "data.encryption.key.customStatus" : "data.encryption.key.defaultStatus")}</span>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t("data.encryption.key.sharedDefault")}</p>
          <p className="text-muted-foreground">
            {t("data.encryption.key.description")}
          </p>
          <p className="text-muted-foreground">{t("data.encryption.key.storageWarning")}</p>
          <Input
            type="password"
            placeholder={t("data.encryption.key.newPlaceholder")}
            value={encKeyInput}
            onChange={(e) => setEncKeyInput(e.target.value)}
            autoComplete="off"
          />
          <Input
            type="password"
            placeholder={t("data.encryption.key.confirmPlaceholder")}
            value={encKeyConfirm}
            onChange={(e) => setEncKeyConfirm(e.target.value)}
            autoComplete="off"
          />
          <Button onClick={() => void handleChangeEncryptionKey()} disabled={encKeySaving} size="sm">
            {encKeySaving
              ? t("data.encryption.key.saving")
              : t("data.encryption.key.update")}
          </Button>
          {customKey && <Button onClick={() => void handleResetEncryptionKey()} disabled={encKeySaving} size="sm" variant="outline">{t("data.encryption.key.remove")}</Button>}
        </CardContent>
      </Card>}
    </div>
  );
};

export default App;
