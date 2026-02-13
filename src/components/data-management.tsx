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
  getLastAutoImportAt,
  getLastAutoBackupAt,
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
import { cn } from "@/lib/utils";
import "@/components/common/scrollbar/index.css";

const App = ({ onDataImported }: { onDataImported?: () => void }) => {
  const { toast } = useToast();
  const [exportConfiguration, setExportConfiguration] = useState(false);
  const [showConflictResolverDialog, setShowConflictResolverDialog] =
    useState(false);
  const [exportData, setExportData] = useState<ExportData | undefined>(undefined);
  const [autoBackupDirectory, setAutoBackupDirectory] = useState<string>();
  const [lastBackupAt, setLastBackupAt] = useState<Date>();
  const [lastImportAt, setLastImportAt] = useState<Date>();

  useEffect(() => {
    loadAutoBackupDirectory().then((isSet) => {
      if (isSet) {
        loadAutoBackupTime();
      }
    });
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
      toast({ description: "Export data successfully" });
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
        description: "No data to import",
        variant: "destructive",
      });
      return;
    }
    return importHistoricalData(cr, exportData)
      .then((imported) => {
        if (!imported) {
          return;
        }
        toast({ description: "Import data successfully" });
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

  return (
    <div className="space-y-6">
      <Dialog
        open={showConflictResolverDialog}
        onOpenChange={setShowConflictResolverDialog}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Conflicts Found</DialogTitle>
            <DialogDescription>
              Imported records overlap with existing history. Choose how to resolve
              duplicated entries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => importData("REPLACE")}>Overwrite</Button>
            <Button onClick={() => importData("IGNORE")} variant="outline">
              Ignore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h3 className="text-lg font-medium">Data Center</h3>
        <p className="text-sm text-muted-foreground">
          Import, export and backup your local data safely.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Import Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Load exported file and merge with current records.
            </p>
            <Button onClick={onImportDataClick} size="sm">
              Import
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Export Data
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
                Include configuration
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="exportDataCheckbox" checked={true} disabled />
              <Label htmlFor="exportDataCheckbox" className="text-sm">
                Include historical data
              </Label>
            </div>
            <Button onClick={onExportDataClick} size="sm">
              Export
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Auto Backup
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
                      Last Backup At:{" "}
                      {lastBackupAt ? timeToDateStr(lastBackupAt, true) : "N/A"}
                    </div>
                    <div>
                      Last Import At:{" "}
                      {lastImportAt ? timeToDateStr(lastImportAt, true) : "N/A"}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span>
              Data is automatically backed up every 24h or after refresh when a
              backup folder is configured.
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div
              className={cn(
                "text-sm text-muted-foreground whitespace-nowrap overflow-x-auto scrollbar-hide",
                autoBackupDirectory ? "block" : "hidden"
              )}
            >
              {autoBackupDirectory}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onChooseAutoBackupFolderButtonClick} size="sm">
                Choose Folder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearAutoBackupFolderButtonClick}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
