import _ from "lodash";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { getVersion } from "@/utils/app";
import { getLicenseIfIsPro, saveLicense } from "@/middlelayers/configuration";
import ViewIcon from "@/assets/icons/view-icon.png";
import HideIcon from "@/assets/icons/hide-icon.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { LicenseCenter } from "@/middlelayers/license";
import { useToast } from "@/components/ui/use-toast";

const App = () => {
  const { toast } = useToast();
  const [version, setVersion] = useState<string>("0.1.0");

  const [license, setLicense] = useState<string | undefined>();
  const [showLicense, setShowLicense] = useState(false);
  const [licenseChanged, setLicenseChanged] = useState<boolean>(false);
  const [saveLicenseLoading, setSaveLicenseLoading] = useState(false);

  useEffect(() => {
    loadVersion();
    loadLicense();
  }, []);

  function loadVersion() {
    getVersion().then((ver) => {
      setVersion(ver);
    });
  }

  function loadLicense() {
    getLicenseIfIsPro().then((license) => {
      setLicense(license);
    });
  }

  function onSaveLicenseClick() {
    if (!license) {
      return;
    }
    setSaveLicenseLoading(true);

    activeDevice(license)
      .then(() => {
        toast({
          description: "License Key Saved",
        });
      })
      .catch((err) => {
        toast({
          description: err.message,
          variant: "destructive",
        });
      })
      .finally(() => {
        setSaveLicenseLoading(false);
      });
  }

  async function activeDevice(license: string) {
    const validRes = await LicenseCenter.getInstance().validateLicense(license);
    if (!validRes.isValid) {
      throw new Error("Invalid License Key");
    }
    const activeRes = await LicenseCenter.getInstance().activeLicense(license);
    if (!activeRes.success) {
      throw new Error(activeRes.error ?? "Active License Failed");
    }

    await saveLicense(license);
  }

  function onLicenseInputChange(val: string) {
    setLicenseChanged(true);
    setLicense(val);
  }

  function onViewOrHideClick() {
    setShowLicense(!showLicense);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">System Info</h3>
        <p className="text-sm text-muted-foreground">
          Show basic system information
        </p>
      </div>
      <Separator />

      <div className="space-y-3">
        <div className="text-l font-bold text-left">Version</div>
        <div className="text-sm text-left text-gray-400">{version}</div>
      </div>

      <div className="space-y-3">
        <div className="text-l font-bold text-left">Pro Version</div>
        <div className="text-sm text-left text-gray-400">
          Enter License Key To Active Pro Version ({" "}
          <a
            href="https://track3.notion.site/How-to-get-license-key-by-free-a5e0e39614f54a06ab19ca5aaed58404?pvs=4"
            target="_blank"
            className="text-blue-500 underline"
          >
            How to get free license key?
          </a>{" "}
          )
        </div>
        <div className="flex space-x-2">
          <Input
            id="license"
            value={license ?? ""}
            type={showLicense ? "text" : "password"}
            onChange={(e) => onLicenseInputChange(e.target.value)}
            placeholder="License Key"
            className="w-[400px]"
          />
          <a onClick={onViewOrHideClick}>
            <img
              className="view-or-hide-icon mt-1"
              src={showLicense ? ViewIcon : HideIcon}
              alt="view-or-hide"
              width={25}
              height={25}
            />
          </a>
          <Button
            onClick={onSaveLicenseClick}
            disabled={saveLicenseLoading || !licenseChanged}
          >
            {saveLicenseLoading && (
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
            )}
            Active
          </Button>
        </div>
      </div>
    </div>
  );
};

export default App;
