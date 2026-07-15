import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { useToast } from "@/components/ui/use-toast";
import {
  checkIfDuplicatedHistoricalData,
  exportHistoricalData,
  importHistoricalData,
  readHistoricalDataFromFile,
} from "@/middlelayers/data";
import { UniqueIndexConflictResolver } from "@/middlelayers/types";
import {
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

const App = ({ onDataImported }: { onDataImported?: () => void }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [exportConfiguration, setExportConfiguration] = useState(false);
  const [showConflictResolverDialog, setShowConflictResolverDialog] =
    useState(false);
  const [exportData, setExportData] = useState<ExportData | undefined>(
    undefined,
  );
  const [autoBackupDirectory, setAutoBackupDirectory] = useState<string>();
  const [lastBackupAt, setLastBackupAt] = useState<Date>();
  const [lastImportAt, setLastImportAt] = useState<Date>();
  const [blacklist, setBlacklist] = useState<string[]>([]);
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
      toast({ description, variant: "destructive" });
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
      })
      .catch((err) => {
        toast({
          description: err.message || err,
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

  async function onClearAutoBackupFolderButtonClick() {
    await cleanAutoBackupDirectory();
    setAutoBackupDirectory(undefined);
  }

  async function onRemoveFromBlacklist(symbol: string) {
    await removeFromBlacklist(symbol);
    setBlacklist((prev) =>
      prev.filter((s) => s.toUpperCase() !== symbol.toUpperCase()),
    );
    toast({ description: t("data.removedFromBlacklist").replace("{symbol}", symbol) });
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
        <h3 className="text-lg font-medium tracking-tight">{t("data.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("data.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
              <Label htmlFor="exportConfigurationCheckbox" className="text-sm">
                {t("data.includeConfig")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="exportDataCheckbox" checked={true} disabled />
              <Label htmlFor="exportDataCheckbox" className="text-sm">
                {t("data.includeHistory")}
              </Label>
            </div>
            <Button onClick={onExportDataClick} size="sm">
              {t("data.exportButton")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
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
              <Button
                variant="outline"
                size="sm"
                onClick={onClearAutoBackupFolderButtonClick}
              >
                {t("data.clearFolder")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
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
                  <button
                    aria-label={t("data.removeFromBlacklistAria").replace("{symbol}", symbol)}
                    className="text-muted-foreground hover:text-foreground transition-colors text-xs leading-none"
                    onClick={() => onRemoveFromBlacklist(symbol)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
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
      </Card>
    </div>
  );
};

export default App;
