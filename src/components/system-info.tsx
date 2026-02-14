import { useEffect, useState } from "react";
import {
  cleanLicense,
  getLicenseIfIsPro,
  saveLicense,
} from "@/middlelayers/configuration";
import ViewIcon from "@/assets/icons/view-icon.png";
import HideIcon from "@/assets/icons/hide-icon.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getVersion } from "@/utils/app";

const App = ({
  onProStatusChange,
}: {
  onProStatusChange: (active: boolean) => void;
}) => {
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
    getVersion().then(setVersion);
  }

  function loadLicense() {
    getLicenseIfIsPro().then((license) => {
      setActiveLicense(license);
      setInputLicense(license);
    });
  }

  async function inactiveDevice(license: string) {
    const inactiveRes = await LicenseCenter.getInstance().inactiveLicense(license);
    if (!inactiveRes.success) {
      throw new Error(inactiveRes.error ?? "Inactive device failed");
    }
    await cleanLicense();
    onProStatusChange(false);
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
    onProStatusChange(true);
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
          description: "License key saved",
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
    if (!activeLicense) {
      return;
    }
    setInactiveLicenseLoading(true);
    inactiveDevice(activeLicense)
      .then(() => {
        setActiveLicense(undefined);
        setInputLicense(undefined);
        toast({
          description: "Device is inactived",
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">System Info</h3>
        <p className="text-sm text-muted-foreground">
          View app version and manage Pro license state.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              App Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{version}</div>
            <p className="text-xs text-muted-foreground">Current installed build</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pro Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {activeLicense ? "Activated" : "Not Activated"}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeLicense ? "License already bound to this device" : "Enter a license key to activate Pro"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pro License
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your license key to activate Pro.{" "}
            <a
              href="https://track3.notion.site/How-to-get-license-key-by-free-a5e0e39614f54a06ab19ca5aaed58404?pvs=4"
              target="_blank"
              className="underline"
            >
              How to get free license key?
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="license"
              autoComplete="off"
              value={inputLicense ?? ""}
              type={showLicense ? "text" : "password"}
              onChange={(e) => setInputLicense(e.target.value)}
              placeholder="License Key"
              className="w-full max-w-[520px]"
              disabled={!!activeLicense}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowLicense(!showLicense)}
              className={activeLicense || inputLicense ? "" : "hidden"}
            >
              <img
                className="view-or-hide-icon"
                src={showLicense ? ViewIcon : HideIcon}
                alt="view-or-hide"
                width={18}
                height={18}
              />
            </Button>
            <Button
              onClick={onSaveLicenseClick}
              disabled={saveLicenseLoading}
              className={activeLicense ? "hidden" : "inline-flex"}
            >
              {saveLicenseLoading && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Activate
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className={activeLicense ? "inline-flex" : "hidden"}
                  disabled={inactiveLicenseLoading}
                >
                  {inactiveLicenseLoading && (
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Inactivate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Inactivate this device?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Current license binding on this device will be removed.
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
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
