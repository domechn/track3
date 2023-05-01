import { useEffect, useState } from "react";
import "./index.css";
import gearIcon from "./gear-icon.png";
import SimpleEditor from "../simple-editor";
import {
  getConfiguration,
  saveConfiguration,
} from "../../middlelayers/configuration";
import Loading from "../common/loading";
import { Toaster, toast } from "react-hot-toast";

const initialConfiguration = `configs:
  groupUSD: true # combine all USD stablecoins into USDT
exchanges:
  - name: binance
    initParams:
      apiKey: # readonly api key
      secret:
  - name: okex
    initParams:
      apiKey: # readonly api key
      secret:
      password:
erc20:
  addresses:
    - ""
btc:
  addresses:
    - ""
sol:
  addresses:
    - ""
doge:
  addresses:
    - ""

others:
  - symbol: USDT
    amount: 1000
`;

const Configuration = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    getConfiguration()
      .then((d) => setConfiguration(d?.data ?? initialConfiguration))
      .finally(() => setLoading(false));
  }, []);

  const handleButtonClick = () => {
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    document.body.style.overflow = "auto";
  };

  function onEditorSubmit(val: string) {
    setLoading(true);
    let saveError: Error | undefined;

    saveConfiguration(val)
      .then(() => setIsModalOpen(false))
      .catch((e) => (saveError = e))
      .finally(() => {
        setLoading(false);

        if (saveError) {
          toast.error(saveError.message);
        } else {
          toast.success("Configuration updated successfully!");
        }
      });
  }

  return (
    <div>
      <Loading loading={loading} />
      <Toaster />
      <button className="gear-button" onClick={handleButtonClick}>
        <img
          src={gearIcon}
          alt="gear"
          style={{
            border: 0,
            height: 30,
            width: 30,
          }}
        />
      </button>
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Configuration</h2>
            <SimpleEditor data={configuration} onSubmit={onEditorSubmit} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Configuration;
