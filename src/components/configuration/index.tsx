import _ from "lodash";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  getConfiguration,
  saveConfiguration,
} from "../../middlelayers/configuration";
import { toast } from "react-hot-toast";
import deleteIcon from "../../assets/icons/delete-icon.png";
import { GlobalConfig, TokenConfig } from "../../middlelayers/datafetch/types";
import BetterSelect, { SelectOption } from "../common/select";
import { LoadingContext } from "../../App";
import { CurrencyRateDetail } from "../../middlelayers/types";
import { listAllCurrencyRates } from "../../middlelayers/currency";
import { Separator } from "../ui/separator";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const initialConfiguration: GlobalConfig = {
  configs: {
    groupUSD: true,
    querySize: 10,
    preferCurrency: "USD",
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

const defaultExChangeConfig = {
  type: "binance",
  apiKey: "",
  secret: "",
};

const defaultWalletConfig = {
  type: "btc",
  address: "",
};

const defaultOtherConfig = {
  symbol: "",
  amount: 0,
};

const supportCoins = ["btc", "erc20", "sol", "doge"];

const cexOptions = [
  {
    value: "binance",
    label: "Binance",
  },
  {
    value: "okex",
    label: "OKex",
  },
];

const walletOptions = [
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
];

const Configuration = ({
  onConfigurationSave,
}: {
  onConfigurationSave?: () => void;
}) => {
  const { setLoading } = useContext(LoadingContext);
  const [groupUSD, setGroupUSD] = useState(true);
  const [querySize, setQuerySize] = useState(0);
  const [preferCurrency, setPreferCurrency] = useState("USD");
  const [addExchangeConfig, setAddExchangeConfig] = useState<
    | {
        type: string;
        apiKey: string;
        secret: string;
        password?: string;
        alias?: string;
      }
    | undefined
  >(undefined);
  const [addWalletConfig, setAddWalletConfig] = useState<
    | {
        type: string;
        address: string;
        alias?: string;
      }
    | undefined
  >(undefined);
  const [addOtherConfig, setAddOtherConfig] = useState<
    | {
        symbol: string;
        amount: number;
      }
    | undefined
  >(undefined);

  const [currencies, setCurrencies] = useState<CurrencyRateDetail[]>([]);

  const [wallets, setWallets] = useState<
    {
      type: string;
      alias?: string;
      address: string;
    }[]
  >([]);

  const [exchanges, setExchanges] = useState<
    {
      alias?: string;
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

  const preferCurrencyOptions = useMemo(
    () =>
      _(currencies)
        .map((c) => ({
          value: c.currency,
          label: `${c.currency} - ${c.alias}`,
        }))
        .value(),
    [currencies]
  );

  useEffect(() => {
    loadConfiguration();
    loadSupportedCurrencies();
  }, []);

  async function loadSupportedCurrencies() {
    const currencies = await listAllCurrencyRates();
    setCurrencies(currencies);
  }

  function loadConfiguration() {
    setLoading(true);
    getConfiguration()
      .then((d) => {
        const globalConfig = d ?? initialConfiguration;

        setGroupUSD(globalConfig.configs.groupUSD);
        setQuerySize(globalConfig.configs.querySize || 10);
        setPreferCurrency(globalConfig.configs.preferCurrency || "USD");

        setExchanges(
          _(globalConfig.exchanges)
            .map((ex) => ({
              type: ex.name,
              alias: ex.alias,
              apiKey: ex.initParams.apiKey,
              secret: ex.initParams.secret,
              password: ex.initParams.password,
            }))
            .value()
        );

        setWallets(
          _(globalConfig)
            .pick(supportCoins)
            .map((v: any, k: string) =>
              _(v.addresses)
                .map((a) => {
                  if (_(a).isString()) {
                    return { type: k, address: a };
                  }
                  const na = a as { address: string; alias?: string };
                  return {
                    type: k,
                    address: na.address,
                    alias: na.alias,
                  };
                })
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
        alias: ex.alias,
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
          .map((w) => ({
            alias: w.alias,
            address: w.address,
          }))
          .value(),
      }))
      .value() as any as TokenConfig;

    return {
      configs: {
        groupUSD,
        querySize,
        preferCurrency,
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
      alias?: string;
      apiKey: string;
      secret: string;
      password?: string;
    }[]
  ) {
    const renderExchangeItems = () => {
      return _(exs)
        .map((ex, idx) => (
          <Card
            key={ex.apiKey + idx}
            className="cursor-pointer hover:shadow-lg group"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
              <CardTitle className="text-sm font-medium">{ex.type}</CardTitle>
              <div className="flex ">
                <svg
                  viewBox="0 0 1024 1024"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  p-id="2306"
                  className="h-4 w-4 text-muted-foreground hidden group-hover:inline-block mr-2"
                  onClick={() => handleRemoveExchange(idx)}
                >
                  <path
                    d="M768 384c-19.2 0-32 12.8-32 32l0 377.6c0 25.6-19.2 38.4-38.4 38.4L326.4 832c-25.6 0-38.4-19.2-38.4-38.4L288 416C288 396.8 275.2 384 256 384S224 396.8 224 416l0 377.6c0 57.6 44.8 102.4 102.4 102.4l364.8 0c57.6 0 102.4-44.8 102.4-102.4L793.6 416C800 396.8 787.2 384 768 384z"
                    fill="#d81e06"
                    p-id="2307"
                  ></path>
                  <path
                    d="M460.8 736l0-320C460.8 396.8 448 384 435.2 384S396.8 396.8 396.8 416l0 320c0 19.2 12.8 32 32 32S460.8 755.2 460.8 736z"
                    fill="#d81e06"
                    p-id="2308"
                  ></path>
                  <path
                    d="M627.2 736l0-320C627.2 396.8 608 384 588.8 384S563.2 396.8 563.2 416l0 320C563.2 755.2 576 768 588.8 768S627.2 755.2 627.2 736z"
                    fill="#d81e06"
                    p-id="2309"
                  ></path>
                  <path
                    d="M832 256l-160 0L672 211.2C672 166.4 633.6 128 588.8 128L435.2 128C390.4 128 352 166.4 352 211.2L352 256 192 256C172.8 256 160 268.8 160 288S172.8 320 192 320l640 0c19.2 0 32-12.8 32-32S851.2 256 832 256zM416 211.2C416 198.4 422.4 192 435.2 192l153.6 0c12.8 0 19.2 6.4 19.2 19.2L608 256l-192 0L416 211.2z"
                    fill="#d81e06"
                    p-id="2310"
                  ></path>
                </svg>
                {/* binance */}
                {ex.type === "binance" && (
                  <svg
                    viewBox="0 0 126.61 126.61"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <g fill="#f3ba2f">
                      <path d="m38.73 53.2 24.59-24.58 24.6 24.6 14.3-14.31-38.9-38.91-38.9 38.9z" />
                      <path d="m0 63.31 14.3-14.31 14.31 14.31-14.31 14.3z" />
                      <path d="m38.73 73.41 24.59 24.59 24.6-24.6 14.31 14.29-38.9 38.91-38.91-38.88z" />
                      <path d="m98 63.31 14.3-14.31 14.31 14.3-14.31 14.32z" />
                      <path d="m77.83 63.3-14.51-14.52-10.73 10.73-1.24 1.23-2.54 2.54 14.51 14.5 14.51-14.47z" />
                    </g>
                  </svg>
                )}
                {/* okex */}
                {ex.type === "okex" && (
                  <svg
                    viewBox="0 0 400.66 400.67"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-muted-foreground"
                  >
                    <path d="m0 400.67v-400.67" fill="#dbd9d9" />
                    <path
                      d="m178.77 178.77a90.69 90.69 0 0 0 43.14 0 90.84 90.84 0 0 1 66.52-66.52 90.69 90.69 0 1 0 -176.19 0 90.81 90.81 0 0 1 66.53 66.52z"
                      fill="#7abdf7"
                    />
                    <path
                      d="m221.91 221.89a90.69 90.69 0 0 0 -43.14 0 90.84 90.84 0 0 1 -66.52 66.52 90.69 90.69 0 1 0 176.19 0 90.81 90.81 0 0 1 -66.53-66.52z"
                      fill="#0d74f5"
                    />
                    <path
                      d="m310 109.64a90.59 90.59 0 0 0 -21.56 2.6 90.79 90.79 0 0 1 -66.51 66.51 90.69 90.69 0 0 0 0 43.14 90.81 90.81 0 0 1 66.51 66.52 90.69 90.69 0 1 0 21.56-178.79z"
                      fill="#4494f7"
                    />
                    <path
                      d="m178.77 221.89a90.69 90.69 0 0 0 0-43.14 90.81 90.81 0 0 1 -66.52-66.51 90.69 90.69 0 1 0 0 176.19 90.82 90.82 0 0 1 66.52-66.54z"
                      fill="#005cf4"
                    />
                    <path
                      d="m221.91 178.77a90.84 90.84 0 0 0 66.52-66.52 90.84 90.84 0 0 0 -66.52 66.52z"
                      fill="#186ef9"
                    />
                    <path
                      d="m221.91 221.89a90.81 90.81 0 0 0 66.52 66.52 90.84 90.84 0 0 0 -66.52-66.52z"
                      fill="#0246f2"
                    />
                    <path
                      d="m178.77 178.77a90.84 90.84 0 0 0 -66.52-66.52 90.84 90.84 0 0 0 66.52 66.52z"
                      fill="#0046f8"
                    />
                    <path
                      d="m178.77 221.89a90.84 90.84 0 0 0 -66.52 66.52 90.84 90.84 0 0 0 66.52-66.52z"
                      fill="#0729f1"
                    />
                    <path
                      d="m178.77 178.77a90.69 90.69 0 0 0 43.14 0 90.84 90.84 0 0 1 66.52-66.52 90.69 90.69 0 1 0 -176.19 0 90.81 90.81 0 0 1 66.53 66.52z"
                      fill="#7abdf7"
                    />
                    <path
                      d="m221.91 221.89a90.69 90.69 0 0 0 -43.14 0 90.84 90.84 0 0 1 -66.52 66.52 90.69 90.69 0 1 0 176.19 0 90.81 90.81 0 0 1 -66.53-66.52z"
                      fill="#0d74f5"
                    />
                    <path
                      d="m310 109.64a90.59 90.59 0 0 0 -21.56 2.6 90.79 90.79 0 0 1 -66.51 66.51 90.69 90.69 0 0 0 0 43.14 90.81 90.81 0 0 1 66.51 66.52 90.69 90.69 0 1 0 21.56-178.79z"
                      fill="#4494f7"
                    />
                    <path
                      d="m178.77 221.89a90.69 90.69 0 0 0 0-43.14 90.81 90.81 0 0 1 -66.52-66.51 90.69 90.69 0 1 0 0 176.19 90.82 90.82 0 0 1 66.52-66.54z"
                      fill="#005cf4"
                    />
                    <path
                      d="m221.91 178.77a90.84 90.84 0 0 0 66.52-66.52 90.84 90.84 0 0 0 -66.52 66.52z"
                      fill="#186ef9"
                    />
                    <path
                      d="m221.91 221.89a90.81 90.81 0 0 0 66.52 66.52 90.84 90.84 0 0 0 -66.52-66.52z"
                      fill="#0246f2"
                    />
                    <path
                      d="m178.77 178.77a90.84 90.84 0 0 0 -66.52-66.52 90.84 90.84 0 0 0 66.52 66.52z"
                      fill="#0046f8"
                    />
                    <path
                      d="m178.77 221.89a90.84 90.84 0 0 0 -66.52 66.52 90.84 90.84 0 0 0 66.52-66.52z"
                      fill="#0729f1"
                    />
                  </svg>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {ex.alias ?? ex.type + idx}
              </div>
              <p className="text-xs text-muted-foreground overflow-ellipsis overflow-hidden">
                <span>{ex.apiKey}</span>
              </p>
            </CardContent>
          </Card>
        ))
        .value();
    };
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        {renderExchangeItems()}
      </div>
    );
  }

  function handleWalletChange(idx: number, key: string, val: string) {
    const newWs = _.set(wallets, [idx, key], val);
    setWallets([...newWs]);
  }

  function renderWalletForm(
    ws: { type: string; alias?: string; address: string }[]
  ) {
    const renderWalletItems = () => {
      return _(ws)
        .map((w, idx) => {
          return (
            <Card
              key={w.address + idx}
              className="cursor-pointer hover:shadow-lg group"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <CardTitle className="text-sm font-medium">
                  {w.type.toUpperCase()}
                </CardTitle>
                <div className="flex ">
                  <svg
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    p-id="2306"
                    className="h-4 w-4 text-muted-foreground hidden group-hover:inline-block mr-2"
                    onClick={() => handleRemoveWallet(idx)}
                  >
                    <path
                      d="M768 384c-19.2 0-32 12.8-32 32l0 377.6c0 25.6-19.2 38.4-38.4 38.4L326.4 832c-25.6 0-38.4-19.2-38.4-38.4L288 416C288 396.8 275.2 384 256 384S224 396.8 224 416l0 377.6c0 57.6 44.8 102.4 102.4 102.4l364.8 0c57.6 0 102.4-44.8 102.4-102.4L793.6 416C800 396.8 787.2 384 768 384z"
                      fill="#d81e06"
                      p-id="2307"
                    ></path>
                    <path
                      d="M460.8 736l0-320C460.8 396.8 448 384 435.2 384S396.8 396.8 396.8 416l0 320c0 19.2 12.8 32 32 32S460.8 755.2 460.8 736z"
                      fill="#d81e06"
                      p-id="2308"
                    ></path>
                    <path
                      d="M627.2 736l0-320C627.2 396.8 608 384 588.8 384S563.2 396.8 563.2 416l0 320C563.2 755.2 576 768 588.8 768S627.2 755.2 627.2 736z"
                      fill="#d81e06"
                      p-id="2309"
                    ></path>
                    <path
                      d="M832 256l-160 0L672 211.2C672 166.4 633.6 128 588.8 128L435.2 128C390.4 128 352 166.4 352 211.2L352 256 192 256C172.8 256 160 268.8 160 288S172.8 320 192 320l640 0c19.2 0 32-12.8 32-32S851.2 256 832 256zM416 211.2C416 198.4 422.4 192 435.2 192l153.6 0c12.8 0 19.2 6.4 19.2 19.2L608 256l-192 0L416 211.2z"
                      fill="#d81e06"
                      p-id="2310"
                    ></path>
                  </svg>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {w.alias ?? w.type + idx}
                </div>
                <p className="text-xs text-muted-foreground overflow-ellipsis overflow-hidden">
                  <span>{w.address}</span>
                </p>
              </CardContent>
            </Card>
            // <div key={"wallet" + idx} className="wallets">
            //   <label>
            //     <BetterSelect
            //       options={[
            //         {
            //           value: "btc",
            //           label: "BTC",
            //         },
            //         {
            //           value: "erc20",
            //           label: "ERC20",
            //         },
            //         {
            //           value: "sol",
            //           label: "SOL",
            //         },
            //         {
            //           value: "doge",
            //           label: "DOGE",
            //         },
            //       ]}
            //       onSelectChange={(v) => handleWalletChange(idx, "type", v)}
            //       value={w.type}
            //       width={selectWidth}
            //       height={selectHeight}
            //     />
            //   </label>
            //   <label>
            //     <input
            //       type="text"
            //       name="alias"
            //       placeholder="alias"
            //       value={w.alias}
            //       style={{
            //         width: 55,
            //       }}
            //       onChange={(e) =>
            //         handleWalletChange(idx, "alias", e.target.value)
            //       }
            //     />
            //   </label>
            //   <label>
            //     <input
            //       type="text"
            //       name="address"
            //       placeholder="wallet address"
            //       value={w.address}
            //       style={{
            //         width: 275,
            //       }}
            //       onChange={(e) =>
            //         handleWalletChange(idx, "address", e.target.value)
            //       }
            //     />
            //   </label>
            //   <a onClick={() => handleRemoveWallet(idx)}>
            //     <img src={deleteIcon} alt="delete" />
            //   </a>
            // </div>
          );
        })
        .value();
    };
    return (
      <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-1">
        {renderWalletItems()}
      </div>
    );
  }

  function handleOthersChange(idx: number, key: string, val: string) {
    const nos = _.set(others, [idx, key], val);
    setOthers([...nos]);
  }

  function onQuerySizeChanged(val: string) {
    setQuerySize(parseInt(val, 10));
  }

  function onPreferCurrencyChanged(val: string) {
    setPreferCurrency(val);
  }

  function renderOthersForm(vals: { symbol: string; amount: number }[]) {
    return _(vals)
      .map((o, idx) => (
        <div key={"other" + idx} className="grid gap-4 grid-cols-3">
          <Input
            type="text"
            name="symbol"
            placeholder="symbol, e.g. BTC"
            value={o.symbol}
            className="w-15"
            onChange={(e) => handleOthersChange(idx, "symbol", e.target.value)}
          />
          <Input
            type="number"
            name="amount"
            placeholder="amount"
            value={o.amount}
            className="w-30"
            onChange={(e) => handleOthersChange(idx, "amount", e.target.value)}
          />
          <a onClick={() => handleRemoveOther(idx)}>
            <img src={deleteIcon} alt="delete" className="w-4 h-4 mt-2" />
          </a>
        </div>
      ))
      .value();
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

  function renderAddExchangeForm() {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Add</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Exchange Configuration</DialogTitle>
            <DialogDescription>
              Add exchange api key and secret here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Type
              </Label>
              <Select
                onValueChange={(e) =>
                  setAddExchangeConfig({
                    ...(addExchangeConfig || defaultExChangeConfig),
                    type: e,
                  })
                }
                value={addExchangeConfig?.type ?? ""}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select CEX" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Cex</SelectLabel>
                    {cexOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="alias" className="text-right">
                Alias
              </Label>
              <Input
                id="alias"
                value={addExchangeConfig?.alias ?? ""}
                onChange={(e) =>
                  setAddExchangeConfig({
                    ...(addExchangeConfig || defaultExChangeConfig),
                    alias: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="apiKey" className="text-right">
                Api Key
              </Label>
              <Input
                id="apiKey"
                value={addExchangeConfig?.apiKey ?? ""}
                onChange={(e) =>
                  setAddExchangeConfig({
                    ...(addExchangeConfig || defaultExChangeConfig),
                    apiKey: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="apiSecret" className="text-right">
                Api Secret
              </Label>
              <Input
                id="apiSecret"
                value={addExchangeConfig?.secret ?? ""}
                type="password"
                onChange={(e) =>
                  setAddExchangeConfig({
                    ...(addExchangeConfig || defaultExChangeConfig),
                    secret: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
            {addExchangeConfig?.type === "okex" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                  Password
                </Label>
                <Input
                  id="password"
                  value={addExchangeConfig?.password ?? ""}
                  type="password"
                  onChange={(e) =>
                    setAddExchangeConfig({
                      ...(addExchangeConfig || defaultExChangeConfig),
                      password: e.target.value,
                    })
                  }
                  className="col-span-3"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderAddWalletForm() {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Add</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Wallet Configuration</DialogTitle>
            <DialogDescription>
              Add wallet address here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Type
              </Label>
              <Select
                onValueChange={(e) =>
                  setAddWalletConfig({
                    ...(addWalletConfig || defaultWalletConfig),
                    type: e,
                  })
                }
                value={addWalletConfig?.type ?? ""}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Wallet Type</SelectLabel>
                    {walletOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="alias" className="text-right">
                Alias
              </Label>
              <Input
                id="alias"
                value={addWalletConfig?.alias ?? ""}
                onChange={(e) =>
                  setAddWalletConfig({
                    ...(addWalletConfig || defaultWalletConfig),
                    alias: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="address" className="text-right">
                Address
              </Label>
              <Input
                id="address"
                value={addWalletConfig?.address ?? ""}
                onChange={(e) =>
                  setAddWalletConfig({
                    ...(addWalletConfig || defaultWalletConfig),
                    address: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function renderAddOtherForm() {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Add</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Other Configuration</DialogTitle>
            <DialogDescription>
              Add extra symbol and amount here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="symbol" className="text-right">
                Symbol
              </Label>
              <Input
                id="symbol"
                value={addOtherConfig?.symbol ?? ""}
                onChange={(e) =>
                  setAddOtherConfig({
                    ...(addOtherConfig || defaultOtherConfig),
                    symbol: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                value={addOtherConfig?.amount ?? ""}
                onChange={(e) =>
                  setAddOtherConfig({
                    ...(addOtherConfig || defaultOtherConfig),
                    amount: +e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure your exchanges, wallets, others addresses and other general
          settings.
        </p>
      </div>
      <Separator />
      <div className="space-y-5">
        <div className="text-l font-bold text-left">General</div>
        <div className="flex items-center space-x-2 mb-2">
          <Checkbox
            id="groupUSD"
            checked={groupUSD}
            onCheckedChange={(v) => setGroupUSD(!!v)}
          />
          <Label
            htmlFor="groupUSD"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Group Stable Coins into USDT ( e.g. USDC, TUSD, DAI etc.)
          </Label>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-bold text-left">Count of Results</div>
          <Select onValueChange={onQuerySizeChanged} value={querySize + ""}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Configure QuerySize" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Size</SelectLabel>
                {querySizeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-bold text-left">Base Currency</div>
          <Select
            onValueChange={onPreferCurrencyChanged}
            value={preferCurrency}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Configure Prefer Currency" />
            </SelectTrigger>
            <SelectContent className="overflow-y-auto max-h-[20rem]">
              <SelectGroup>
                <SelectLabel>Prefer Currency</SelectLabel>
                {preferCurrencyOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="text-l font-bold text-left">Exchanges</div>
        {renderAddExchangeForm()}
        {renderExchangeForm(exchanges)}
      </div>
      <Separator />
      <div className="space-y-2">
        <div className="text-l font-bold text-left">Wallets</div>
        {renderAddWalletForm()}
        {renderWalletForm(wallets)}
      </div>
      <div className="space-y-2">
        <div className="text-l font-bold text-left">Others</div>
        {renderAddOtherForm()}
        {renderOthersForm(others)}
      </div>
    </div>
  );
};

export default Configuration;
