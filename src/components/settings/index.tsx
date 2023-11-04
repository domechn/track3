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
  const [activeId, setActiveId] = useState<string>("configuration");
  const size = useWindowSize();

  useEffect(() => {
    loadVersion();
  }, []);

  function loadVersion() {
    getVersion().then((ver) => {
      setVersion(ver);
    });
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
  }
  function onDataSidebarClick() {
    // add active class to the clicked item
    setActiveId("data");
  }

  function _onConfigurationSave() {
    onConfigurationSave && onConfigurationSave();
  }

  function _onDataImported() {
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
  return <div className="settings">{renderMenu()}</div>;
};

export default App;
