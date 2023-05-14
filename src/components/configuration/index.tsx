import _ from "lodash";
import { useEffect, useState } from "react";
import "./index.css";
import gearIcon from "../../assets/icons/gear-icon.png";
import {
  getConfiguration,
  saveConfiguration,
} from "../../middlelayers/configuration";
import Loading from "../common/loading";
import { Toaster, toast } from "react-hot-toast";
import Modal from "../common/modal";
import yaml from "yaml";
import deleteIcon from "../../assets/icons/delete-icon.png";
import { GlobalConfig, TokenConfig } from "../../middlelayers/datafetch/types";
import Select from "../common/select";

const initialConfiguration: GlobalConfig = {
  configs: {
    groupUSD: true,
  },
  exchanges: [],
  erc20: {
    addresses: [],
  },
  btc: {
    addresses: [],
  },
  sol: {
    addresses: [],
  },
  doge: {
    addresses: [],
  },
  others: [],
};

const deleteIconSize = 15;

const supportCoins = ["btc", "erc20", "sol", "doge"];

const Configuration = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groupUSD, setGroupUSD] = useState(true);

  const [wallets, setWallets] = useState<
    {
      type: string;
      address: string;
    }[]
  >([]);

  const [exchanges, setExchanges] = useState<
    {
      type: string;
      apiKey: string;
      secret: string;
      password?: string;
    }[]
  >([]);

  const [others, setOthers] = useState<
    {
      symbol: string;
      amount: number;
    }[]
  >([]);

  useEffect(() => {
    if (isModalOpen) {
      loadConfiguration();
    }
  }, [isModalOpen]);

  function loadConfiguration() {
    setLoading(true);

    getConfiguration()
      .then((d) => {
        const globalConfig = d?.data
          ? (yaml.parse(d.data) as GlobalConfig)
          : initialConfiguration;

        setGroupUSD(globalConfig.configs.groupUSD);

        setExchanges(
          globalConfig.exchanges.map((ex) => ({
            type: ex.name,
            apiKey: ex.initParams.apiKey,
            secret: ex.initParams.secret,
            password: ex.initParams.password,
          }))
        );
        setWallets(
          _(globalConfig)
            .pick(supportCoins)
            .map((v: any, k) =>
              _(v.addresses)
                .map((a) => ({ type: k, address: a }))
                .value()
            )
            .flatten()
            .value()
        );

        setOthers(globalConfig.others);
      })
      .finally(() => setLoading(false));
  }

  const handleButtonClick = () => {
    setIsModalOpen(true);
  };

  function onModalClose() {
    setIsModalOpen(false);
  }

  function onFormSubmit() {
    const globalConfig = convertFormDataToConfigurationData();
    setLoading(true);
    let saveError: Error | undefined;

    saveConfiguration(globalConfig)
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

  function convertFormDataToConfigurationData(): GlobalConfig {
    const exchangesData = _(exchanges)
      .map((ex) => ({
        name: ex.type,
        initParams: {
          apiKey: ex.apiKey,
          secret: ex.secret,
          password: ex.password,
        },
      }))
      .value();

    const walletData = _(wallets)
      .groupBy("type")
      .mapValues((ws) => ({
        addresses: _(ws)
          .map((w) => w.address)
          .value(),
      }))
      .value() as any as TokenConfig;

    return {
      configs: {
        groupUSD,
      },
      exchanges: exchangesData,
      // expand wallet
      ..._(supportCoins)
        .mapKeys((c) => c)
        .mapValues(() => ({ addresses: [] }))
        .value(),
      ...walletData,
      others,
    };
  }

  function renderExchangeForm() {
    return _(exchanges)
      .map((ex, idx) => {
        return (
          <div key={"ex" + idx}>
            <label>
              <Select
                options={[{value: "binance", label: "Binance"}, {value: "okex", label: "OKex"}]}
                onSelectChange={(v) => handleExchangeChange(idx, "type", v)}
                defaultValue={ex.type}
                width={100}
              />
            </label>
            <label key={"ex-type-appKey" + idx}>
              <input
                type="text"
                name="apiKey"
                placeholder="apiKey"
                defaultValue={ex.apiKey}
                onChange={(e) =>
                  handleExchangeChange(idx, "apiKey", e.target.value)
                }
              />
            </label>
            <label>
              <input
                type="text"
                name="secret"
                placeholder="secret"
                defaultValue={ex.secret}
                onChange={(e) =>
                  handleExchangeChange(idx, "secret", e.target.value)
                }
              />
            </label>
            <label>
              <input
                type="text"
                name="password"
                placeholder="password"
                style={{
                  display: ex.type === "okex" ? "block" : "none",
                }}
                defaultValue={ex.password}
                onChange={(e) =>
                  handleExchangeChange(idx, "password", e.target.value)
                }
              />
            </label>
            <a href="#" onClick={() => handleRemoveExchange(idx)}>
              <img
                src={deleteIcon}
                alt="delete"
                style={{
                  border: 0,
                  height: deleteIconSize,
                  width: deleteIconSize,
                }}
              />
            </a>
          </div>
        );
      })
      .value();
  }

  function handleWalletChange(idx: number, key: string, val: string) {
    _.set(wallets, [idx, key], val);
    setWallets(wallets);
  }

  function renderWalletForm() {
    return _(wallets)
      .map((w, idx) => {
        return (
          <div key={"wallet" + idx}>
            <label>
            <Select
                options={[{
                  value: "btc",
                  label: "BTC"
                }, {
                  value: "erc20",
                  label: "ERC20"
                }, {
                  value: "sol",
                  label: "SOL"
                }, {
                  value: "doge",
                  label: "DOGE"
                }]}
                onSelectChange={(v) =>  handleWalletChange(idx, "type", v)}
                defaultValue={w.type}
                width={100}
              />
            </label>
            <label>
              <input
                type="text"
                name="address"
                placeholder="address"
                defaultValue={w.address}
                onChange={(e) =>
                  handleWalletChange(idx, "address", e.target.value)
                }
              />
            </label>
            <a href="#" onClick={() => handleRemoveWallet(idx)}>
              <img
                src={deleteIcon}
                alt="delete"
                style={{
                  border: 0,
                  height: deleteIconSize,
                  width: deleteIconSize,
                }}
              />
            </a>
          </div>
        );
      })
      .value();
  }

  function handleOthersChange(idx: number, key: string, val: string) {
    _.set(others, [idx, key], val);
    setOthers(others);
  }

  function renderOthersForm() {
    return _(others)
      .map((o, idx) => (
        <div key={"other" + idx}>
          <label>
            <input
              type="text"
              name="symbol"
              placeholder="symbol, e.g. BTC, ETH"
              defaultValue={o.symbol}
              onChange={(e) =>
                handleOthersChange(idx, "symbol", e.target.value)
              }
            />
          </label>
          <label>
            <input
              type="number"
              name="amount"
              placeholder="amount"
              defaultValue={o.amount}
              onChange={(e) =>
                handleOthersChange(idx, "amount", e.target.value)
              }
            />
          </label>
          <a href="#" onClick={() => handleRemoveOther(idx)}>
            <img
              src={deleteIcon}
              alt="delete"
              style={{
                border: 0,
                height: deleteIconSize,
                width: deleteIconSize,
              }}
            />
          </a>
        </div>
      ))
      .value();
  }

  function handleAddExchange() {
    setExchanges([
      ...exchanges,
      {
        type: "binance",
        apiKey: "",
        secret: "",
      },
    ]);
  }

  function handleRemoveExchange(idx: number) {
    setExchanges(_.filter(exchanges, (_, i) => i !== idx));
  }

  function handleAddWallet() {
    setWallets([
      ...wallets,
      {
        type: "btc",
        address: "",
      },
    ]);
  }

  function handleAddOther() {
    setOthers([
      ...others,
      {
        symbol: "",
        amount: 0,
      },
    ]);
  }

  function handleRemoveOther(idx: number) {
    setOthers(_.filter(others, (_, i) => i !== idx));
  }

  function handleRemoveWallet(idx: number) {
    setWallets(_.filter(wallets, (_, i) => i !== idx));
  }

  function handleExchangeChange(idx: number, key: string, val: string) {
    _.set(exchanges, [idx, key], val);
    setExchanges(exchanges);
  }

  return (
    <div className="configuration">
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
        <form onSubmit={onFormSubmit}>
          <label>
            GroupUSD
            <input
              type="checkbox"
              name="groupUSD"
              defaultChecked={groupUSD}
              onChange={(e) => setGroupUSD(e.target.checked)}
            />
          </label>
          <br />
          <h3>Exchanges</h3>
          {renderExchangeForm()}
          <br />
          <button type="button" onClick={handleAddExchange}>
            Add Exchange
          </button>
          <h3>Wallets</h3>
          {renderWalletForm()}
          <br />
          <button type="button" onClick={handleAddWallet}>
            Add Wallet
          </button>
          <h3>Others</h3>
          {renderOthersForm()}
          <br />
          <button type="button" onClick={handleAddOther}>
            Add Other
          </button>
          <br />
          <button type="button" onClick={onFormSubmit}>
            Save
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Configuration;
