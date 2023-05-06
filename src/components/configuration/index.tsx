import { useEffect, useState } from "react";
import "./index.css";
import gearIcon from "../../assets/icons/gear-icon.png";
import SimpleEditor from "../simple-editor";
import {
  getConfiguration,
  saveConfiguration,
} from "../../middlelayers/configuration";
import Loading from "../common/loading";
import { Toaster, toast } from "react-hot-toast";
import Modal from "../common/modal";

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
    loadConfiguration();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      loadConfiguration();
    }
  }, [isModalOpen]);

  function loadConfiguration() {
    setLoading(true);

    getConfiguration()
      .then((d) => {
        setConfiguration(d?.data ?? initialConfiguration);
      })
      .finally(() => setLoading(false));
  }

  const handleButtonClick = () => {
    setIsModalOpen(true);
  };

  function onModalClose() {
    setIsModalOpen(false);
  }

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
      <Modal visible={isModalOpen} onClose={onModalClose}>
        <h2>Configuration</h2>
        <SimpleEditor data={configuration} onSubmit={onEditorSubmit} />
      </Modal>
    </div>
  );
};

export default Configuration;
