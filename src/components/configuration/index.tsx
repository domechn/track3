import _ from "lodash";
import { useContext, useEffect, useMemo, useState } from "react";
import "./index.css";
import {
  getConfiguration,
  saveConfiguration,
} from "../../middlelayers/configuration";
import { toast } from "react-hot-toast";
import yaml from "yaml";
import deleteIcon from "../../assets/icons/delete-icon.png";
import { GlobalConfig, TokenConfig } from "../../middlelayers/datafetch/types";
import Select, { SelectOption } from "../common/select";
import { LoadingContext } from "../../App";

const initialConfiguration: GlobalConfig = {
  configs: {
    groupUSD: true,
    querySize: 10,
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

const selectWidth = 100;
const selectHeight = 30;

const supportCoins = ["btc", "erc20", "sol", "doge"];

const Configuration = ({
  onConfigurationSave,
}: {
  onConfigurationSave?: () => void;
}) => {
  const { setLoading } = useContext(LoadingContext);
  const [groupUSD, setGroupUSD] = useState(true);
  const [querySize, setQuerySize] = useState(0);

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

  const querySizeOptions = useMemo(
    () =>
      [
        {
          value: "10",
          label: "10",
        },
        {
          value: "20",
          label: "20",
        },
        {
          value: "50",
          label: "50",
        },
      ] as SelectOption[],
    []
  );


  useEffect(() => {
    loadConfiguration();
  }, []);

  function loadConfiguration() {
    setLoading(true);
    getConfiguration()
      .then((d) => {
        const globalConfig = d?.data
          ? (yaml.parse(d.data) as GlobalConfig)
          : initialConfiguration;

        setGroupUSD(globalConfig.configs.groupUSD);
        setQuerySize(globalConfig.configs.querySize || 10);

        setExchanges(
          _(globalConfig.exchanges)
            .map((ex) => ({
              type: ex.name,
              apiKey: ex.initParams.apiKey,
              secret: ex.initParams.secret,
              password: ex.initParams.password,
            }))
            .value()
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
      .catch((e) => {
        toast.error("get configuration failed:", e);
      })
      .finally(() => setLoading(false));
  }

  function onFormSubmit() {
    const globalConfig = convertFormDataToConfigurationData();
    setLoading(true);
    let saveError: Error | undefined;

    saveConfiguration(globalConfig)
      .then(() => onConfigurationSave && onConfigurationSave())
      .catch((e) => (saveError = e))
      .finally(() => {
        setLoading(false);
        if (saveError) {
          toast.error(saveError.message ?? saveError);
        } else {
          toast.success("Configuration updated successfully!", {
            id: "configuration-update-success",
          });
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
          password: ex.type !== "okex" ? undefined : ex.password,
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
        querySize,
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

  function renderExchangeForm(
    exs: {
      type: string;
      apiKey: string;
      secret: string;
      password?: string;
    }[]
  ) {
    const getInputWidth = (type: string) => {
      switch (type) {
        case "binance":
          return 200;
        case "okex":
          return 130;
        default:
          return 200;
      }
    };
    return _(exs)
      .map((ex, idx) => {
        return (
          <div key={"ex" + idx} className="exchanges">
            <label>
              <Select
                options={[
                  { value: "binance", label: "Binance" },
                  { value: "okex", label: "OKex" },
                ]}
                onSelectChange={(v) => handleExchangeChange(idx, "type", v)}
                value={ex.type}
                width={selectWidth}
                height={selectHeight}
              />
            </label>
            <label>
              <input
                type="text"
                name="apiKey"
                placeholder="apiKey"
                value={ex.apiKey}
                style={{
                  width: getInputWidth(ex.type),
                }}
                onChange={(e) =>
                  handleExchangeChange(idx, "apiKey", e.target.value)
                }
              />
            </label>
            <label>
              <input
                type="password"
                name="secret"
                placeholder="secret"
                style={{
                  width: getInputWidth(ex.type),
                }}
                value={ex.secret}
                onChange={(e) =>
                  handleExchangeChange(idx, "secret", e.target.value)
                }
              />
            </label>
            <label>
              <input
                type="password"
                name="password"
                placeholder="password"
                style={{
                  display: ex.type === "okex" ? "inline-block" : "none",
                  width: getInputWidth(ex.type),
                }}
                value={ex.password}
                onChange={(e) =>
                  handleExchangeChange(idx, "password", e.target.value)
                }
              />
            </label>
            <a href="#" onClick={() => handleRemoveExchange(idx)}>
              <img src={deleteIcon} alt="delete" />
            </a>
          </div>
        );
      })
      .value();
  }

  function handleWalletChange(idx: number, key: string, val: string) {
    const newWs = _.set(wallets, [idx, key], val);
    setWallets([...newWs]);
  }

  function renderWalletForm(ws: { type: string; address: string }[]) {
    return _(ws)
      .map((w, idx) => {
        return (
          <div key={"wallet" + idx} className="wallets">
            <label>
              <Select
                options={[
                  {
                    value: "btc",
                    label: "BTC",
                  },
                  {
                    value: "erc20",
                    label: "ERC20",
                  },
                  {
                    value: "sol",
                    label: "SOL",
                  },
                  {
                    value: "doge",
                    label: "DOGE",
                  },
                ]}
                onSelectChange={(v) => handleWalletChange(idx, "type", v)}
                value={w.type}
                width={selectWidth}
                height={selectHeight}
              />
            </label>
            <label>
              <input
                type="text"
                name="address"
                placeholder="wallet address"
                value={w.address}
                style={{
                  width: 275,
                }}
                onChange={(e) =>
                  handleWalletChange(idx, "address", e.target.value)
                }
              />
            </label>
            <a href="#" onClick={() => handleRemoveWallet(idx)}>
              <img src={deleteIcon} alt="delete" />
            </a>
          </div>
        );
      })
      .value();
  }

  function handleOthersChange(idx: number, key: string, val: string) {
    const nos = _.set(others, [idx, key], val);
    setOthers([...nos]);
  }

  function onQuerySizeChanged(val: string) {
    setQuerySize(parseInt(val, 10));
  }

  function renderOthersForm() {
    return _(others)
      .map((o, idx) => (
        <div key={"other" + idx} className="others">
          <label>
            <input
              type="text"
              name="symbol"
              placeholder="symbol, e.g. BTC"
              value={o.symbol}
              style={{
                width: 100,
              }}
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
              value={o.amount}
              onChange={(e) =>
                handleOthersChange(idx, "amount", e.target.value)
              }
            />
          </label>
          <a href="#" onClick={() => handleRemoveOther(idx)}>
            <img src={deleteIcon} alt="delete" />
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
    const newExs = _.set(exchanges, [idx, key], val);

    setExchanges([...newExs]);
  }

  return (
    <div className="configuration">
      <div>
        <h2>Configuration</h2>
        <form onSubmit={onFormSubmit}>
          <label>
            <span
              style={{
                display: "inline-block",
              }}
            >
              GroupUSD
            </span>
            <input
              style={{
                width: 50,
                height: 16,
                cursor: "pointer",
              }}
              type="checkbox"
              name="groupUSD"
              checked={groupUSD}
              onChange={(e) => setGroupUSD(e.target.checked)}
            />
          </label>
          <label>
            <span
              style={{
                display: "inline-block",
                marginRight: 10,
              }}
            >
              QuerySize
            </span>
            <Select
              width={60}
              options={querySizeOptions}
              onSelectChange={onQuerySizeChanged}
              value={querySize + ""}
            />
          </label>
          <h3>Exchanges</h3>
          <button
            type="button"
            className="add-button"
            onClick={handleAddExchange}
          >
            Add
          </button>
          {renderExchangeForm(exchanges)}
          <h3>Wallets</h3>
          <button
            type="button"
            className="add-button"
            onClick={handleAddWallet}
          >
            Add
          </button>
          {renderWalletForm(wallets)}
          <h3>Others</h3>
          <button type="button" className="add-button" onClick={handleAddOther}>
            Add
          </button>
          {renderOthersForm()}
          <br />
          <br />
          <button className="save" type="button" onClick={onFormSubmit}>
            Save
          </button>
        </form>
      </div>
    </div>
  );
};

export default Configuration;
