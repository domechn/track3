import _ from "lodash";
import { memo, useEffect, useMemo, useState } from "react";
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
import {
  Analyzer,
  GlobalConfig,
  TokenConfig,
} from "@/middlelayers/datafetch/types";
import { CurrencyRateDetail } from "@/middlelayers/types";
import { listAllCurrencyRates } from "@/middlelayers/configuration";
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ReloadIcon,
  TrashIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import { BTCAnalyzer } from "@/middlelayers/datafetch/coins/btc";
import { DOGEAnalyzer } from "@/middlelayers/datafetch/coins/doge";
import { SOLAnalyzer } from "@/middlelayers/datafetch/coins/sol";
import { ERC20ProAnalyzer } from "@/middlelayers/datafetch/coins/erc20";
import { TRC20ProUserAnalyzer } from "@/middlelayers/datafetch/coins/trc20";
import { getWalletLogo } from "@/lib/utils";
import { prettyPriceNumberToLocaleString } from "@/utils/currency";
import { TonAnalyzer } from "@/middlelayers/datafetch/coins/ton";
import { isProVersion } from "@/middlelayers/license";
import { getImageApiPath } from "@/utils/app";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import bluebird from "bluebird";
import { Switch } from "./ui/switch";
import { SUIAnalyzer } from "@/middlelayers/datafetch/coins/sui";
import {
  CEX_OPTIONS,
  SUPPORT_CONS,
  WALLET_OPTIONS,
} from "@/middlelayers/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const initialConfiguration: GlobalConfig = {
  configs: {
    groupUSD: true,
    hideInactive: false,
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
  sui: {
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

const supportCoins = SUPPORT_CONS;

const cexOptions = CEX_OPTIONS;

const walletOptions = WALLET_OPTIONS;

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
const CONFIG_LIST_PAGE_SIZE = 30;

const App = ({ onConfigurationSave }: { onConfigurationSave?: () => void }) => {
  const { toast } = useToast();
  const [groupUSD, setGroupUSD] = useState(true);
  const [hideInactive, setHideInactive] = useState(false);
  const [querySize, setQuerySize] = useState(0);
  const [formChanged, setFormChanged] = useState(false);
  const [preferCurrency, setPreferCurrency] = useState(defaultBaseCurrency);
  const [addExchangeDialogOpen, setAddExchangeDialogOpen] = useState(false);
  const [addWalletDialogOpen, setAddWalletDialogOpen] = useState(false);
  const [addOtherDialogOpen, setAddOtherDialogOpen] = useState(false);

  const [saveCexConfigLoading, setSaveCexConfigLoading] = useState(false);
  const [saveWalletConfigLoading, setSaveWalletConfigLoading] = useState(false);

  const [refreshCurrencyLoading, setRefreshCurrencyLoading] = useState(false);

  const [isPro, setIsPro] = useState(false);
  const [proLicense, setProLicense] = useState("");
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [quickLookLoading, setQuickLookLoading] = useState(false);
  const [quickLookData, setQuickLookData] = useState<
    { symbol: string; amount: number }[]
  >([]);
  const [quickLookLogoMap, setQuickLookLogoMap] = useState<{
    [x: string]: string;
  }>({});
  const [quickLookTitle, setQuickLookTitle] = useState("");

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
  const [addOtherAmountDraft, setAddOtherAmountDraft] = useState("");

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
      passphrase?: string;
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
  const [otherAmountDraftMap, setOtherAmountDraftMap] = useState<
    Record<number, string>
  >({});
  const [exchangePage, setExchangePage] = useState(0);
  const [walletPage, setWalletPage] = useState(0);
  const [othersPage, setOthersPage] = useState(0);

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

  const visibleExchanges = useMemo(
    () => exchanges.filter((e) => e.active || !hideInactive),
    [exchanges, hideInactive]
  );

  const visibleWallets = useMemo(
    () => wallets.filter((w) => w.active || !hideInactive),
    [wallets, hideInactive]
  );
  const exchangePageCount = useMemo(
    () => Math.max(Math.ceil(visibleExchanges.length / CONFIG_LIST_PAGE_SIZE), 1),
    [visibleExchanges.length]
  );
  const walletPageCount = useMemo(
    () => Math.max(Math.ceil(visibleWallets.length / CONFIG_LIST_PAGE_SIZE), 1),
    [visibleWallets.length]
  );
  const pagedVisibleExchanges = useMemo(() => {
    const start = exchangePage * CONFIG_LIST_PAGE_SIZE;
    return visibleExchanges.slice(start, start + CONFIG_LIST_PAGE_SIZE);
  }, [visibleExchanges, exchangePage]);
  const pagedVisibleWallets = useMemo(() => {
    const start = walletPage * CONFIG_LIST_PAGE_SIZE;
    return visibleWallets.slice(start, start + CONFIG_LIST_PAGE_SIZE);
  }, [visibleWallets, walletPage]);
  const othersPageCount = useMemo(
    () => Math.max(Math.ceil(others.length / CONFIG_LIST_PAGE_SIZE), 1),
    [others.length]
  );
  const pagedOthers = useMemo(() => {
    const start = othersPage * CONFIG_LIST_PAGE_SIZE;
    return others.slice(start, start + CONFIG_LIST_PAGE_SIZE);
  }, [others, othersPage]);
  const pagedOthersStartIndex = useMemo(
    () => othersPage * CONFIG_LIST_PAGE_SIZE,
    [othersPage]
  );

  const activeExchangeCount = useMemo(
    () => exchanges.filter((e) => e.active).length,
    [exchanges]
  );

  const activeWalletCount = useMemo(
    () => wallets.filter((w) => w.active).length,
    [wallets]
  );

  useEffect(() => {
    loadConfiguration();
    loadSupportedCurrencies();
    isProVersion()
      .then((info) => {
        setIsPro(info.isPro);
        if (info.license) setProLicense(info.license);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setExchangePage((prev) => Math.min(prev, exchangePageCount - 1));
  }, [exchangePageCount]);

  useEffect(() => {
    setWalletPage((prev) => Math.min(prev, walletPageCount - 1));
  }, [walletPageCount]);

  useEffect(() => {
    setOthersPage((prev) => Math.min(prev, othersPageCount - 1));
  }, [othersPageCount]);

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

        setGroupUSD(!!globalConfig.configs.groupUSD);
        setHideInactive(!!globalConfig.configs.hideInactive);

        setExchanges(
          _(globalConfig.exchanges)
            .map((ex) => ({
              type: ex.name,
              alias: ex.alias,
              apiKey: ex.initParams.apiKey,
              secret: ex.initParams.secret,
              password: ex.initParams.password,
              passphrase: ex.initParams.passphrase,
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

  function onHideInactiveSelectChange(v: boolean) {
    setHideInactive(!!v);

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
      .then(() => notifyConfigurationSaved())
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
      .then(() => notifyConfigurationSaved())
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
      });
  }

  function notifyConfigurationSaved() {
    if (!onConfigurationSave) {
      return;
    }

    const scrollY = window.scrollY;
    onConfigurationSave();
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY });
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
          passphrase: ex.type !== "bitget" ? undefined : ex.passphrase,
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
        hideInactive,
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

  function maskSensitive(val: string) {
    if (!val) {
      return "-";
    }
    if (val.length <= 8) {
      return val;
    }
    return `${val.slice(0, 4)}...${val.slice(-4)}`;
  }

  async function buildLogoMap(
    coins: { symbol: string }[]
  ): Promise<{ [x: string]: string }> {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(coins, async (coin) => {
      const path = await getImageApiPath(acd, coin.symbol);
      return { [coin.symbol]: path };
    });
    return _.assign({}, ...kvs);
  }

  async function handleQuickLookExchange(ex: {
    type: string;
    alias?: string;
    apiKey: string;
    secret: string;
    password?: string;
    passphrase?: string;
  }) {
    setQuickLookTitle(ex.alias ?? ex.type);
    setQuickLookData([]);
    setQuickLookLogoMap({});
    setQuickLookLoading(true);
    setQuickLookOpen(true);

    try {
      const ana = new CexAnalyzer({
        exchanges: [
          {
            name: ex.type,
            initParams: {
              apiKey: ex.apiKey,
              secret: ex.secret,
              password: ex.password,
              passphrase: ex.passphrase,
            },
          },
        ],
      });

      const coins = await ana.loadPortfolio();
      const filtered = coins
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .map((c) => ({ symbol: c.symbol, amount: c.amount }));
      setQuickLookData(filtered);
      buildLogoMap(filtered).then(setQuickLookLogoMap);
    } catch (e: any) {
      toast({
        description: "Failed to fetch balances: " + (e.message || e),
        variant: "destructive",
      });
      setQuickLookOpen(false);
    } finally {
      setQuickLookLoading(false);
    }
  }

  async function handleQuickLookWallet(wallet: {
    type: string;
    alias?: string;
    address: string;
  }) {
    setQuickLookTitle(wallet.alias ?? `${wallet.type.toUpperCase()} Wallet`);
    setQuickLookData([]);
    setQuickLookLogoMap({});
    setQuickLookLoading(true);
    setQuickLookOpen(true);

    try {
      const initPayload = { addresses: [wallet.address] };
      let ana: Analyzer | null;

      switch (wallet.type) {
        case "btc":
          ana = new BTCAnalyzer({ btc: initPayload });
          break;
        case "erc20":
          ana = new ERC20ProAnalyzer({ erc20: initPayload }, proLicense);
          break;
        case "sol":
          ana = new SOLAnalyzer({ sol: initPayload });
          break;
        case "ton":
          ana = new TonAnalyzer({ ton: initPayload });
          break;
        case "sui":
          ana = new SUIAnalyzer({ sui: initPayload });
          break;
        case "doge":
          ana = new DOGEAnalyzer({ doge: initPayload });
          break;
        case "trc20":
          ana = new TRC20ProUserAnalyzer({ trc20: initPayload }, proLicense);
          break;
        default:
          ana = null;
          break;
      }

      if (!ana) {
        throw new Error("Unsupported wallet type");
      }

      const coins = await ana.loadPortfolio();
      const filtered = coins
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .map((c) => ({ symbol: c.symbol, amount: c.amount }));
      setQuickLookData(filtered);
      buildLogoMap(filtered).then(setQuickLookLogoMap);
    } catch (e: any) {
      toast({
        description: "Failed to fetch balances: " + (e.message || e),
        variant: "destructive",
      });
      setQuickLookOpen(false);
    } finally {
      setQuickLookLoading(false);
    }
  }

  function renderQuickLookDialog() {
    return (
      <Dialog
        open={quickLookOpen}
        onOpenChange={(open) => {
          setQuickLookOpen(open);
          if (!open) {
            setQuickLookData([]);
            setQuickLookLogoMap({});
            setQuickLookTitle("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Look - {quickLookTitle}</DialogTitle>
            <DialogDescription>
              Current asset balances
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {quickLookLoading ? (
              <div className="flex items-center justify-center py-8">
                <ReloadIcon className="h-6 w-6 animate-spin" />
              </div>
            ) : quickLookData.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No assets found
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 text-sm font-medium text-muted-foreground px-2">
                  <span>Symbol</span>
                  <span className="text-right">Amount</span>
                </div>
                {quickLookData.map((item, idx) => (
                  <div
                    key={item.symbol + idx}
                    className="grid grid-cols-2 text-sm px-2 py-1.5 rounded hover:bg-muted items-center"
                  >
                    <div className="flex items-center">
                      <img
                        className="inline-block w-[20px] h-[20px] mr-2 rounded-full"
                        src={quickLookLogoMap[item.symbol] || UnknownLogo}
                        alt={item.symbol}
                      />
                      <span className="font-medium">{item.symbol}</span>
                    </div>
                    <span className="text-right">
                      {prettyPriceNumberToLocaleString(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function renderExchangeForm(
    exs: {
      type: string;
      alias?: string;
      apiKey: string;
      secret: string;
      password?: string;
      passphrase?: string;
      active: boolean;
    }[]
  ) {
    if (exs.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No exchange found. Add your first CEX API key to start tracking.
        </div>
      );
    }

    return (
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[170px]">Exchange</TableHead>
            <TableHead className="w-[170px]">Alias</TableHead>
            <TableHead className="w-[220px]">API Key</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[84px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exs.map((ex, idx) => (
            <TableRow
              key={ex.type + ex.apiKey + idx}
              className="h-[42px] group align-middle"
            >
              <TableCell className="w-[170px]">
                <div className="flex items-center gap-2 text-sm">
                  <img
                    className="w-[18px] h-[18px] rounded-full"
                    src={getWalletLogo(ex.type)}
                    alt={ex.type}
                  />
                  <span className="truncate">
                    {cexOptions.find((c) => c.value === ex.type)?.label ?? ex.type}
                  </span>
                </div>
              </TableCell>
              <TableCell className="w-[170px] text-sm">
                {ex.alias || `${ex.type}-${idx + 1}`}
              </TableCell>
              <TableCell className="w-[220px] text-xs text-muted-foreground">
                <p className="truncate">{maskSensitive(ex.apiKey)}</p>
              </TableCell>
              <TableCell className="w-[120px]">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ex.active}
                    onCheckedChange={() => handleActiveExchange(ex.type, ex.apiKey)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {ex.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="w-[84px] text-right">
                <div className="inline-flex w-[64px] items-center justify-end gap-1">
                  {isPro && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleQuickLookExchange(ex)}
                      title="Quick look"
                    >
                      <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleRemoveExchange(ex.type, ex.apiKey)}
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  function renderWalletForm(
    ws: { type: string; alias?: string; address: string; active: boolean }[]
  ) {
    if (ws.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No wallet found. Add your first wallet address to start tracking.
        </div>
      );
    }

    return (
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Wallet</TableHead>
            <TableHead className="w-[170px]">Alias</TableHead>
            <TableHead className="w-[320px]">Address</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[84px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ws.map((w, idx) => (
            <TableRow
              key={w.type + w.address + idx}
              className="h-[42px] group align-middle"
            >
              <TableCell className="w-[140px]">
                <div className="flex items-center gap-2 text-sm">
                  <img
                    src={getWalletLogo(w.type)}
                    className="w-[18px] h-[18px] rounded-full"
                    alt={w.type}
                  />
                  <span>{w.type.toUpperCase()}</span>
                </div>
              </TableCell>
              <TableCell className="w-[170px] text-sm">
                {w.alias || `${w.type}-${idx + 1}`}
              </TableCell>
              <TableCell className="w-[320px] text-xs text-muted-foreground">
                <p className="truncate">{w.address}</p>
              </TableCell>
              <TableCell className="w-[120px]">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={w.active}
                    onCheckedChange={() => handleActiveWallet(w.type, w.address)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {w.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="w-[84px] text-right">
                <div className="inline-flex w-[64px] items-center justify-end gap-1">
                  {isPro && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleQuickLookWallet(w)}
                      title="Quick look"
                    >
                      <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleRemoveWallet(w.type, w.address)}
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // save to db, when these values change
  useEffect(() => {
    if (formChanged) {
      submitConfiguration();
    }
  }, [formChanged, hideInactive, groupUSD, exchanges, wallets, others]);

  function handleOthersChange(
    idx: number,
    key: "alias" | "symbol" | "amount",
    val: string
  ) {
    setOthers((prev) =>
      prev.map((item, i) => {
        if (i !== idx) {
          return item;
        }
        if (key === "amount") {
          const parsed = Number(val);
          return {
            ...item,
            amount: Number.isNaN(parsed) ? 0 : parsed,
          };
        }
        return {
          ...item,
          [key]: val,
        };
      })
    );
    // mark form is changed
    markFormChanged();
  }

  function parseAmountInput(raw: string): number {
    if (!raw.trim()) {
      return 0;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function handleOtherAmountInputChange(idx: number, val: string) {
    setOtherAmountDraftMap((prev) => ({
      ...prev,
      [idx]: val,
    }));
  }

  function commitOtherAmountInput(idx: number) {
    const draft = otherAmountDraftMap[idx];
    if (draft === undefined) {
      return;
    }

    handleOthersChange(idx, "amount", `${parseAmountInput(draft)}`);
    setOtherAmountDraftMap((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  function onQuerySizeChanged(val: string) {
    const newVal = parseInt(val, 10);
    setQuerySize(newVal);

    // save to db directly
    saveQuerySize(newVal)
      .then(() => notifyConfigurationSaved())
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
      .then(() => notifyConfigurationSaved())
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
      });
  }

  function renderOthersForm(
    vals: { alias?: string; symbol: string; amount: number }[],
    startIndex = 0
  ) {
    if (vals.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No custom symbol yet.
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alias</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vals.map((o, idx) => {
            const globalIdx = startIndex + idx;
            return (
            <TableRow
              key={"other" + globalIdx}
              className="h-[42px] group align-middle"
            >
              <TableCell>
                <Input
                  type="text"
                  name="alias"
                  placeholder="Main wallet"
                  value={o.alias ?? ""}
                  autoComplete="off"
                  onChange={(e) => handleOthersChange(globalIdx, "alias", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="text"
                  name="symbol"
                  placeholder="BTC"
                  value={o.symbol}
                  autoComplete="off"
                  onChange={(e) => handleOthersChange(globalIdx, "symbol", e.target.value)}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="text"
                  inputMode="decimal"
                  name="amount"
                  placeholder="0"
                  value={otherAmountDraftMap[globalIdx] ?? `${o.amount}`}
                  onChange={(e) => handleOtherAmountInputChange(globalIdx, e.target.value)}
                  onBlur={() => commitOtherAmountInput(globalIdx)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => handleRemoveOther(globalIdx)}
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  function handleRemoveExchange(exchangeType: string, exchangeApiKey: string) {
    const idx = _(exchanges).findIndex(
      (ex) => ex.type === exchangeType && ex.apiKey === exchangeApiKey
    );
    if (idx < 0) {
      throw new Error(`cannot find exchange ${exchangeType}/${exchangeApiKey}`);
    }
    setExchanges(_.filter(exchanges, (_, i) => i !== idx));

    // mark form is changed
    markFormChanged();
  }

  function handleActiveExchange(exchangeType: string, exchangeApiKey: string) {
    const idx = _(exchanges).findIndex(
      (ex) => ex.type === exchangeType && ex.apiKey === exchangeApiKey
    );
    if (idx < 0) {
      throw new Error(`cannot find exchange ${exchangeType}/${exchangeApiKey}`);
    }
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
    setOtherAmountDraftMap({});

    // mark form is changed
    markFormChanged();
  }

  function handleRemoveOther(idx: number) {
    setOthers(_.filter(others, (_, i) => i !== idx));
    setOtherAmountDraftMap({});

    // mark form is changed
    markFormChanged();
  }

  function handleRemoveWallet(walletType: string, walletAddress: string) {
    const idx = _(wallets).findIndex(
      (w) => w.type === walletType && w.address === walletAddress
    );
    if (idx < 0) {
      throw new Error(`cannot find wallet ${walletType}/${walletAddress}`);
    }
    setWallets(_.filter(wallets, (_, i) => i !== idx));

    // mark form is changed
    markFormChanged();
  }

  function handleActiveWallet(walletType: string, walletAddress: string) {
    const idx = _(wallets).findIndex(
      (w) => w.type === walletType && w.address === walletAddress
    );
    if (idx < 0) {
      throw new Error(`cannot find wallet ${walletType}/${walletAddress}`);
    }
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
    passphrase?: string;
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
      case "sui":
        ana = new SUIAnalyzer({
          sui: initPayload,
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
          <Button variant="outline" size="sm">
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Exchange
          </Button>
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
          <Button variant="outline" size="sm">
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Wallet
          </Button>
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
    handleAddOther({
      ...addOtherConfig,
      amount: parseAmountInput(addOtherAmountDraft),
    });
    // clear
    setAddOtherConfig(undefined);
    setAddOtherAmountDraft("");
    setAddOtherDialogOpen(false);
  }

  function renderAddOtherForm() {
    return (
      <Dialog open={addOtherDialogOpen} onOpenChange={setAddOtherDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Symbol
          </Button>
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
                type="text"
                inputMode="decimal"
                value={addOtherAmountDraft}
                onChange={(e) =>
                  setAddOtherAmountDraft(e.target.value)
                }
                onBlur={() =>
                  setAddOtherConfig({
                    ...(addOtherConfig || defaultOtherConfig),
                    amount: parseAmountInput(addOtherAmountDraft),
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
      {renderQuickLookDialog()}
      <div>
        <h3 className="text-lg font-medium">Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Manage exchanges, wallets, custom symbols, and global preferences.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Exchanges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{exchanges.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeExchangeCount} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wallets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{wallets.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeWalletCount} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custom Symbols
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{others.length}</div>
            <p className="text-xs text-muted-foreground">
              Manual balance entries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Base Currency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{preferCurrency}</div>
            <p className="text-xs text-muted-foreground">Current quote base</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="groupUSD"
              checked={groupUSD}
              onCheckedChange={(v) => onGroupUSDSelectChange(!!v)}
            />
            <Label htmlFor="groupUSD" className="text-sm">
              Group stable coins into USDT (USDC, TUSD, DAI...)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hideInactive"
              checked={hideInactive}
              onCheckedChange={(v) => onHideInactiveSelectChange(!!v)}
            />
            <Label htmlFor="hideInactive" className="text-sm">
              Hide inactive exchanges and wallets
            </Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Count of Results
              </div>
              <Select onValueChange={onQuerySizeChanged} value={querySize + ""}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Query size" />
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
              <div className="text-sm font-medium text-muted-foreground">
                Base Currency
              </div>
              <div className="flex items-center gap-2">
                <Select
                  onValueChange={onPreferCurrencyChanged}
                  value={preferCurrency}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Prefer currency" />
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={onUpdateCurrencyRatesClick}
                >
                  <UpdateIcon
                    className={`h-4 w-4 ${
                      refreshCurrencyLoading ? "animate-spin" : ""
                    }`}
                  />
                </Button>
              </div>
              <p className="min-h-4 text-xs text-muted-foreground">
                <span
                  className={`block transition-opacity duration-250 ${
                    preferredCurrencyDetail &&
                    preferCurrency !== defaultBaseCurrency
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                >
                  {preferredCurrencyDetail &&
                  preferCurrency !== defaultBaseCurrency
                    ? `1 ${defaultBaseCurrency} = ${prettyPriceNumberToLocaleString(
                        preferredCurrencyDetail.rate
                      )} ${preferredCurrencyDetail.currency}`
                    : "\u00A0"}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Exchanges
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {visibleExchanges.length} shown / {exchanges.length} total
              </p>
            </div>
            {renderAddExchangeForm()}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {renderExchangeForm(pagedVisibleExchanges)}
          {visibleExchanges.length > CONFIG_LIST_PAGE_SIZE ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExchangePage((prev) => Math.max(prev - 1, 0))}
                disabled={exchangePage <= 0}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-xs text-muted-foreground">
                {exchangePage + 1} / {exchangePageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setExchangePage((prev) =>
                    Math.min(prev + 1, exchangePageCount - 1)
                  )
                }
                disabled={exchangePage >= exchangePageCount - 1}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Wallets
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {visibleWallets.length} shown / {wallets.length} total
              </p>
            </div>
            {renderAddWalletForm()}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {renderWalletForm(pagedVisibleWallets)}
          {visibleWallets.length > CONFIG_LIST_PAGE_SIZE ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWalletPage((prev) => Math.max(prev - 1, 0))}
                disabled={walletPage <= 0}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-xs text-muted-foreground">
                {walletPage + 1} / {walletPageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setWalletPage((prev) => Math.min(prev + 1, walletPageCount - 1))
                }
                disabled={walletPage >= walletPageCount - 1}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Others
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Add manual holdings not covered by APIs
              </p>
            </div>
            {renderAddOtherForm()}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {renderOthersForm(pagedOthers, pagedOthersStartIndex)}
          {others.length > CONFIG_LIST_PAGE_SIZE ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOthersPage((prev) => Math.max(prev - 1, 0))}
                disabled={othersPage <= 0}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-xs text-muted-foreground">
                {othersPage + 1} / {othersPageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setOthersPage((prev) => Math.min(prev + 1, othersPageCount - 1))
                }
                disabled={othersPage >= othersPageCount - 1}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default memo(App);
