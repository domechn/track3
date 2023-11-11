import _ from "lodash";
import { Separator } from "./ui/separator";
import { useEffect, useState } from "react";
import { getVersion } from "@/utils/app";
import { getLicenseIfIsPro, saveLicense } from "@/middlelayers/configuration";
import ViewIcon from "@/assets/icons/view-icon.png";
import HideIcon from "@/assets/icons/hide-icon.png";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { LicenseCenter } from "@/middlelayers/license";
import toast from "react-hot-toast";

const App = () => {
  const [version, setVersion] = useState<string>("0.1.0");

  const [license, setLicense] = useState<string | undefined>();
  const [showLicense, setShowLicense] = useState(false);
  const [licenseChanged, setLicenseChanged] = useState<boolean>(false);
  const [saveLicenseLoading, setSaveLicenseLoading] = useState(false);

  // to show hidden function
  const [versionClickTimes, setVersionClickTimes] = useState<number>(0);

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

    LicenseCenter.getInstance()
      .validateLicense(license)
      .then((result) => {
        if (result.isPro) {
          saveLicense(license);
          toast.success("License Key Saved");
        } else {
          toast.error("Invalid License Key");
        }
      })
      .finally(() => {
        setSaveLicenseLoading(false);
      });
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
        <div
          className="text-sm text-left text-gray-400"
          onClick={() => setVersionClickTimes(versionClickTimes + 1)}
        >
          {version}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-l font-bold text-left">Pro Version</div>
        <div className="text-sm text-left text-gray-400">
          Enter License Key To Active Pro Version ( Coming Soon )
        </div>
        <div className={versionClickTimes >= 5 ? "flex" : "hidden"}>
          <Input
            id="license"
            value={license ?? ""}
            type={showLicense ? "text" : "password"}
            onChange={(e) => onLicenseInputChange(e.target.value)}
            placeholder="License Key"
            className="w-[400px] mr-2"
          />
          <a onClick={onViewOrHideClick} className="mr-2">
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
