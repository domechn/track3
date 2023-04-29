import { useEffect, useState } from "react";
import "./index.css";
import gearIcon from "./gear-icon.png";
import SimpleEditor from "../simple-editor";

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

database: # save data to database ( optional )
  notion:
    token: # secret token
    databaseId: # database id
  csv:
    outputDir: # output directory
`

const Configuration = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [configuration, setConfiguration] = useState(initialConfiguration);

  useEffect(() => {
	// setConfiguration("a: 1")
  }, [])
  

  const handleButtonClick = () => {
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    document.body.style.overflow = "auto";
  };

  function onEditorSubmit(val: string) {
    console.log(val);
  }

  return (
    <div>
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
}

export default Configuration;
