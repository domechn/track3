import _ from "lodash";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import "./index.css";
import gearIcon from "../../assets/icons/gear-icon.png";
import Modal from "../common/modal";
import { useWindowSize } from "../../utils/hook";

import Configuration from "../configuration";
import DataManagement from "../data-management";
import "./index.css";

const App = ({
  onConfigurationSave,
  onDataImported,
  onDataSynced,
}: {
  onConfigurationSave?: () => void;
  onDataImported?: () => void;
  onDataSynced?: () => void;
}) => {
  const [version, setVersion] = useState<string>("0.1.0");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>("configuration");
  const size = useWindowSize();
  const [isSmallScreenAndSidecarActive, setIsSmallScreenAndSidecarActive] =
    useState(true);

  useEffect(() => {
    if (isModalOpen) {
      loadVersion();

      setIsSmallScreenAndSidecarActive(true);
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

  function getSettingWidth() {
    const width = Math.floor(size.width ? size.width * 0.8 : 800);
    // keep it even
    if (width % 2 === 1) {
      return width - 1;
    }
    return width;
  }

  function onConfigurationSidebarClick() {
    // add active class to the clicked item
    setActiveId("configuration");
    setIsSmallScreenAndSidecarActive(false);
  }
  function onDataSidebarClick() {
    // add active class to the clicked item
    setActiveId("data");
    setIsSmallScreenAndSidecarActive(false);
  }

  function _onConfigurationSave() {
    setIsModalOpen(false);
    onConfigurationSave && onConfigurationSave();
  }

  function _onDataImported() {
    setIsModalOpen(false);
    onDataImported && onDataImported();
  }

  function _onDataSynced() {
    onDataSynced && onDataSynced();
  }

  function smallScreen(): boolean {
    return getSettingWidth() < 600;
  }

  function renderMenu() {
    return (
      <>
        <div className="settings-sidebar">
          <div
            id="configuration"
            className={`sidebar-item ${
              !smallScreen() && activeId === "configuration" ? "active" : ""
            }`}
            onClick={onConfigurationSidebarClick}
          >
            Configuration
          </div>
          <div
            id="data"
            className={`sidebar-item ${
              !smallScreen() && activeId === "data" ? "active" : ""
            }`}
            onClick={onDataSidebarClick}
          >
            Data
          </div>
          <div className="version">version: {version}</div>
        </div>

        <div className="settings-content">
          <div
            id="configurationContent"
            className="content-item"
            style={{
              display: activeId === "configuration" ? "block" : "none",
            }}
          >
            <Configuration onConfigurationSave={_onConfigurationSave} />
          </div>
          <div
            id="dataContent"
            className="content-item"
            style={{
              display: activeId === "data" ? "block" : "none",
            }}
          >
            <DataManagement
              onDataImported={_onDataImported}
              onDataSynced={_onDataSynced}
            />
          </div>
        </div>
      </>
    );
  }

  function renderSmallScreenMenu() {
    return (
      <>
        <div
          className="settings-sidebar"
          style={{
            display: isSmallScreenAndSidecarActive ? "inline-block" : "none",
            width: "100%",
            borderRight: "none",
            textAlign: "center",
          }}
        >
          <div
            id="configuration"
            className="sidebar-item"
            onClick={onConfigurationSidebarClick}
          >
            Configuration
          </div>
          <div id="data" className="sidebar-item" onClick={onDataSidebarClick}>
            Data
          </div>
          <div className="version">version: {version}</div>
        </div>

        <div
          className="settings-content"
          style={{
            display: isSmallScreenAndSidecarActive ? "none" : "inline-block",
            width: "90%",
          }}
        >
          <div
            style={{
              textAlign: "left",
              marginBottom: "10px",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "14px",
              color: "#0078d4",
            }}
            onClick={() => {
              setIsSmallScreenAndSidecarActive(true);
              // clear active class
              setActiveId("");
            }}
          >
            {"< back"}
          </div>
          <div
            id="configurationContent"
            className="content-item"
            style={{
              display: activeId === "configuration" ? "block" : "none",
            }}
          >
            <Configuration onConfigurationSave={_onConfigurationSave} />
          </div>
          <div
            id="dataContent"
            className="content-item"
            style={{
              display: activeId === "data" ? "block" : "none",
            }}
          >
            <DataManagement
              onDataImported={_onDataImported}
              onDataSynced={_onDataSynced}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="settings">
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
            width: getSettingWidth(),
          }}
        >
          {smallScreen() ? renderSmallScreenMenu() : renderMenu()}
        </div>
      </Modal>
    </div>
  );
};

export default App;
