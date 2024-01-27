import { useToast } from "@/components/ui/use-toast";
import {
  checkIfDuplicatedHistoricalData,
  exportHistoricalData,
  importHistoricalData,
  readHistoricalDataFromFile,
} from "@/middlelayers/data";
import { useEffect, useState } from "react";

import _ from "lodash";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { open } from "@tauri-apps/api/dialog";
import "@/components/common/scrollbar/index.css";
import { UniqueIndexConflictResolver } from "@/middlelayers/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  cleanAutoBackupDirectory,
  getAutoBackupDirectory,
  saveAutoBackupDirectory,
} from "@/middlelayers/configuration";
import { ExportData } from '@/middlelayers/datamanager'

const App = ({ onDataImported }: { onDataImported?: () => void }) => {
  const { toast } = useToast();

  const [exportConfiguration, setExportConfiguration] = useState(false);
  const [showConflictResolverDialog, setShowConflictResolverDialog] =
    useState(false);

  const [exportData, setExportData] = useState<ExportData | undefined>(
    undefined
  );

  const [autoBackupDirectory, setAutoBackupDirectory] = useState<
    string | undefined
  >();

  useEffect(() => {
    getAutoBackupDirectory().then((d) => setAutoBackupDirectory(d));
  }, []);

  async function onExportDataClick() {
    const exported = await exportHistoricalData(exportConfiguration);
    if (exported) {
      toast({
        description: "export data successfully",
      });
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
      return importData("IGNORE");
    }
  }

  async function importData(cr: UniqueIndexConflictResolver) {
    if (!exportData) {
      toast({
        description: "no data to import",
        variant: "destructive",
      });
      return;
    }
    return importHistoricalData(cr, exportData)
      .then((imported) => {
        if (!imported) {
          return;
        }
        toast({
          description: "import data successfully",
        });

        onDataImported && onDataImported();
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

  function conflictResolverDialog() {
    return (
      <Dialog
        open={showConflictResolverDialog}
        onOpenChange={setShowConflictResolverDialog}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Conflicts Found!</DialogTitle>
            <DialogDescription>
              There are conflicts between the data you are importing and
              existing data, please choose how to resolve them.
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
    );
  }

  async function onChooseAutoBackupFolderButtonClick() {
    const selected = await open({
      multiple: false,
      directory: true,
    });

    if (selected) {
      const ss = selected as string;
      await saveAutoBackupDirectory(ss);
      setAutoBackupDirectory(ss);
    }
  }

  async function onClearAutoBackupFolderButtonClick() {
    await cleanAutoBackupDirectory();
    setAutoBackupDirectory(undefined);
  }

  return (
    <div className="space-y-6">
      {conflictResolverDialog()}
      <div>
        <h3 className="text-lg font-medium">Data Center</h3>
        <p className="text-sm text-muted-foreground">
          Export or import your data.
        </p>
      </div>

      <Separator className="my-6" />
      <div className="space-y-3">
        <div className="text-l font-bold text-left">Data Management</div>

        <div className="space-y-3">
          <div className="text-sm font-bold text-left">Import Data</div>

          <Button onClick={onImportDataClick} size="sm">
            Import
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-bold text-left py-2">
              Select Exported Data
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="exportConfigurationCheckbox"
                checked={exportConfiguration}
                onCheckedChange={(v) => setExportConfiguration(!!v)}
              />
              <Label
                htmlFor="exportConfigurationCheckbox"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Export Configuration
              </Label>
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox id="exportDataCheckbox" checked={true} disabled />
              <Label
                htmlFor="exportDataCheckbox"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Export Historical Data
              </Label>
            </div>
          </div>

          <Button onClick={onExportDataClick} size="sm">
            Export
          </Button>
        </div>
      </div>

      <Separator className="my-6" />
      <div className="space-y-3">
        <div className="text-l font-bold text-left">Data Backup</div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-bold text-left py-2">Auto Backup</div>
            <div className="text-sm text-left text-gray-400">
              Data will be automatically backed up to the target folder
            </div>
          </div>
          <div className="items-center grid gap-4 grid-cols-4">
            <div
              className={`text-muted-foreground col-span-4 md:col-span-2 text-sm whitespace-nowrap overflow-x-scroll scrollbar-hide ${
                autoBackupDirectory ? "block" : "hidden"
              }`}
            >
              {autoBackupDirectory}
            </div>
            <div className="space-x-2 col-span-4 md:col-span-2">
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
        </div>
      </div>
    </div>
  );
};

export default App;
