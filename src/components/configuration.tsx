import _ from "lodash";
import { useEffect, useMemo, useState } from "react";
import {
  getConfiguration,
  queryPreferCurrency,
  queryQuerySize,
  saveConfiguration,
  savePreferCurrency,
  saveQuerySize,
  updateAllCurrencyRates,
} from "@/middlelayers/configuration";
import { useToast } from "@/components/ui/use-toast";
import DeleteIcon from "@/assets/icons/delete-icon.png";
import {
  Analyzer,
  GlobalConfig,
  TokenConfig,
} from "@/middlelayers/datafetch/types";
import { CurrencyRateDetail } from "@/middlelayers/types";
import { listAllCurrencyRates } from "@/middlelayers/configuration";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CexAnalyzer } from "@/middlelayers/datafetch/coins/cex/cex";
import { ReloadIcon, UpdateIcon } from "@radix-ui/react-icons";
import { BTCAnalyzer } from "@/middlelayers/datafetch/coins/btc";
import { DOGEAnalyzer } from "@/middlelayers/datafetch/coins/doge";
import { SOLAnalyzer } from "@/middlelayers/datafetch/coins/sol";
import { ERC20ProAnalyzer } from "@/middlelayers/datafetch/coins/erc20";
import { TRC20ProUserAnalyzer } from "@/middlelayers/datafetch/coins/trc20";
import { getWalletLogo } from "@/lib/utils";
import { prettyPriceNumberToLocaleString } from "@/utils/currency";
import { TonAnalyzer } from "@/middlelayers/datafetch/coins/ton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Switch } from "./ui/switch";

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
  trc20: {
    addresses: [],
  },
  ton: {
    addresses: [],
  },
  others: [],
};

const defaultExChangeConfig = {
  type: "binance",
  apiKey: "",
  secret: "",
  active: true,
};

const defaultWalletConfig = {
  type: "btc",
  address: "",
  active: true,
};

const defaultOtherConfig = {
  symbol: "",
  amount: 0,
};

const supportCoins = ["btc", "erc20", "sol", "doge", "trc20", "ton"];

const cexOptions = [
  {
    value: "binance",
    label: "Binance",
  },
  {
    value: "okex",
    label: "OKX",
  },
  {
    value: "bitget",
    label: "Bitget",
  },
  {
    value: "gate",
    label: "Gate.io",
  },
  {
    value: "kraken",
    label: "Kraken",
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
  {
    value: "trc20",
    label: "TRC20 ( Pro )",
  },
  {
    value: "ton",
    label: "TON",
  },
];

const querySizeOptions = [
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
];

const defaultBaseCurrency = "USD";

const App = ({ onConfigurationSave }: { onConfigurationSave?: () => void }) => {
  const { toast } = useToast();
  const [groupUSD, setGroupUSD] = useState(true);
  const [querySize, setQuerySize] = useState(0);
  const [formChanged, setFormChanged] = useState(false);
  const [preferCurrency, setPreferCurrency] = useState(defaultBaseCurrency);
  const [addExchangeDialogOpen, setAddExchangeDialogOpen] = useState(false);
  const [addWalletDialogOpen, setAddWalletDialogOpen] = useState(false);
  const [addOtherDialogOpen, setAddOtherDialogOpen] = useState(false);

  const [saveCexConfigLoading, setSaveCexConfigLoading] = useState(false);
  const [saveWalletConfigLoading, setSaveWalletConfigLoading] = useState(false);

  const [refreshCurrencyLoading, setRefreshCurrencyLoading] = useState(false);

  const [addExchangeConfig, setAddExchangeConfig] = useState<
    | {
        type: string;
        apiKey: string;
        secret: string;
        // for okx
        password?: string;
        // for bitget
        passphrase?: string;
        alias?: string;
        active: boolean;
      }
    | undefined
  >(undefined);
  const [addWalletConfig, setAddWalletConfig] = useState<
    | {
        type: string;
        address: string;
        alias?: string;
        active: boolean;
      }
    | undefined
  >(undefined);
  const [addOtherConfig, setAddOtherConfig] = useState<
    | {
        alias?: string;
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
      active: boolean;
    }[]
  >([]);

  const [exchanges, setExchanges] = useState<
    {
      alias?: string;
      type: string;
      apiKey: string;
      secret: string;
      password?: string;
      active: boolean;
    }[]
  >([]);

  const [others, setOthers] = useState<
    {
      alias?: string;
      symbol: string;
      amount: number;
    }[]
  >([]);

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

  const preferredCurrencyDetail = useMemo(
    () => _(currencies).find((c) => c.currency === preferCurrency),
    [currencies, preferCurrency]
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
    // load query size
    queryQuerySize().then((s) => setQuerySize(s));

    queryPreferCurrency().then((c) => setPreferCurrency(c.currency));

    getConfiguration()
      .then((d) => {
        const globalConfig = d ?? initialConfiguration;

        setGroupUSD(globalConfig.configs.groupUSD);

        setExchanges(
          _(globalConfig.exchanges)
            .map((ex) => ({
              type: ex.name,
              alias: ex.alias,
              apiKey: ex.initParams.apiKey,
              secret: ex.initParams.secret,
              password: ex.initParams.password,
              active: ex.active ?? true,
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
                    return { type: k, address: a, active: true };
                  }
                  const na = a as {
                    address: string;
                    alias?: string;
                    active?: boolean;
                  };
                  return {
                    type: k,
                    address: na.address,
                    alias: na.alias,
                    active: na.active ?? true,
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
        toast({
          description: "get configuration failed:" + (e.message || e),
          variant: "destructive",
        });
      });
  }

  function onGroupUSDSelectChange(v: boolean) {
    setGroupUSD(!!v);

    // mark form is changed
    markFormChanged();
  }

  function markFormChanged() {
    setFormChanged(true);
  }

  function submitConfiguration() {
    const globalConfig = convertFormDataToConfigurationData();
    let saveError: Error | undefined;

    saveConfiguration(globalConfig)
      .then(() => onConfigurationSave && onConfigurationSave())
      .catch((e) => (saveError = e))
      .finally(() => {
        if (saveError) {
          toast({
            description: saveError.message ?? saveError,
            variant: "destructive",
          });
        }
      });
  }

  function onUpdateCurrencyRatesClick() {
    updateCurrencyRates()
      .then(() => onConfigurationSave && onConfigurationSave())
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
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
        active: ex.active,
      }))
      .value();

    const walletData = _(wallets)
      .groupBy("type")
      .mapValues((ws) => ({
        addresses: _(ws)
          .map((w) => ({
            alias: w.alias,
            address: w.address,
            active: w.active,
          }))
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

  function renderExchangeForm(
    exs: {
      type: string;
      alias?: string;
      apiKey: string;
      secret: string;
      password?: string;
      active: boolean;
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
              <CardTitle className="text-sm font-medium">
                {cexOptions.find((c) => c.value === ex.type)?.label ?? ex.type}
              </CardTitle>
              <div className="flex ">
                <img
                  src={DeleteIcon}
                  className="h-4 w-4 text-muted-foreground hidden group-hover:inline-block mr-2"
                  onClick={() => handleRemoveExchange(idx)}
                />
                <img
                  className="h-4 w-4 text-muted-foreground"
                  src={getWalletLogo(ex.type)}
                ></img>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {ex.alias ?? ex.type + idx}
              </div>
              <p className="text-xs text-muted-foreground overflow-ellipsis overflow-hidden">
                <span>{ex.apiKey}</span>
              </p>

              <div className="flex items-center justify-end mt-2">
                <Switch
                  id="airplane-mode"
                  checked={ex.active}
                  onCheckedChange={() => handleActiveExchange(idx)}
                />
              </div>
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

  function renderWalletForm(
    ws: { type: string; alias?: string; address: string; active: boolean }[]
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
                  <img
                    src={DeleteIcon}
                    className="h-4 w-4 text-muted-foreground hidden group-hover:inline-block mr-2"
                    onClick={() => handleRemoveWallet(idx)}
                  />
                  <img
                    src={getWalletLogo(w.type)}
                    className="h-4 w-4 text-muted-foreground mr-2"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {w.alias ?? w.type + idx}
                </div>
                <p className="text-xs text-muted-foreground overflow-ellipsis overflow-hidden">
                  <span>{w.address}</span>
                </p>
                <div className="flex items-center justify-end">
                  <Switch
                    id="airplane-mode"
                    checked={w.active}
                    onCheckedChange={() => handleActiveWallet(idx)}
                  />
                </div>
              </CardContent>
            </Card>
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

  // save to db, when these values change
  useEffect(() => {
    if (formChanged) {
      submitConfiguration();
    }
  }, [formChanged, groupUSD, exchanges, wallets, others]);

  function handleOthersChange(idx: number, key: string, val: string) {
    const nos = _.set(others, [idx, key], val);
    setOthers([...nos]);
    // mark form is changed
    markFormChanged();
  }

  function onQuerySizeChanged(val: string) {
    const newVal = parseInt(val, 10);
    setQuerySize(newVal);

    // save to db directly
    saveQuerySize(newVal)
      .then(() => onConfigurationSave && onConfigurationSave())
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
      });
  }

  function onPreferCurrencyChanged(val: string) {
    setPreferCurrency(val);
    // mark form is changed

    savePreferCurrency(val)
      .then(() => onConfigurationSave && onConfigurationSave())
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
      });
  }

  function renderOthersForm(
    vals: { alias?: string; symbol: string; amount: number }[]
  ) {
    return _(vals)
      .map((o, idx) => (
        <div key={"other" + idx} className="grid gap-4 grid-cols-4">
          <Input
            type="text"
            name="alias"
            placeholder="alias, e.g. main wallet"
            value={o.alias ?? ""}
            className="w-15"
            autoComplete="off"
            onChange={(e) => handleOthersChange(idx, "alias", e.target.value)}
          />
          <Input
            type="text"
            name="symbol"
            placeholder="symbol, e.g. BTC"
            value={o.symbol}
            className="w-15"
            autoComplete="off"
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
          <a
            onClick={() => handleRemoveOther(idx)}
            className="w-4 h-4 mt-2 cursor-pointer"
          >
            <img src={DeleteIcon} alt="delete" />
          </a>
        </div>
      ))
      .value();
  }

  function handleRemoveExchange(idx: number) {
    setExchanges(_.filter(exchanges, (_, i) => i !== idx));

    // mark form is changed
    markFormChanged();
  }

  function handleActiveExchange(idx: number) {
    setExchanges(
      _.map(exchanges, (ex, i) => {
        if (i === idx) {
          return {
            ...ex,
            active: !ex.active,
          };
        }
        return ex;
      })
    );
    markFormChanged();
  }

  function handleAddWallet(val: {
    type: string;
    address: string;
    active: boolean;
  }) {
    setWallets([...wallets, val]);

    // mark form is changed
    markFormChanged();
  }

  function handleAddOther(val: { symbol: string; amount: number }) {
    setOthers([...others, val]);

    // mark form is changed
    markFormChanged();
  }

  function handleRemoveOther(idx: number) {
    setOthers(_.filter(others, (_, i) => i !== idx));

    // mark form is changed
    markFormChanged();
  }

  function handleRemoveWallet(idx: number) {
    setWallets(_.filter(wallets, (_, i) => i !== idx));

    // mark form is changed
    markFormChanged();
  }

  function handleActiveWallet(idx: number) {
    setWallets(
      _.map(wallets, (w, i) => {
        if (i === idx) {
          return {
            ...w,
            active: !w.active,
          };
        }
        return w;
      })
    );
    markFormChanged();
  }

  function handleExchangeChange(val: {
    type: string;
    apiKey: string;
    secret: string;
    password?: string;
    alias?: string;
    active: boolean;
  }) {
    setExchanges([...exchanges, val]);

    // mark form is changed
    markFormChanged();
  }

  function validateExchangeConfig(cfg: {
    type: string;
    apiKey: string;
    secret: string;
    password?: string;
    passphrase?: string;
    alias?: string;
  }) {
    const ana = new CexAnalyzer({
      exchanges: [
        {
          name: cfg.type,
          initParams: {
            apiKey: cfg.apiKey,
            secret: cfg.secret,
            password: cfg.password,
            passphrase: cfg.passphrase,
          },
        },
      ],
    });

    return ana.verifyConfigs();
  }

  // submit button clicked in add exchange form
  function onAddExchangeFormSubmit() {
    if (
      !addExchangeConfig ||
      !addExchangeConfig.type ||
      !addExchangeConfig.apiKey ||
      !addExchangeConfig.secret
    ) {
      toast({
        description: "Exchange type, api key and secret is required",
        variant: "destructive",
      });
      return;
    }

    if (addExchangeConfig.type === "okex" && !addExchangeConfig.password) {
      toast({
        description: "Password is required for okex",
        variant: "destructive",
      });
      return;
    }

    if (addExchangeConfig.type === "bitget" && !addExchangeConfig.passphrase) {
      toast({
        description: "Passphrase is required for bitget",
        variant: "destructive",
      });
      return;
    }

    setSaveCexConfigLoading(true);

    validateExchangeConfig(addExchangeConfig)
      .then((valid) => {
        if (!valid) {
          toast({
            description: "Invalid api key or secret",
            variant: "destructive",
          });
          return;
        }
        handleExchangeChange(addExchangeConfig);

        // clear
        setAddExchangeConfig(undefined);
        setAddExchangeDialogOpen(false);
      })
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
      })
      .finally(() => setSaveCexConfigLoading(false));
  }

  async function validateWalletAddress(cfg: {
    type: string;
    address: string;
  }): Promise<boolean> {
    const { type, address } = cfg;
    if (!supportCoins.includes(type)) {
      throw new Error("Unsupported wallet type");
    }

    let ana: Analyzer | null;

    const initPayload = {
      addresses: [address],
    };

    switch (type) {
      case "btc":
        ana = new BTCAnalyzer({
          btc: initPayload,
        });
        break;
      case "erc20":
        ana = new ERC20ProAnalyzer(
          {
            erc20: initPayload,
          },
          ""
        );
        break;
      case "sol":
        ana = new SOLAnalyzer({
          sol: initPayload,
        });
        break;
      case "ton":
        ana = new TonAnalyzer({
          ton: initPayload,
        });
        break;
      case "doge":
        ana = new DOGEAnalyzer({
          doge: initPayload,
        });
        break;
      case "trc20":
        ana = new TRC20ProUserAnalyzer(
          {
            trc20: initPayload,
          },
          ""
        );
        break;
      default:
        ana = null;
        break;
    }

    if (!ana) {
      throw new Error("Unsupported wallet type");
    }

    return ana.verifyConfigs();
  }

  async function updateCurrencyRates() {
    setRefreshCurrencyLoading(true);
    try {
      await updateAllCurrencyRates();
      await loadSupportedCurrencies();
    } finally {
      setRefreshCurrencyLoading(false);
    }
  }

  function renderAddExchangeForm() {
    return (
      <Dialog
        open={addExchangeDialogOpen}
        onOpenChange={setAddExchangeDialogOpen}
      >
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
                        <img
                          className="h-4 w-4 text-muted-foreground inline-block mr-2"
                          src={getWalletLogo(o.value)}
                        ></img>
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
                autoComplete="off"
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
                autoComplete="off"
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
            {addExchangeConfig?.type === "bitget" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="passphrase" className="text-right">
                  Passphrase
                </Label>
                <Input
                  id="passphrase"
                  value={addExchangeConfig?.passphrase ?? ""}
                  type="password"
                  onChange={(e) =>
                    setAddExchangeConfig({
                      ...(addExchangeConfig || defaultExChangeConfig),
                      passphrase: e.target.value,
                    })
                  }
                  className="col-span-3"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={onAddExchangeFormSubmit}
              disabled={saveCexConfigLoading}
            >
              {saveCexConfigLoading && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // submit button clicked in add wallet form
  function onAddWalletFormSubmit() {
    if (!addWalletConfig || !addWalletConfig.type || !addWalletConfig.address) {
      // alert
      toast({
        description: "Wallet type and address is required",
        variant: "destructive",
      });
      return;
    }
    setSaveWalletConfigLoading(true);
    validateWalletAddress(addWalletConfig)
      .then((valid) => {
        if (!valid) {
          toast({
            description: `Invalid ${addWalletConfig.type.toUpperCase()} address`,
            variant: "destructive",
          });
          return;
        }

        handleAddWallet(addWalletConfig);

        // clear
        setAddWalletConfig(undefined);

        setAddWalletDialogOpen(false);
      })
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
      })
      .finally(() => setSaveWalletConfigLoading(false));
  }

  function renderAddWalletForm() {
    return (
      <Dialog open={addWalletDialogOpen} onOpenChange={setAddWalletDialogOpen}>
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
                        <img
                          className="h-4 w-4 text-muted-foreground inline-block mr-2"
                          src={getWalletLogo(o.value)}
                        ></img>
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
                autoComplete="off"
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
                autoComplete="off"
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
            <Button
              type="submit"
              onClick={onAddWalletFormSubmit}
              disabled={saveWalletConfigLoading}
            >
              {saveWalletConfigLoading && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // submit button clicked in add other form
  function onAddOtherFormSubmit() {
    if (!addOtherConfig || !addOtherConfig.symbol) {
      // alert
      toast({
        description: "Symbol is required",
        variant: "destructive",
      });
      return;
    }
    handleAddOther(addOtherConfig);
    // clear
    setAddOtherConfig(undefined);
    setAddOtherDialogOpen(false);
  }

  function renderAddOtherForm() {
    return (
      <Dialog open={addOtherDialogOpen} onOpenChange={setAddOtherDialogOpen}>
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
              <Label htmlFor="alias" className="text-right">
                Alias
              </Label>
              <Input
                id="alias"
                value={addOtherConfig?.alias ?? ""}
                autoComplete="off"
                onChange={(e) =>
                  setAddOtherConfig({
                    ...(addOtherConfig || defaultOtherConfig),
                    alias: e.target.value,
                  })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="symbol" className="text-right">
                Symbol
              </Label>
              <Input
                id="symbol"
                value={addOtherConfig?.symbol ?? ""}
                autoComplete="off"
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
            <Button type="submit" onClick={onAddOtherFormSubmit}>
              Save changes
            </Button>
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
            onCheckedChange={(v) => onGroupUSDSelectChange(!!v)}
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
          <div className="flex space-x-2 items-center">
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <UpdateIcon
                    className={`mr-2 h-4 w-4 cursor-pointer ${
                      refreshCurrencyLoading && "animate-spin"
                    }`}
                    onClick={onUpdateCurrencyRatesClick}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh Currency Rates</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {preferredCurrencyDetail &&
              preferCurrency !== defaultBaseCurrency && (
                <div className="text-muted-foreground text-sm">
                  {`1 ${defaultBaseCurrency} = ${prettyPriceNumberToLocaleString(
                    preferredCurrencyDetail.rate
                  )} ${preferredCurrencyDetail.currency}`}
                </div>
              )}
          </div>
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
      <Separator />
      <div className="space-y-2">
        {/* fixme: data misses when updated */}
        <div className="text-l font-bold text-left">Others</div>
        {renderAddOtherForm()}
        {renderOthersForm(others)}
      </div>
    </div>
  );
};

export default App;
