import _ from "lodash";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { getVersion } from "@/utils/app";
import {
  cleanLicense,
  getLicenseIfIsPro,
  saveLicense,
} from "@/middlelayers/configuration";
import ViewIcon from "@/assets/icons/view-icon.png";
import HideIcon from "@/assets/icons/hide-icon.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import { LicenseCenter } from "@/middlelayers/license";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

const App = () => {
  const { toast } = useToast();
  const [version, setVersion] = useState<string>("0.1.0");

  const [activeLicense, setActiveLicense] = useState<string | undefined>();
  const [inputLicense, setInputLicense] = useState<string | undefined>();
  const [showLicense, setShowLicense] = useState(false);
  const [saveLicenseLoading, setSaveLicenseLoading] = useState(false);
  const [inactiveLicenseLoading, setInactiveLicenseLoading] = useState(false);

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
      setActiveLicense(license);
      setInputLicense(license);
    });
  }

  function onSaveLicenseClick() {
    if (!inputLicense) {
      return;
    }
    setSaveLicenseLoading(true);

    activeDevice(inputLicense)
      .then(() => {
        setActiveLicense(inputLicense);
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

  function onInactiveLicenseClick() {
    // sleep 3s
    if (!activeLicense) {
      return;
    }
    setInactiveLicenseLoading(true);
    inactiveDevice(activeLicense)
      .then(() => {
        setActiveLicense(undefined);
        setInputLicense(undefined);
        toast({
          description: "Device Is Inactived",
        });
      })
      .catch((err) => {
        toast({
          description: err.message,
          variant: "destructive",
        });
      })
      .finally(() => {
        setInactiveLicenseLoading(false);
      });
  }

  async function inactiveDevice(license: string) {
    const inactiveRes = await LicenseCenter.getInstance().inactiveLicense(
      license
    );

    if (!inactiveRes.success) {
      throw new Error(inactiveRes.error ?? "Inactive device failed");
    }

    await cleanLicense();
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
    setInputLicense(val);
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
            value={inputLicense ?? ""}
            type={showLicense ? "text" : "password"}
            onChange={(e) => onLicenseInputChange(e.target.value)}
            placeholder="License Key"
            className="w-[400px]"
            disabled={!!activeLicense}
          />
          <a
            onClick={onViewOrHideClick}
            className={activeLicense || inputLicense ? "" : " hidden"}
          >
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
            disabled={saveLicenseLoading}
            className={activeLicense ? "hidden" : "flex"}
          >
            {saveLicenseLoading && (
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
            )}
            Active
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className={activeLicense ? "flex" : "hidden"}
                disabled={inactiveLicenseLoading}
              >
                {inactiveLicenseLoading && (
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                Inactive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onInactiveLicenseClick}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default App;
