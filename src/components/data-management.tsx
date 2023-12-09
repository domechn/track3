import { useToast } from "@/components/ui/use-toast";
import {
  exportHistoricalData,
  importHistoricalData,
} from "@/middlelayers/data";
import { useState } from "react";

import _ from "lodash";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const App = ({
  onDataImported,
}: {
  onDataImported?: () => void;
}) => {
  const { toast } = useToast();

  const [exportConfiguration, setExportConfiguration] = useState(false);

  async function onExportDataClick() {
    const exported = await exportHistoricalData(exportConfiguration);
    if (exported) {
      toast({
        description: "export data successfully",
      });
    }
  }

  async function onImportDataClick() {
    return importHistoricalData()
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
      });
  }

  return (
    <div className="space-y-6">
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

          <Button onClick={onImportDataClick}>Import</Button>
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

          <Button onClick={onExportDataClick}>Export</Button>
        </div>
      </div>

      <Separator className="my-6" />
      <div className="space-y-3">
        <div className="text-l font-bold text-left">Data Backup</div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-bold text-left py-2">Auto Backup</div>

            <div className='text-sm'>TODO</div>
          </div>
          {/* <Button>Enable</Button> */}
        </div>
      </div>
    </div>
  );
};

export default App;
