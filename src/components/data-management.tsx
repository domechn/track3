import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { useOptimisticDelete } from "@/components/common/use-optimistic-delete";
import {
  checkIfDuplicatedHistoricalData,
  exportHistoricalData,
  importHistoricalData,
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
  removeFromBlacklist,
  saveAutoBackupDirectory,
} from "@/middlelayers/configuration";
import { ExportData } from "@/middlelayers/datamanager";
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

const App = ({ onDataImported }: { onDataImported?: () => void }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const section = useOutletContext<string | null>();
  const showBackup = !section || section === "backup";
  const showBlacklist = !section || section === "blacklist";
  const showSecurity = !section || section === "security";
  const [exportConfiguration, setExportConfiguration] = useState(false);
  const [showConflictResolverDialog, setShowConflictResolverDialog] =
    useState(false);
  const [exportData, setExportData] = useState<ExportData | undefined>(
    undefined,
  );
  const [autoBackupDirectory, setAutoBackupDirectory] = useState<string>();
  const { run: runBackupFolderDelete } = useOptimisticDelete(setAutoBackupDirectory);
  const [lastBackupAt, setLastBackupAt] = useState<Date>();
  const [lastImportAt, setLastImportAt] = useState<Date>();
  const [backupSummary, setBackupSummary] = useState<BackupSummary>();
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const { run: runBlacklistDelete } = useOptimisticDelete(setBlacklist);
  const [encKeyInput, setEncKeyInput] = useState("");
  const [encKeyConfirm, setEncKeyConfirm] = useState("");
  const [encKeySaving, setEncKeySaving] = useState(false);
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
    const exported = await exportHistoricalData(exportConfiguration);
    if (exported) {
      toast({ description: t("data.exportSuccess") });
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
      importData("IGNORE");
    }
  }

  async function importData(cr: UniqueIndexConflictResolver) {
    if (!exportData) {
      toast({
        description: t("data.noDataToImport"),
        variant: "destructive",
      });
      return;
    }
    return importHistoricalData(cr, exportData)
      .then((imported) => {
        if (!imported) {
          return;
        }
        toast({ description: t("data.importSuccess") });
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
      successMessage: t("data.removedFromBlacklist").replace("{symbol}", symbol),
      undoLabel: t("common.undo"),
      undoAltText: t("data.undoBlacklistRemoval"),
      undoWindowMs: 5000,
    });
  }

  return (
    <div className="space-y-6">
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

      <div>
        <h3 className="text-lg font-medium tracking-tight">{t(section === "backup" ? "settings.phase6.backup" : section === "blacklist" ? "settings.phase6.blacklist" : section === "security" ? "settings.phase6.security" : "data.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("data.subtitle")}
        </p>
      </div>

      {showBackup && <Card role="region" aria-label={t("data.phase6.onDevice")}>
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

      {showBackup && <div className="grid gap-4 sm:grid-cols-2">
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
              <Label htmlFor="exportConfigurationCheckbox" className="min-w-0 flex-1 cursor-pointer text-sm">
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

      {showBackup && <Card>
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

      {showSecurity && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("data.encryption.key.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
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
