import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  getCachedPreferCurrency,
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
  OtherAttachment,
  StockConfig,
  TokenConfig,
} from "@/middlelayers/datafetch/types";
import { CurrencyRateDetail } from "@/middlelayers/types";
import { listAllCurrencyRates } from "@/middlelayers/configuration";
import { CexAnalyzer } from "@/middlelayers/datafetch/coins/cex/cex";
import { StockAnalyzer } from "@/middlelayers/datafetch/coins/stock/stock-analyzer";
import { BTCAnalyzer } from "@/middlelayers/datafetch/coins/btc";
import { DOGEAnalyzer } from "@/middlelayers/datafetch/coins/doge";
import { SOLAnalyzer } from "@/middlelayers/datafetch/coins/sol";
import { ERC20ProAnalyzer } from "@/middlelayers/datafetch/coins/erc20";
import { TRC20ProUserAnalyzer } from "@/middlelayers/datafetch/coins/trc20";
import { TonAnalyzer } from "@/middlelayers/datafetch/coins/ton";
import { SUIAnalyzer } from "@/middlelayers/datafetch/coins/sui";
import { isProVersion } from "@/middlelayers/license";
import { getImageApiPath } from "@/utils/app";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import bluebird from "bluebird";
import {
  maskSensitive,
  truncateAddress,
  encodedAttachTo,
  parseAttachTo,
} from "@/utils/attach-to";
import {
  CEX_OPTIONS,
  STOCK_BROKER_OPTIONS,
  SUPPORT_CONS,
  WALLET_OPTIONS,
} from "@/middlelayers/constants";
import { useTranslation } from "@/i18n";

import { SummaryCards } from "./summary-cards";
import { GeneralSettings } from "./general-settings";
import { ExchangeSection } from "./exchange-section";
import { StockBrokerSection } from "./stock-broker-section";
import { WalletSection } from "./wallet-section";
import { OthersSection } from "./others-section";
import { QuickLookDialog } from "./quick-look-dialog";
import { AttachModal } from "./attach-modal";

import type {
  ExchangeRow,
  StockBrokerRow,
  WalletRow,
  OtherRow,
  ExchangeDraft,
  StockBrokerDraft,
  WalletDraft,
  SelectOption,
} from "./types";

// ============================================================================
// Constants (unchanged from original)
// ============================================================================

const initialConfiguration: GlobalConfig = {
  configs: {
    groupUSD: true,
    hideInactive: false,
  },
  exchanges: [],
  stockConfig: {
    brokers: [],
  },
  erc20: { addresses: [] },
  btc: { addresses: [] },
  sol: { addresses: [] },
  doge: { addresses: [] },
  trc20: { addresses: [] },
  ton: { addresses: [] },
  sui: { addresses: [] },
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

const defaultStockBrokerConfig = {
  type: "ibkr",
  token: "",
  queryId: "",
  active: true,
};

const supportCoins = SUPPORT_CONS;
const cexOptions = CEX_OPTIONS;
const stockBrokerOptions = STOCK_BROKER_OPTIONS;
const walletOptions = WALLET_OPTIONS;
const defaultBaseCurrency = "USD";

// ============================================================================
// App Component
// ============================================================================

const App = ({
  onConfigurationSave,
  initialPreferCurrency,
}: {
  onConfigurationSave?: () => void;
  initialPreferCurrency?: string;
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const warmStartPreferCurrency =
    initialPreferCurrency || getCachedPreferCurrency();

  // ---- State ----
  const [groupUSD, setGroupUSD] = useState(true);
  const [hideInactive, setHideInactive] = useState(false);
  const [querySize, setQuerySize] = useState(0);
  const [formChanged, setFormChanged] = useState(false);
  const [preferCurrency, setPreferCurrency] = useState(
    warmStartPreferCurrency || defaultBaseCurrency,
  );
  const [preferCurrencyLoading, setPreferCurrencyLoading] = useState(
    !warmStartPreferCurrency,
  );

  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const [addExchangeDialogOpen, setAddExchangeDialogOpen] = useState(false);
  const [addStockBrokerDialogOpen, setAddStockBrokerDialogOpen] =
    useState(false);
  const [addWalletDialogOpen, setAddWalletDialogOpen] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [attachModalTargetIdx, setAttachModalTargetIdx] = useState(-1);

  const [saveCexConfigLoading, setSaveCexConfigLoading] = useState(false);
  const [saveStockBrokerConfigLoading, setSaveStockBrokerConfigLoading] =
    useState(false);
  const [saveWalletConfigLoading, setSaveWalletConfigLoading] = useState(false);
  const [refreshCurrencyLoading, setRefreshCurrencyLoading] = useState(false);

  const [isPro, setIsPro] = useState(false);
  const [proLicense, setProLicense] = useState("");
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [quickLookLoading, setQuickLookLoading] = useState(false);
  const [quickLookData, setQuickLookData] = useState<
    { symbol: string; amount: number; assetType?: "crypto" | "stock" }[]
  >([]);
  const [quickLookLogoMap, setQuickLookLogoMap] = useState<{
    [x: string]: string;
  }>({});
  const [quickLookTitle, setQuickLookTitle] = useState("");

  const [addExchangeConfig, setAddExchangeConfig] = useState<
    ExchangeDraft | undefined
  >(undefined);
  const [addWalletConfig, setAddWalletConfig] = useState<
    WalletDraft | undefined
  >(undefined);
  const [addStockBrokerConfig, setAddStockBrokerConfig] = useState<
    StockBrokerDraft | undefined
  >(undefined);

  const [currencies, setCurrencies] = useState<CurrencyRateDetail[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRow[]>([]);
  const [stockBrokers, setStockBrokers] = useState<StockBrokerRow[]>([]);
  const [others, setOthers] = useState<OtherRow[]>([]);
  const [otherAmountDraftMap, setOtherAmountDraftMap] = useState<
    Record<number, string>
  >({});

  const [exchangePage, setExchangePage] = useState(0);
  const [stockBrokerPage, setStockBrokerPage] = useState(0);
  const [walletPage, setWalletPage] = useState(0);
  const [othersPage, setOthersPage] = useState(0);

  // ---- Derived state ----
  const preferCurrencyOptions: SelectOption[] = useMemo(
    () =>
      currencies.map((c) => ({
          value: c.currency,
          label: `${c.currency} - ${c.alias}`,
        })),
    [currencies],
  );

  const preferredCurrencyDetail = useMemo(
    () => currencies.find((c) => c.currency === preferCurrency),
    [currencies, preferCurrency],
  );

  const visibleExchanges = useMemo(
    () => exchanges.filter((e) => e.active || !hideInactive),
    [exchanges, hideInactive],
  );

  const visibleStockBrokers = useMemo(
    () => stockBrokers.filter((broker) => broker.active || !hideInactive),
    [stockBrokers, hideInactive],
  );

  const visibleWallets = useMemo(
    () => wallets.filter((w) => w.active || !hideInactive),
    [wallets, hideInactive],
  );

  const CONFIG_LIST_PAGE_SIZE = 30;

  const exchangePageCount = useMemo(
    () =>
      Math.max(Math.ceil(visibleExchanges.length / CONFIG_LIST_PAGE_SIZE), 1),
    [visibleExchanges.length],
  );
  const stockBrokerPageCount = useMemo(
    () =>
      Math.max(
        Math.ceil(visibleStockBrokers.length / CONFIG_LIST_PAGE_SIZE),
        1,
      ),
    [visibleStockBrokers.length],
  );
  const walletPageCount = useMemo(
    () => Math.max(Math.ceil(visibleWallets.length / CONFIG_LIST_PAGE_SIZE), 1),
    [visibleWallets.length],
  );
  const othersPageCount = useMemo(
    () => Math.max(Math.ceil(others.length / CONFIG_LIST_PAGE_SIZE), 1),
    [others.length],
  );

  const pagedOthers = useMemo(() => {
    const start = othersPage * CONFIG_LIST_PAGE_SIZE;
    return others.slice(start, start + CONFIG_LIST_PAGE_SIZE);
  }, [others, othersPage]);
  const pagedOthersStartIndex = useMemo(
    () => othersPage * CONFIG_LIST_PAGE_SIZE,
    [othersPage],
  );

  // Attach-to options
  const cexAttachOptions = useMemo(
    () =>
      exchanges.map((ex) => {
          const identity = ex.apiKey;
          const label = ex.alias || `${ex.type}-${maskSensitive(identity)}`;
          return {
            value: `cex:${ex.type}:${identity}`,
            label,
          };
        }),
    [exchanges],
  );
  const walletAttachOptions = useMemo(
    () =>
      wallets.map((w) => {
          const label =
            w.alias || `${w.type.toUpperCase()}-${truncateAddress(w.address)}`;
          return {
            value: `wallet:${w.type}:${w.address}`,
            label,
          };
        }),
    [wallets],
  );

  const activeExchangeCount = useMemo(
    () => exchanges.filter((e) => e.active).length,
    [exchanges],
  );
  const activeStockBrokerCount = useMemo(
    () => stockBrokers.filter((broker) => broker.active).length,
    [stockBrokers],
  );
  const activeWalletCount = useMemo(
    () => wallets.filter((w) => w.active).length,
    [wallets],
  );

  // ---- Effects ----
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
    setStockBrokerPage((prev) => Math.min(prev, stockBrokerPageCount - 1));
  }, [stockBrokerPageCount]);

  useEffect(() => {
    setWalletPage((prev) => Math.min(prev, walletPageCount - 1));
  }, [walletPageCount]);

  useEffect(() => {
    setOthersPage((prev) => Math.min(prev, othersPageCount - 1));
  }, [othersPageCount]);

  // Auto-save on form change
  useEffect(() => {
    if (formChanged) {
      submitConfiguration();
    }
  }, [
    formChanged,
    hideInactive,
    groupUSD,
    exchanges,
    stockBrokers,
    wallets,
    others,
  ]);

  // ---- Data loading ----
  async function loadSupportedCurrencies() {
    const currencies = await listAllCurrencyRates();
    setCurrencies(currencies);
  }

  function loadConfiguration() {
    queryQuerySize().then((s) => setQuerySize(s));

    const shouldSkipPreferCurrencyQuery =
      !!initialPreferCurrency && initialPreferCurrency !== defaultBaseCurrency;

    if (shouldSkipPreferCurrencyQuery) {
      setPreferCurrency(initialPreferCurrency);
      setPreferCurrencyLoading(false);
    } else {
      if (!warmStartPreferCurrency) {
        setPreferCurrencyLoading(true);
      }
      queryPreferCurrency()
        .then((c) => setPreferCurrency(c.currency))
        .catch((e) => {
          toast({
            description: t("config.getPreferCurrencyFailed") + (e.message || e),
            variant: "destructive",
          });
        })
        .finally(() => setPreferCurrencyLoading(false));
    }

    getConfiguration()
      .then((d) => {
        const globalConfig = d ?? initialConfiguration;

        setGroupUSD(!!globalConfig.configs.groupUSD);
        setHideInactive(!!globalConfig.configs.hideInactive);

        setExchanges(
          (globalConfig.exchanges || []).map((ex) => ({
              type: ex.name,
              alias: ex.alias,
              apiKey: ex.initParams.apiKey,
              secret: ex.initParams.secret,
              password: ex.initParams.password,
              passphrase: ex.initParams.passphrase,
              active: ex.active ?? true,
            })),
        );

        setStockBrokers(
          ((globalConfig.stockConfig?.brokers ?? [])).map((broker) => ({
              type: broker.name,
              alias: broker.alias,
              token: broker.initParams.token,
              queryId: broker.initParams.queryId,
              active: broker.active ?? true,
            })),
        );

        setWallets(
          Object.keys(globalConfig)
            .filter(k => supportCoins.includes(k))
            .flatMap((k: string) => {
              const v = (globalConfig as any)[k];
              const addresses = v?.addresses || [];
              return addresses.map((a: any) => {
                  if (typeof a === "string") {
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
                });
            })
        );

        setOthers(globalConfig.others);
      })
      .catch((e) => {
        toast({
          description: t("config.getConfigFailed") + (e.message || e),
          variant: "destructive",
        });
      });
  }

  // ---- Generic helpers ----
  function markFormChanged() {
    setFormChanged(true);
  }

  function notifyConfigurationSaved() {
    if (!onConfigurationSave) return;
    const scrollY = window.scrollY;
    onConfigurationSave();
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY });
    });
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

  function convertFormDataToConfigurationData(): GlobalConfig {
    const exchangesData = exchanges.map((ex) => ({
        name: ex.type,
        alias: ex.alias,
        initParams: {
          apiKey: ex.apiKey,
          secret: ex.secret,
          password: ex.type !== "okex" ? undefined : ex.password,
          passphrase: ex.type !== "bitget" ? undefined : ex.passphrase,
        },
        active: ex.active,
      }));

    const stockBrokerData: StockConfig = {
      brokers: stockBrokers.map((broker) => ({
          name: broker.type,
          alias: broker.alias,
          initParams: {
            token: broker.token,
            queryId: broker.queryId,
          },
          active: broker.active,
        })),
    };

    const walletData = wallets.reduce<Record<string, { addresses: Array<{ alias?: string; address: string; active?: boolean }> }>>((acc, w) => {
      if (!acc[w.type]) {
        acc[w.type] = { addresses: [] }
      }
      acc[w.type].addresses.push({
        alias: w.alias,
        address: w.address,
        active: w.active,
      })
      return acc
    }, {}) as any as TokenConfig;

    return {
      configs: { groupUSD, hideInactive },
      exchanges: exchangesData,
      stockConfig: stockBrokerData,
      ...Object.fromEntries(supportCoins.map((c) => [c, { addresses: [] }])),
      ...walletData,
      others,
    };
  }

  async function buildLogoMap(
    coins: { symbol: string }[],
  ): Promise<{ [x: string]: string }> {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(coins, async (coin) => {
      const path = await getImageApiPath(acd, coin.symbol);
      return { [coin.symbol]: path };
    });
    return Object.assign({}, ...kvs);
  }

  // ---- QuickLook handlers ----
  async function handleQuickLookExchange(ex: ExchangeRow) {
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
        .map((c) => ({
          symbol: c.symbol,
          amount: c.amount,
          assetType: c.assetType,
        }));
      setQuickLookData(filtered);
      buildLogoMap(filtered).then(setQuickLookLogoMap);
    } catch (e: any) {
      toast({
        description: t("config.failedFetchBalances") + (e.message || e),
        variant: "destructive",
      });
      setQuickLookOpen(false);
    } finally {
      setQuickLookLoading(false);
    }
  }

  async function handleQuickLookWallet(wallet: WalletRow) {
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

      if (!ana) throw new Error("Unsupported wallet type");

      const coins = await ana.loadPortfolio();
      const filtered = coins
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .map((c) => ({ symbol: c.symbol, amount: c.amount }));
      setQuickLookData(filtered);
      buildLogoMap(filtered).then(setQuickLookLogoMap);
    } catch (e: any) {
      toast({
        description: t("config.failedFetchBalances") + (e.message || e),
        variant: "destructive",
      });
      setQuickLookOpen(false);
    } finally {
      setQuickLookLoading(false);
    }
  }

  async function handleQuickLookStockBroker(broker: StockBrokerRow) {
    setQuickLookTitle(broker.alias ?? broker.type);
    setQuickLookData([]);
    setQuickLookLogoMap({});
    setQuickLookLoading(true);
    setQuickLookOpen(true);

    try {
      const ana = new StockAnalyzer({
        stockConfig: {
          brokers: [
            {
              name: broker.type,
              alias: broker.alias,
              initParams: {
                token: broker.token,
                queryId: broker.queryId,
              },
              active: true,
            },
          ],
        },
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
        description: t("config.failedFetchPositions") + (e.message || e),
        variant: "destructive",
      });
      setQuickLookOpen(false);
    } finally {
      setQuickLookLoading(false);
    }
  }

  // ---- Attach-to helpers ----
  function getAttachDisplayLabel(a: OtherAttachment): string {
    if (a.kind === "cex") {
      const ex = exchanges.find(
        (e) => e.type === a.type && e.apiKey === a.identity,
      );
      if (ex) {
        const typeLabel =
          cexOptions.find((c) => c.value === ex.type)?.label ?? ex.type;
        const name = ex.alias || maskSensitive(ex.apiKey);
        return `${typeLabel} ${name}`;
      }
    }
    if (a.kind === "wallet") {
      const w = wallets.find(
        (w) => w.type === a.type && w.address === a.identity,
      );
      if (w) {
        const name = w.alias || truncateAddress(w.address);
        return `${w.type.toUpperCase()} ${name}`;
      }
    }
    return `${a.kind}:${a.type}`;
  }

  function handleAttachSelect(encoded: string) {
    handleOthersChange(attachModalTargetIdx, "attachTo", encoded);
    setAttachModalOpen(false);
    setAttachModalTargetIdx(-1);
  }

  // ---- Settings handlers ----
  function onGroupUSDSelectChange(v: boolean) {
    setGroupUSD(!!v);
    markFormChanged();
  }

  function onHideInactiveSelectChange(v: boolean) {
    setHideInactive(!!v);
    markFormChanged();
  }

  function onQuerySizeChanged(val: string) {
    const newVal = parseInt(val, 10);
    setQuerySize(newVal);
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
    savePreferCurrency(val)
      .then(() => notifyConfigurationSaved())
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
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

  async function updateCurrencyRates() {
    setRefreshCurrencyLoading(true);
    try {
      await updateAllCurrencyRates();
      await loadSupportedCurrencies();
    } finally {
      setRefreshCurrencyLoading(false);
    }
  }

  // ---- Exchange handlers ----
  function handleExchangeChange(val: ExchangeDraft) {
    setExchanges([...exchanges, val]);
    markFormChanged();
  }

  function handleRemoveExchange(exchangeType: string, exchangeApiKey: string) {
    const idx = exchanges.findIndex(
      (ex) => ex.type === exchangeType && ex.apiKey === exchangeApiKey,
    );
    if (idx < 0) {
      throw new Error(`cannot find exchange ${exchangeType}/${exchangeApiKey}`);
    }
    setExchanges(exchanges.filter((_, i) => i !== idx));
    markFormChanged();
  }

  function handleActiveExchange(exchangeType: string, exchangeApiKey: string) {
    const idx = exchanges.findIndex(
      (ex) => ex.type === exchangeType && ex.apiKey === exchangeApiKey,
    );
    if (idx < 0) {
      throw new Error(`cannot find exchange ${exchangeType}/${exchangeApiKey}`);
    }
    setExchanges(
      exchanges.map((ex, i) => {
        if (i === idx) return { ...ex, active: !ex.active };
        return ex;
      }),
    );
    markFormChanged();
  }

  function validateExchangeConfig(cfg: ExchangeDraft) {
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
        description: t("config.passwordRequired"),
        variant: "destructive",
      });
      return;
    }

    if (addExchangeConfig.type === "bitget" && !addExchangeConfig.passphrase) {
      toast({
        description: t("config.passphraseRequired"),
        variant: "destructive",
      });
      return;
    }

    setSaveCexConfigLoading(true);
    validateExchangeConfig(addExchangeConfig)
      .then((valid) => {
        if (!valid) {
          toast({
            description: t("config.invalidApiKey"),
            variant: "destructive",
          });
          return;
        }
        handleExchangeChange(addExchangeConfig);
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

  // ---- StockBroker handlers ----
  function handleAddStockBroker(val: StockBrokerDraft) {
    setStockBrokers([...stockBrokers, val]);
    markFormChanged();
  }

  function handleRemoveStockBroker(brokerType: string, queryId: string) {
    const idx = stockBrokers.findIndex(
      (broker) => broker.type === brokerType && broker.queryId === queryId,
    );
    if (idx < 0) {
      throw new Error(`cannot find stock broker ${brokerType}/${queryId}`);
    }
    setStockBrokers(stockBrokers.filter((_, i) => i !== idx));
    markFormChanged();
  }

  function handleActiveStockBroker(brokerType: string, queryId: string) {
    const idx = stockBrokers.findIndex(
      (broker) => broker.type === brokerType && broker.queryId === queryId,
    );
    if (idx < 0) {
      throw new Error(`cannot find stock broker ${brokerType}/${queryId}`);
    }
    setStockBrokers(
      stockBrokers.map((broker, i) => {
        if (i === idx) return { ...broker, active: !broker.active };
        return broker;
      }),
    );
    markFormChanged();
  }

  function validateStockBrokerConfig(cfg: StockBrokerDraft) {
    const ana = new StockAnalyzer({
      stockConfig: {
        brokers: [
          {
            name: cfg.type,
            initParams: {
              token: cfg.token,
              queryId: cfg.queryId,
            },
          },
        ],
      },
    });
    return ana.verifyConfigs();
  }

  function onAddStockBrokerFormSubmit() {
    if (
      !addStockBrokerConfig ||
      !addStockBrokerConfig.type ||
      !addStockBrokerConfig.token ||
      !addStockBrokerConfig.queryId
    ) {
      toast({
        description: "Broker type, token and query id are required",
        variant: "destructive",
      });
      return;
    }

    setSaveStockBrokerConfigLoading(true);
    validateStockBrokerConfig(addStockBrokerConfig)
      .then((valid) => {
        if (!valid) {
          toast({
            description: t("config.invalidStockConfig"),
            variant: "destructive",
          });
          return;
        }
        handleAddStockBroker(addStockBrokerConfig);
        setAddStockBrokerConfig(undefined);
        setAddStockBrokerDialogOpen(false);
      })
      .catch((e) => {
        toast({
          description: e.message ?? e,
          variant: "destructive",
        });
      })
      .finally(() => setSaveStockBrokerConfigLoading(false));
  }

  // ---- Wallet handlers ----
  function handleAddWallet(val: WalletDraft) {
    setWallets([...wallets, val]);
    markFormChanged();
  }

  function handleRemoveWallet(walletType: string, walletAddress: string) {
    const idx = wallets.findIndex(
      (w) => w.type === walletType && w.address === walletAddress,
    );
    if (idx < 0) {
      throw new Error(`cannot find wallet ${walletType}/${walletAddress}`);
    }
    setWallets(wallets.filter((_, i) => i !== idx));
    markFormChanged();
  }

  function handleActiveWallet(walletType: string, walletAddress: string) {
    const idx = wallets.findIndex(
      (w) => w.type === walletType && w.address === walletAddress,
    );
    if (idx < 0) {
      throw new Error(`cannot find wallet ${walletType}/${walletAddress}`);
    }
    setWallets(
      wallets.map((w, i) => {
        if (i === idx) return { ...w, active: !w.active };
        return w;
      }),
    );
    markFormChanged();
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
    const initPayload = { addresses: [address] };

    switch (type) {
      case "btc":
        ana = new BTCAnalyzer({ btc: initPayload });
        break;
      case "erc20":
        ana = new ERC20ProAnalyzer({ erc20: initPayload }, "");
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
        ana = new TRC20ProUserAnalyzer({ trc20: initPayload }, "");
        break;
      default:
        ana = null;
        break;
    }

    if (!ana) throw new Error("Unsupported wallet type");
    return ana.verifyConfigs();
  }

  function onAddWalletFormSubmit() {
    if (!addWalletConfig || !addWalletConfig.type || !addWalletConfig.address) {
      toast({
        description: t("config.invalidWallet"),
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

  // ---- Others handlers ----
  function handleAddOther(val: {
    symbol: string;
    amount: number;
    alias?: string;
  }) {
    setOthers([...others, { ...val, amount: val.amount || 0 }]);
    setOtherAmountDraftMap({});
    markFormChanged();
  }

  function handleRemoveOther(idx: number) {
    setOthers(others.filter((_, i) => i !== idx));
    setOtherAmountDraftMap({});
    markFormChanged();
  }

  function handleOthersChange(
    idx: number,
    key: "alias" | "symbol" | "amount" | "attachTo",
    val: string,
  ) {
    setOthers((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (key === "amount") {
          const parsed = Number(val);
          return {
            ...item,
            amount: Number.isNaN(parsed) ? 0 : parsed,
          };
        }
        if (key === "attachTo") {
          const parsed = val ? parseAttachTo(val) : undefined;
          return { ...item, attachTo: parsed };
        }
        return { ...item, [key]: val };
      }),
    );
    markFormChanged();
  }

  function parseAmountInput(raw: string): number {
    if (!raw.trim()) return 0;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function handleOtherAmountInputChange(idx: number, val: string) {
    setOtherAmountDraftMap((prev) => ({ ...prev, [idx]: val }));
  }

  function commitOtherAmountInput(idx: number) {
    const draft = otherAmountDraftMap[idx];
    if (draft === undefined) return;
    handleOthersChange(idx, "amount", `${parseAmountInput(draft)}`);
    setOtherAmountDraftMap((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }

  // ---- QuickLook dialog control ----
  function handleQuickLookOpenChange(open: boolean) {
    setQuickLookOpen(open);
    if (!open) {
      setQuickLookData([]);
      setQuickLookLogoMap({});
      setQuickLookTitle("");
    }
  }

  // ---- Attach modal control ----
  function handleAttachModalOpenChange(open: boolean) {
    setAttachModalOpen(open);
    if (!open) setAttachModalTargetIdx(-1);
  }

  const currentAttachTo: OtherAttachment | undefined =
    attachModalTargetIdx >= 0
      ? others[attachModalTargetIdx]?.attachTo
      : undefined;

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <div className="space-y-6">
      <QuickLookDialog
        open={quickLookOpen}
        onOpenChange={handleQuickLookOpenChange}
        title={quickLookTitle}
        loading={quickLookLoading}
        data={quickLookData}
        logoMap={quickLookLogoMap}
      />

      <AttachModal
        open={attachModalOpen}
        onOpenChange={handleAttachModalOpenChange}
        currentAttachTo={currentAttachTo}
        cexOptions={cexAttachOptions}
        walletOptions={walletAttachOptions}
        onSelect={handleAttachSelect}
      />

      <div>
        <h3 className="text-lg font-medium tracking-tight">{t("config.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("config.subtitle")}</p>
      </div>

      <SummaryCards
        exchangeCount={exchanges.length}
        activeExchangeCount={activeExchangeCount}
        stockBrokerCount={stockBrokers.length}
        activeStockBrokerCount={activeStockBrokerCount}
        walletCount={wallets.length}
        activeWalletCount={activeWalletCount}
        othersCount={others.length}
        preferCurrency={preferCurrency}
        preferCurrencyLoading={preferCurrencyLoading}
      />

      <GeneralSettings
        groupUSD={groupUSD}
        onGroupUSDChange={onGroupUSDSelectChange}
        hideInactive={hideInactive}
        onHideInactiveChange={onHideInactiveSelectChange}
        querySize={querySize}
        onQuerySizeChange={onQuerySizeChanged}
        preferCurrency={preferCurrency}
        preferCurrencyLoading={preferCurrencyLoading}
        preferCurrencyOptions={preferCurrencyOptions}
        preferredCurrencyDetail={preferredCurrencyDetail}
        onPreferCurrencyChange={onPreferCurrencyChanged}
        refreshCurrencyLoading={refreshCurrencyLoading}
        onUpdateCurrencyRatesClick={onUpdateCurrencyRatesClick}
      />

      <StockBrokerSection
        stockBrokers={stockBrokers}
        visibleStockBrokers={visibleStockBrokers}
        stockBrokerPage={stockBrokerPage}
        stockBrokerPageCount={stockBrokerPageCount}
        isPro={isPro}
        stockBrokerOptions={stockBrokerOptions}
        addStockBrokerDialogOpen={addStockBrokerDialogOpen}
        addStockBrokerConfig={addStockBrokerConfig}
        saveStockBrokerConfigLoading={saveStockBrokerConfigLoading}
        onStockBrokerPageChange={setStockBrokerPage}
        onAddStockBrokerDialogOpenChange={setAddStockBrokerDialogOpen}
        onAddStockBrokerConfigChange={setAddStockBrokerConfig}
        onAddStockBrokerFormSubmit={onAddStockBrokerFormSubmit}
        onToggleActive={handleActiveStockBroker}
        onRemove={handleRemoveStockBroker}
        onQuickLook={handleQuickLookStockBroker}
      />

      <ExchangeSection
        exchanges={exchanges}
        visibleExchanges={visibleExchanges}
        exchangePage={exchangePage}
        exchangePageCount={exchangePageCount}
        isPro={isPro}
        cexOptions={cexOptions}
        addExchangeDialogOpen={addExchangeDialogOpen}
        addExchangeConfig={addExchangeConfig}
        saveCexConfigLoading={saveCexConfigLoading}
        onExchangePageChange={setExchangePage}
        onAddExchangeDialogOpenChange={setAddExchangeDialogOpen}
        onAddExchangeConfigChange={setAddExchangeConfig}
        onAddExchangeFormSubmit={onAddExchangeFormSubmit}
        onToggleActive={handleActiveExchange}
        onRemove={handleRemoveExchange}
        onQuickLook={handleQuickLookExchange}
      />

      <WalletSection
        wallets={wallets}
        visibleWallets={visibleWallets}
        walletPage={walletPage}
        walletPageCount={walletPageCount}
        isPro={isPro}
        walletOptions={walletOptions}
        addWalletDialogOpen={addWalletDialogOpen}
        addWalletConfig={addWalletConfig}
        saveWalletConfigLoading={saveWalletConfigLoading}
        onWalletPageChange={setWalletPage}
        onAddWalletDialogOpenChange={setAddWalletDialogOpen}
        onAddWalletConfigChange={setAddWalletConfig}
        onAddWalletFormSubmit={onAddWalletFormSubmit}
        onToggleActive={handleActiveWallet}
        onRemove={handleRemoveWallet}
        onQuickLook={handleQuickLookWallet}
      />

      <OthersSection
        others={others}
        othersPage={othersPage}
        othersPageCount={othersPageCount}
        pagedOthers={pagedOthers}
        pagedOthersStartIndex={pagedOthersStartIndex}
        otherAmountDraftMap={otherAmountDraftMap}
        onAdd={handleAddOther}
        onOthersChange={handleOthersChange}
        onOtherAmountInputChange={handleOtherAmountInputChange}
        onCommitOtherAmountInput={commitOtherAmountInput}
        onOthersPageChange={setOthersPage}
        onRemove={handleRemoveOther}
        onOpenAttachModal={(idx) => {
          setAttachModalTargetIdx(idx);
          setAttachModalOpen(true);
        }}
        getAttachDisplayLabel={getAttachDisplayLabel}
      />
    </div>
  );
};

export default memo(App);
