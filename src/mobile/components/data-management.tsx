import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useToast } from "@/mobile/components/ui/use-toast";
import ConfirmDeleteDialog from "@/mobile/components/common/confirm-delete-dialog";
import { useOptimisticDelete } from "@/mobile/components/common/use-optimistic-delete";
import {
  checkIfDuplicatedHistoricalData,
  exportHistoricalData,
  importHistoricalData,
  readHistoricalDataFromFile,
  readHistoricalDataFromPath,
  shareHistoricalData,
} from "@/middlelayers/data";
import { UniqueIndexConflictResolver } from "@/middlelayers/types";
import {
  addToBlacklist,
  cleanAutoBackupDirectory,
  getAutoBackupDirectory,
  getBlacklistCoins,
  getLastAutoImportAt,
  getLastAutoBackupAt,
  removeFromBlacklist,
  saveAutoBackupDirectory,
} from "@/middlelayers/configuration";
import type { ExportData } from "@/middlelayers/datamanager";
import { timeToDateStr } from "@/utils/date";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/mobile/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/mobile/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import "@/components/common/scrollbar/index.css";
import { useTranslation } from "@/mobile/i18n";
import {
  isRecoveryRequiredRotationError,
  isRotationCommandError,
  runEncryptionKeyRotation,
} from "@/middlelayers/encryption-write-gate";
import { redactSecrets } from "@/middlelayers/security/redact";
import { chooseBackupLocation, documentsBackupLocation } from "@/utils/backup-location";
import { findBackupFolder, listBackupClients, readBackupClient, type BackupClient, type BackupFolder } from "@/middlelayers/backup-folder";
import { backupFolderStatusEvent, type IOSBackupFolderStatus } from "@/middlelayers/ios-backup-folder";
import { isIOS } from "@/utils/platform";
import { appLockEnabled, setAppLockEnabled } from "@/utils/ios-native";
import { ConfirmSheet } from "@/mobile/components/mobile/overlays";
import { InsetGroup } from "@/mobile/components/mobile";
import { useSearchParams } from "react-router-dom";

const App = ({ onDataImported }: { onDataImported?: () => void }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [exportConfiguration, setExportConfiguration] = useState(false);
  const [showConflictResolverDialog, setShowConflictResolverDialog] =
    useState(false);
  const [exportData, setExportData] = useState<ExportData | undefined>(
    undefined,
  );
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [autoBackupDirectory, setAutoBackupDirectory] = useState<string>();
  const [backupFolderFailure, setBackupFolderFailure] = useState<string | null>(null);
  const folderChoiceVersion = useRef(0);
  const [folderReview, setFolderReview] = useState<{ folder: BackupFolder; clients: BackupClient[] }>();
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderPreparing, setFolderPreparing] = useState(false);
  const [folderFromCloud, setFolderFromCloud] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [useImportForAuto, setUseImportForAuto] = useState(false);
  const { run: runBackupFolderDelete } = useOptimisticDelete(setAutoBackupDirectory);
  const [lastBackupAt, setLastBackupAt] = useState<Date>();
  const [lastImportAt, setLastImportAt] = useState<Date>();
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const { run: runBlacklistDelete } = useOptimisticDelete(setBlacklist);
  const [encKeyInput, setEncKeyInput] = useState("");
  const [encKeyConfirm, setEncKeyConfirm] = useState("");
  const [encKeySaving, setEncKeySaving] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState(false);
  useEffect(() => {
    if (isIOS()) void appLockEnabled().then(setLockEnabled).catch(() => setLockError(true));
  }, []);
  async function toggleAppLock() {
    setLockBusy(true);
    setLockError(false);
    try {
      await setAppLockEnabled(!lockEnabled);
      setLockEnabled(!lockEnabled);
    } catch {
      setLockError(true);
    } finally {
      setLockBusy(false);
    }
  }
  async function handleChangeEncryptionKey() {
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
    setEncKeySaving(true);
    try {
      await runEncryptionKeyRotation(() =>
        invoke("rotate_encryption_key", { newKey: encKeyInput }),
      );
      toast({ description: t("data.encryption.key.success") });
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


  useEffect(() => {
    loadAutoBackupDirectory().then((isSet) => {
      if (isSet) {
        loadAutoBackupTime();
      }
    });
    getBlacklistCoins().then(setBlacklist);
    const refresh = () => { void loadAutoBackupDirectory(); };
    window.addEventListener(backupFolderStatusEvent, refresh);
    return () => window.removeEventListener(backupFolderStatusEvent, refresh);
  }, []);

  async function loadAutoBackupDirectory() {
    const version = folderChoiceVersion.current;
    try {
      let d = await getAutoBackupDirectory();
      if (isIOS()) {
        const status = await invoke<IOSBackupFolderStatus>("ios_backup_folder_status");
        if (version !== folderChoiceVersion.current) return false;
        if (status.path && !d) {
          await invoke("ios_clear_backup_folder", { kind: "auto" });
          status.failure = null;
        } else if (status.path && d && status.path !== d) {
          const documents = await documentsBackupLocation();
          if (version !== folderChoiceVersion.current) return false;
          if (d === documents) {
            await invoke("ios_clear_backup_folder", { kind: "auto" });
            status.failure = null;
          } else {
            await saveAutoBackupDirectory(status.path);
            d = status.path;
          }
        }
        setBackupFolderFailure(status.failure);
      }
      if (version !== folderChoiceVersion.current) return false;
      setAutoBackupDirectory(d);
      return !!d;
    } catch {
      if (isIOS()) setBackupFolderFailure("Backup folder is unavailable.");
      return false;
    }
  }

  function backupFailureMessage(error: string) {
    if (error.includes("containing track3-backup")) return t("data.folder.autoHint");
    if (error.includes("timed out")) return t("data.folder.downloadTimeout");
    if (error.includes("download")) return t("data.folder.failed");
    return t("data.folder.unavailable");
  }

  async function loadAutoBackupTime() {
    const laia = await getLastAutoImportAt();
    setLastImportAt(laia);
    const laba = await getLastAutoBackupAt();
    setLastBackupAt(laba);
  }

  async function onExportDataClick() {
    const exported = await exportHistoricalData(exportConfiguration);
    if (exported) {
      toast({ description: t("data.exportSuccess") });
    }
  }

  async function onShareDataClick() {
    try {
      await shareHistoricalData(exportConfiguration);
    } catch {
      toast({ description: t("data.shareFailed"), variant: "destructive" });
    }
  }

  async function onImportDataClick() {
    setFolderReview(undefined);
    setUseImportForAuto(false);
    const ed = await readHistoricalDataFromFile();
    setExportData(ed);
    if (!ed) {
      return;
    }
    if (isIOS()) {
      setShowImportConfirm(true);
      return;
    }
    await inspectImport(ed);
  }

  async function inspectImport(ed: ExportData) {
    const hasConflicts = await checkIfDuplicatedHistoricalData(ed);
    if (hasConflicts) {
      setShowConflictResolverDialog(true);
    } else {
      await importData("IGNORE", ed);
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
    return importHistoricalData(cr, selectedData)
      .then(async (imported) => {
        if (!imported) {
          return;
        }
        if (isIOS() && folderReview && useImportForAuto && !folderReview.folder.normalized) {
          try {
            await invoke("ios_use_import_backup_folder", { path: folderReview.folder.directory });
            await saveAutoBackupDirectory(folderReview.folder.directory);
            setAutoBackupDirectory(folderReview.folder.directory);
            setBackupFolderFailure(null);
          } catch (error) {
            setBackupFolderFailure(String(error));
          }
        }
        setFolderReview(undefined);
        setUseImportForAuto(false);
        toast({ description: t("data.importSuccess") });
        if (onDataImported) {
          onDataImported();
        }
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

  async function onImportBackupFolderClick() {
    setFolderError("");
    setFolderReview(undefined);
    setUseImportForAuto(false);
    try {
      const selected = await chooseBackupLocation("import");
      if (!selected) return;
      setFolderBusy(true);
      setFolderPreparing(true);
      setFolderFromCloud(selected.includes("/Mobile Documents/") || selected.includes("/CloudDocs/"));
      await invoke("ios_prepare_backup_folder", { path: selected, kind: "import" });
      const folder = await findBackupFolder(selected);
      if (!folder) { setFolderError(t("data.folder.hint")); return; }
      const clients = await listBackupClients(folder.directory, selected);
      if (!clients.length && !folder.legacy) { setFolderError(t("data.folder.hint")); return; }
      setFolderReview({ folder, clients });
    } catch (error) {
      setFolderError(String(error).includes("timed out") ? t("data.folder.downloadTimeout") : t("data.folder.failed"));
    } finally { setFolderBusy(false); setFolderPreparing(false); }
  }

  async function onImportFolderClient(client?: string) {
    if (!folderReview) return;
    setFolderBusy(true);
    setFolderError("");
    try {
      const ed = client === undefined
        ? await readHistoricalDataFromPath(`${folderReview.folder.directory}/track3-auto-backup.json`)
        : await readBackupClient(folderReview.folder.directory, client);
      setExportData(ed);
      setShowImportConfirm(true);
    } catch (error) { setFolderError(String(error).includes("timed out") ? t("data.folder.downloadTimeout") : t("data.folder.failed")); }
    finally { setFolderBusy(false); }
  }

  async function onChooseAutoBackupFolderButtonClick() {
    folderChoiceVersion.current += 1;
    try {
    const selected = await chooseBackupLocation();
    if (selected) {
      const path = selected as string;
      await saveAutoBackupDirectory(path);
      setAutoBackupDirectory(path);
      setBackupFolderFailure(null);
      await loadAutoBackupTime();
    }
    } catch (error) { setBackupFolderFailure(String(error)); }
  }

  async function onUseDocumentsFolderClick() {
    folderChoiceVersion.current += 1;
    try {
      const path = await documentsBackupLocation();
      await saveAutoBackupDirectory(path);
      await invoke("ios_clear_backup_folder", { kind: "auto" });
      setAutoBackupDirectory(path);
      setBackupFolderFailure(null);
      await loadAutoBackupTime();
    } catch (error) { setBackupFolderFailure(String(error)); }
  }

  function onClearAutoBackupFolderButtonClick() {
    const path = autoBackupDirectory;
    if (!path) return;
    void runBackupFolderDelete({
      update: () => undefined,
      rollback: () => path,
      commit: async () => {
        await cleanAutoBackupDirectory();
        if (isIOS()) await invoke("ios_clear_backup_folder", { kind: "auto" });
        setBackupFolderFailure(null);
      },
      undo: async () => {
        if (isIOS()) await invoke("ios_undo_clear_backup_folder");
        await saveAutoBackupDirectory(path);
      },
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
      successMessage: t("data.removedFromBlacklist").replace("{symbol}", symbol),
      undoLabel: t("common.undo"),
      undoAltText: t("data.undoBlacklistRemoval"),
      undoWindowMs: 5000,
    });
  }

  const section = isIOS() ? searchParams.get("section") : null;
  const showBackup = !section || section === "backup";
  const showBlacklist = !section || section === "blacklist";
  const showSecurity = !section || section === "security";

  return (
    <div className="ios-d3-settings-content ios-d3-data-settings space-y-6">
      {showBackup && showImportConfirm && <ConfirmSheet title={t("data.restoreConfirm.title")} onDismiss={() => {
        setShowImportConfirm(false);
        setExportData(undefined);
      }}>
        <p className="py-2 text-center">{t("data.restoreConfirm.description")}</p>
        <Button variant="destructive" className="min-h-12 w-full" onClick={() => {
          setShowImportConfirm(false);
          if (exportData) void inspectImport(exportData);
        }}>{t("data.restoreConfirm.action")}</Button>
        <Button variant="outline" className="min-h-12 w-full" onClick={() => {
          setShowImportConfirm(false);
          setExportData(undefined);
        }}>{t("common.cancel")}</Button>
      </ConfirmSheet>}
      {showBackup && <Dialog
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
      </Dialog>}

      {!section && <div>
        <h3 className="text-lg font-medium tracking-tight">{t("data.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("data.subtitle")}
        </p>
      </div>}

      {showBackup && isIOS() && <div className="ios-d3-backup-actions">
        <div className="ios-d3-backup-import-section">
        <InsetGroup title={t("data.import")}>
          <button type="button" className="ios-d3-data-action-row" onClick={onImportDataClick}><span>{t("data.importButton")}</span><ChevronRightIcon aria-hidden="true" /></button>
          <button type="button" className="ios-d3-data-action-row" onClick={() => void onImportBackupFolderClick()} disabled={folderBusy}><span>{t("data.folder.import")}</span><ChevronRightIcon aria-hidden="true" /></button>
        </InsetGroup>
        <p className="ios-d3-settings-note ios-d3-import-note">{t("data.importDesc")}</p>
        <p className="ios-d3-settings-note">{t("data.folder.hint")}</p>
        {folderBusy && folderPreparing && <p role="status" className="ios-d3-settings-note">{t(folderFromCloud ? "data.folder.downloading" : "data.folder.checking")}</p>}
        {folderError && <p role="alert" className="text-sm text-destructive">{folderError}</p>}
        {folderReview && <InsetGroup title={t("data.folder.review")}>
          <div className="ios-d3-folder-review-info">
            {folderReview.folder.normalized && <p>{t("data.folder.normalized").replace("{folder}", folderReview.folder.directory.split("/").filter(Boolean).at(-1) ?? "/")}</p>}
            <p className="font-medium">{folderReview.folder.directory.split("/").filter(Boolean).at(-1) ?? "/"}</p>
          </div>
          {folderReview.clients.map(({ client, exportAt, months }) => <div key={client} className="ios-d3-folder-client">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{client}</p>
              <p className="text-muted-foreground">{t(months === 1 ? "data.folder.month" : "data.folder.months").replace("{count}", String(months))} · {t("data.folder.lastBackup").replace("{time}", new Date(exportAt).toLocaleString())}</p>
            </div>
            <Button size="sm" className="shrink-0" aria-label={t("data.folder.importClient").replace("{client}", client)} onClick={() => void onImportFolderClient(client)} disabled={folderBusy}>{t("data.importButton")}</Button>
          </div>)}
          {folderReview.folder.legacy && <div className="ios-d3-folder-client"><Button size="sm" variant="outline" onClick={() => void onImportFolderClient()} disabled={folderBusy}>{t("data.folder.importLegacy")}</Button></div>}
          {!folderReview.folder.normalized && <label className="ios-d3-folder-auto-option"><Checkbox checked={useImportForAuto} onCheckedChange={(checked) => setUseImportForAuto(checked === true)} />{t("data.folder.useForAuto")}</label>}
        </InsetGroup>}

        </div>
        <InsetGroup title={t("data.export")}>
          <div className="ios-d3-setting-switch-row">
            <Label htmlFor="exportConfigurationCheckbox">{t("data.includeConfig")}</Label>
            <Switch id="exportConfigurationCheckbox" checked={exportConfiguration} onCheckedChange={setExportConfiguration} aria-label={t("data.includeConfig")} />
          </div>
          <div className="ios-d3-setting-switch-row">
            <Label htmlFor="exportDataCheckbox">{t("data.includeHistory")}</Label>
            <Switch id="exportDataCheckbox" checked disabled aria-label={t("data.includeHistory")} />
          </div>
          <button type="button" className="ios-d3-data-action-row" onClick={onExportDataClick}><span>{t("data.exportButton")}</span><ChevronRightIcon aria-hidden="true" /></button>
          <button type="button" className="ios-d3-data-action-row" onClick={() => void onShareDataClick()}><span>{t("data.shareJSON")}</span><ChevronRightIcon aria-hidden="true" /></button>
        </InsetGroup>
      </div>}
      {showBackup && !isIOS() && <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("data.import")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("data.importDesc")}
            </p>
            <Button onClick={onImportDataClick} size="sm">
              {t("data.importButton")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("data.export")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="exportConfigurationCheckbox"
                checked={exportConfiguration}
                onCheckedChange={(v) => setExportConfiguration(!!v)}
              />
              <Label htmlFor="exportConfigurationCheckbox" className="text-sm touch:flex touch:min-h-11 touch:items-center">
                {t("data.includeConfig")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="exportDataCheckbox" checked={true} disabled />
              <Label htmlFor="exportDataCheckbox" className="text-sm touch:flex touch:min-h-11 touch:items-center">
                {t("data.includeHistory")}
              </Label>
            </div>
            <Button onClick={onExportDataClick} size="sm">
              {t("data.exportButton")}
            </Button>
            {isIOS() && <Button onClick={() => void onShareDataClick()} variant="outline" className="ml-2 min-h-11">
              {t("data.shareJSON")}
            </Button>}
          </CardContent>
        </Card>
      </div>}

      {showBackup && <Card className="ios-d3-auto-backup-setting">
        <CardHeader className="ios-d3-data-panel-header pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("data.autoBackup")}
          </CardTitle>
        </CardHeader>
        <CardContent className="ios-d3-data-panel-content space-y-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            {!isIOS() && <TooltipProvider>
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
            </TooltipProvider>}
            <span>
              {t("data.autoBackupDesc")}
            </span>
          </div>
          {isIOS() && <p className="text-sm text-muted-foreground">{t("data.folder.autoHint")}</p>}
          {isIOS() && <dl className="space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between gap-3">
              <dt>{t("data.mobile.lastBackupAt")}</dt>
              <dd>{lastBackupAt ? timeToDateStr(lastBackupAt, true) : t("data.na")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>{t("data.mobile.lastImportAt")}</dt>
              <dd>{lastImportAt ? timeToDateStr(lastImportAt, true) : t("data.na")}</dd>
            </div>
          </dl>}

          {isIOS() && backupFolderFailure && <p role="alert" className="text-sm text-destructive">{backupFailureMessage(backupFolderFailure)}</p>}
          {isIOS() && autoBackupDirectory && !backupFolderFailure && <p role="status" className="text-sm text-muted-foreground">{t("data.folder.ready")}</p>}
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div
              className={cn(
                "text-sm text-muted-foreground whitespace-nowrap overflow-x-auto scrollbar-hide",
                autoBackupDirectory ? "block" : "hidden",
              )}
            >
              {autoBackupDirectory}
            </div>
            <div className="ios-d3-backup-folder-actions flex flex-wrap items-center gap-2">
              <Button onClick={onChooseAutoBackupFolderButtonClick} size="sm">
                {t(backupFolderFailure ? "data.folder.chooseAgain" : "data.chooseFolder")}
              </Button>
              {isIOS() && <Button variant="outline" size="sm" onClick={() => void onUseDocumentsFolderClick()}>{t("data.useDocumentsFolder")}</Button>}
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

      {showBlacklist && <Card className="ios-d3-blacklist-setting">
        <CardHeader className="ios-d3-data-panel-header pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("data.blacklist")}
          </CardTitle>
        </CardHeader>
        <CardContent className="ios-d3-data-panel-content space-y-3">
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

      {showSecurity && isIOS() && <Card className="ios-d3-lock-setting">
        <CardContent className="space-y-3 pt-5">
          <div className="ios-d3-setting-switch-row">
            <Label htmlFor="app-lock-switch">{t("data.appLock.title")}</Label>
            <Switch id="app-lock-switch" aria-label={t("data.appLock.title")} checked={lockEnabled} disabled={lockBusy} onCheckedChange={() => void toggleAppLock()} />
          </div>
          <p className="text-sm text-muted-foreground">{t("data.appLock.description")}</p>
          {lockError && <p role="alert" className="text-sm text-destructive">{t("data.appLock.failed")}</p>}
        </CardContent>
      </Card>}

      {showSecurity && <Card className="ios-d3-encryption-setting">
        <CardHeader className="ios-d3-data-panel-header pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("data.encryption.key.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="ios-d3-data-panel-content space-y-3 text-sm">
          <p className="text-muted-foreground">
            {t("data.encryption.key.description")}
          </p>
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
          <Button onClick={handleChangeEncryptionKey} disabled={encKeySaving} size="sm">
            {encKeySaving
              ? t("data.encryption.key.saving")
              : t("data.encryption.key.update")}
          </Button>
        </CardContent>
      </Card>}
    </div>
  );
};

export default App;
