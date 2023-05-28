import _ from "lodash";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import "./index.css";
import gearIcon from "../../assets/icons/gear-icon.png";
import Modal from "../common/modal";
import { useWindowSize } from "../../utils/hook";

import Configuration from "../configuration";
import "./index.css";

const App = () => {
  const [version, setVersion] = useState<string>("0.1.0");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const size = useWindowSize();

  useEffect(() => {
    if (isModalOpen) {
      loadVersion();
    }
  }, [isModalOpen]);

  function loadVersion() {
    getVersion().then((ver) => {
      setVersion(ver);
    });
  }

  const handleButtonClick = () => {
    setIsModalOpen(true);
  };

  function onModalClose() {
    setIsModalOpen(false);
  }

  return (
    <div className="setting">
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
        <div
          style={{
            height: Math.min(700, size.height! - 100), // make sure modal is not too high to hint max-hight of the modal, otherwise it will make view fuzzy
          }}
        >
          <Configuration onConfigurationSave={()=>setIsModalOpen(false)} />
          <div className="version">version: {version}</div>
        </div>
      </Modal>
    </div>
  );
};

export default App;
