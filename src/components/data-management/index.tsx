import { toast } from "react-hot-toast";
import {
  exportHistoricalData,
  importHistoricalData,
} from "../../middlelayers/data";
import "./index.css";
import { useContext, useEffect, useRef, useState } from "react";

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
} from "../../middlelayers/cloudsync";
import { LoadingContext } from "../../App";
import { timestampToDate } from "../../utils/date";
import { trackEventWithClientID } from '../../utils/app'

const App = ({
  onDataImported,
  onDataSynced,
}: {
  onDataImported?: () => void;
  onDataSynced?: () => void;
}) => {
  const [email, setEmail] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [isLogin, setIsLogin] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState<string>("");
  const sendVerifyCodeRef = useRef<HTMLButtonElement>(null);
  const signInRef = useRef<HTMLButtonElement>(null);
  const { setLoading } = useContext(LoadingContext);
  const [lastSyncAt, setLastSyncAt] = useState<number>(0);
  const [enableAutoSync, setEnableAutoSync] = useState<boolean>(false);

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
    setLoading(true);
    try {
      // query last cloud sync time
      const pk = publicKey || (await getPublicKey());
      const lastSyncAt = await getLocalLastSyncTime(pk);

      const updated = force
        ? await forceSyncAssetsToCloudFromLocal(pk)
        : await syncAssetsToCloudAndLocal(pk, lastSyncAt);
      if (updated) {
        toast.success("data is synced successfully");
      } else {
        toast.success("no data need to be synced");
      }

      // update lastSyncAt
      await updateLastSyncAt();
      // callback
      onDataSynced && onDataSynced();
    } catch (e: any) {
      toast.error(e.message || e);
    } finally {
      setLoading(false);
    }
  }

  async function updateLastSyncAt() {
    if (publicKey) {
      const lst = await getLocalLastSyncTime(publicKey);
      setLastSyncAt(lst || 0);
    }
  }

  async function onExportDataClick() {
    const exported = await exportHistoricalData();
    if (exported) {
      toast.success("export data successfully");
    }
  }

  async function onImportDataClick() {
    return importHistoricalData()
      .then((imported) => {
        if (!imported) {
          return;
        }
        toast.success("import data successfully");

        onDataImported && onDataImported();
      })
      .catch((err) => {
        toast.error(err.message || err);
      });
  }

  async function onSignClick() {
    try {
      setLoading(true);
      if (isLogin) {
        await signOut();
        return;
      }
      if (!email || !verificationCode) {
        toast.error("email or verification code is empty");
        return;
      }
      if (signInRef.current) {
        signInRef.current!.disabled = true;
      }
      try {
        await signIn(email, verificationCode);

        await trackEventWithClientID("sign_in")
      } finally {
        if (signInRef.current) {
          signInRef.current!.disabled = false;
        }
      }
    } catch (e: any) {
      const msg = e.message || e;
      if (msg.includes("400")) {
        toast.error("invalid verification code");
        return;
      }
      toast.error(e.message || e);
    } finally {
      setLoading(false);
    }
  }

  async function onVerificationButtonClick() {
    if (!email) {
      toast.error("email is empty");
      return;
    }

    // validate email by regex
    const emailRegex = new RegExp(
      // eslint-disable-next-line no-control-regex
      "^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$"
    );
    if (!emailRegex.test(email)) {
      toast.error("invalid email");
      return;
    }

    try {
      setLoading(true);
      await sendVerifyCode(email);
      toast.success("verification code sent");
      // set button to disabled, and count down 60s
      let countDown = 60;
      const interval = setInterval(() => {
        countDown--;
        if (countDown <= 0) {
          clearInterval(interval);
          if (sendVerifyCodeRef.current) {
            sendVerifyCodeRef.current!.disabled = false;
          }
          return;
        }
        if (sendVerifyCodeRef.current) {
          sendVerifyCodeRef.current!.disabled = true;
          sendVerifyCodeRef.current!.innerText = `Send Code (${countDown})`;
        }
      }, 1000);
    } catch (e: any) {
      toast.error(e.message || e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dataManagement">
      <h2>Data Center</h2>
      <div>
        <h3
          style={{
            marginBottom: 0,
          }}
        >
          Cloud Data Sync {!isLogin && "( Need Login )"}
        </h3>
        <sub
          style={{
            color: "gray",
          }}
        >
          Powered by polybase.xyz
        </sub>
        {isLogin ? (
          <div>
            <h4
              style={{
                marginTop: 5,
                marginBottom: 5,
              }}
            >
              User: {loginEmail}
            </h4>
            <button
              style={{
                marginTop: 0,
                backgroundColor: "#FF4500",
                color: "white",
              }}
              onClick={onSignClick}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div>
            <div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  marginTop: 0,
                }}
                placeholder="email"
              />
            </div>
            <div>
              <input
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="code"
                type="number"
                style={{
                  width: "130px",
                }}
              />
              <button
                id="send-verification-code"
                ref={sendVerifyCodeRef}
                onClick={onVerificationButtonClick}
                style={{
                  marginLeft: "10px",
                  width: "160px",
                  fontSize: "12px",
                }}
              >
                Send Code
              </button>
            </div>

            <button ref={signInRef} onClick={onSignClick}>
              Sign In
            </button>
          </div>
        )}
      </div>

      {isLogin && (
        <div>
          <h4
            style={{
              marginBottom: 10,
            }}
          >
            Last Sync At:{" "}
            {lastSyncAt ? timestampToDate(lastSyncAt, true) : "Never"}
          </h4>
          <div>
            <input
              style={{
                width: 25,
                height: 16,
                marginTop: 0,
                cursor: "pointer",
              }}
              type="checkbox"
              name="enableAutoSync"
              checked={enableAutoSync}
              onChange={(e) => setEnableAutoSync(e.target.checked)}
            />
            <span
              style={{
                display: "inline-block",
              }}
            >
              Enable AutoSync ( 24h )
            </span>
          </div>
          <button
            style={{
              marginTop: 10,
            }}
            onClick={()=>syncDataBetweenCloudAndLocal()}
          >
            Sync Data ( Beta )
          </button>
          <br />
          <button
            style={{
              marginTop: 10,
              backgroundColor: "#FF4500",
              color: "white",
            }}
            onClick={()=>syncDataBetweenCloudAndLocal(true)}
          >
            Hard Sync Data ( Beta )
          </button>
        </div>
      )}

      <h3>Data Management</h3>

      <div>
        <button
          onClick={onImportDataClick}
          style={{
            marginTop: 0,
          }}
        >
          Import Data
        </button>
      </div>

      <div>
        <button onClick={onExportDataClick}>Export Data</button>
      </div>
    </div>
  );
};

export default App;
