import { useToast } from "@/components/ui/use-toast";
import {
  exportHistoricalData,
  importHistoricalData,
} from "@/middlelayers/data";
import { useEffect, useState } from "react";

import _ from "lodash";
import {
  forceSyncAssetsToCloudFromLocal,
  getCloudSyncConfiguration,
  getLocalLastSyncTime,
  getPublicKey,
  onAuthStateUpdate,
  saveCloudSyncConfiguration,
  sendVerifyCode,
  signIn,
  signOut,
  syncAssetsToCloudAndLocal,
} from "@/middlelayers/cloudsync";
import { timestampToDate } from "@/utils/date";
import { trackEventWithClientID } from "@/utils/app";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ReloadIcon,
  UploadIcon,
  ExitIcon,
  EnterIcon,
} from "@radix-ui/react-icons";
import { Input } from "@/components/ui/input";

const App = ({
  onDataImported,
  onDataSynced,
}: {
  onDataImported?: () => void;
  onDataSynced?: () => void;
}) => {
  const { toast } = useToast();
  const [email, setEmail] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [isLogin, setIsLogin] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [sendVerifyCodeDisabledSeconds, setSendVerifyCodeDisabledSeconds] =
    useState<number>(0);
  const [signLoading, setSignLoading] = useState<boolean>(false);
  const [lastSyncAt, setLastSyncAt] = useState<number>(0);
  const [enableAutoSync, setEnableAutoSync] = useState<boolean>(false);
  const [sendEmailLoading, setSendEmailLoading] = useState<boolean>(false);

  const [syncDataLoading, setSyncDataLoading] = useState<boolean>(false);
  const [forceSyncDataLoading, setForceSyncDataLoading] =
    useState<boolean>(false);
  const [exportConfiguration, setExportConfiguration] = useState(false);

  useEffect(() => {
    onAuthStateUpdate((authState) => {
      setIsLogin(!!authState);
      if (!authState) {
        return;
      }
      setPublicKey(authState.publicKey);
      setLoginEmail(authState.email);
    });

    getCloudSyncConfiguration().then((config) => {
      setEnableAutoSync(config.enableAutoSync);
    });
  }, []);

  useEffect(() => {
    updateLastSyncAt();
  }, [publicKey]);

  useEffect(() => {
    saveCloudSyncConfiguration({
      enableAutoSync,
    });
  }, [enableAutoSync]);

  // if force is true, replace all data in cloud with local data
  // if force is false, only sync data that is updated after lastSyncAt
  async function syncDataBetweenCloudAndLocal(force = false) {
    if (force) {
      setForceSyncDataLoading(true);
    } else {
      setSyncDataLoading(true);
    }
    try {
      // query last cloud sync time
      const pk = publicKey || (await getPublicKey());
      const lastSyncAt = await getLocalLastSyncTime(pk);

      const updated = force
        ? await forceSyncAssetsToCloudFromLocal(pk)
        : await syncAssetsToCloudAndLocal(pk, lastSyncAt);
      if (updated) {
        toast({
          description: "data is synced successfully",
        });
      } else {
        toast({
          description: "no data need to be synced",
        });
      }

      // update lastSyncAt
      await updateLastSyncAt();
      // callback
      onDataSynced && onDataSynced();
    } catch (e: any) {
      toast({
        description: e.message || e,
        variant: "destructive",
      });
    } finally {
      if (force) {
        setForceSyncDataLoading(false);
      } else {
        setSyncDataLoading(false);
      }
    }
  }

  async function updateLastSyncAt() {
    if (publicKey) {
      const lst = await getLocalLastSyncTime(publicKey);
      setLastSyncAt(lst || 0);
    }
  }

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

  async function onSignClick() {
    try {
      setSignLoading(true);
      if (isLogin) {
        await signOut();
        return;
      }
      if (!email || !verificationCode) {
        toast({
          description: "email or verification code is empty",
          variant: "destructive",
        });
        return;
      }
      await signIn(email, verificationCode);

      trackEventWithClientID("sign_in");
    } catch (e: any) {
      const msg = e.message || e;
      if (msg.includes("400")) {
        toast({
          description: "invalid verification code",
          variant: "destructive",
        });
        return;
      }
      toast({
        description: e.message || e,
        variant: "destructive",
      });
    } finally {
      setSignLoading(false);
    }
  }

  async function onVerificationButtonClick() {
    if (!email) {
      toast({
        description: "email is empty",
        variant: "destructive",
      });
      return;
    }

    // validate email by regex
    const emailRegex = new RegExp(
      // eslint-disable-next-line no-control-regex
      "^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$"
    );
    if (!emailRegex.test(email)) {
      toast({
        description: "invalid email",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendEmailLoading(true);
      await sendVerifyCode(email);
      toast({
        description: "verification code sent",
      });
      // set button to disabled, and count down 60s
      let countDown = 60;
      setSendVerifyCodeDisabledSeconds(countDown);
      const interval = setInterval(() => {
        countDown--;
        setSendVerifyCodeDisabledSeconds(countDown);
        if (countDown === 0) {
          clearInterval(interval);
        }
      }, 1000);
    } catch (e: any) {
      toast({
        description: e.message || e,
        variant: "destructive",
      });
    } finally {
      setSendEmailLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Data Center</h3>
        <p className="text-sm text-muted-foreground">
          Sync your data to cloud, and access it from anywhere.
        </p>
      </div>
      <Separator />

      <div>
        <div className="text-l font-bold text-left">
          Cloud Data Sync {!isLogin && "( Need Login )"}
        </div>
        <div className="text-sm text-left text-gray-400">
          Powered by polybase.xyz
        </div>
        {isLogin ? (
          <div>
            <div className="mt-2 mb-2">User: {loginEmail}</div>
            <Button variant="destructive" onClick={onSignClick}>
              <ExitIcon className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          <div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              className="w-80 mb-2 mt-2"
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex mb-2 mt-2">
              <Input
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="code"
                type="number"
                className="w-40"
              />
              <Button
                id="send-verification-code"
                onClick={onVerificationButtonClick}
                className="ml-1 wd-40"
                disabled={sendVerifyCodeDisabledSeconds > 0}
              >
                {sendEmailLoading && (
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Code
                {sendVerifyCodeDisabledSeconds > 0 &&
                  ` (${sendVerifyCodeDisabledSeconds}s)`}
              </Button>
            </div>

            <Button onClick={onSignClick} disabled={signLoading}>
              {signLoading ? (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <EnterIcon className="mr-2 h-4 w-4" />
              )}
              Sign In
            </Button>
          </div>
        )}
      </div>

      {isLogin && (
        <div>
          <div className="text-gray-600 mb-2">
            Last Sync At:{" "}
            {lastSyncAt ? timestampToDate(lastSyncAt, true) : "Never"}
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enableAutoSync"
              checked={enableAutoSync}
              onCheckedChange={(v) => setEnableAutoSync(!!v)}
            />
            <Label
              htmlFor="enableAutoSync"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Enable AutoSync ( 24h )
            </Label>
          </div>
          <Button
            className="mt-2"
            onClick={() => syncDataBetweenCloudAndLocal()}
            disabled={forceSyncDataLoading || syncDataLoading}
          >
            {syncDataLoading ? (
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="mr-2 h-4 w-4" />
            )}
            Sync Data ( Beta )
          </Button>
          <Button
            variant="destructive"
            className="ml-2"
            onClick={() => syncDataBetweenCloudAndLocal(true)}
            disabled={forceSyncDataLoading || syncDataLoading}
          >
            {forceSyncDataLoading ? (
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="mr-2 h-4 w-4" />
            )}
            Hard Sync Data ( Beta )
          </Button>
        </div>
      )}

      <Separator className="my-6" />
      <div className="space-y-3">
        <div className="text-l font-bold text-left">Data Management</div>
        <div className="text-sm font-bold text-left">Import Data</div>

        <Button onClick={onImportDataClick}>Import</Button>

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
  );
};

export default App;
