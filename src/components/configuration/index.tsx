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
import { ToastAction } from "@/components/ui/toast";
import {
  Analyzer,
  OtherAttachment,
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
import { invalidateUsageCache, isProVersion } from "@/middlelayers/license";
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
import { configuredSecretValues, redactSecrets } from "@/middlelayers/security/redact";
import { classifySourceError } from "@/middlelayers/datafetch/utils/source-failure";
import { configurationFromForm, configurationToForm, initialConfiguration } from "@/middlelayers/ui-state/config-form";

import { AutoRetrySetting } from "@/components/configuration/auto-retry-setting";
import { GeneralSettings } from "./general-settings";
import { CurrencyDesign } from "./currency-design";
import { ExchangeSection } from "./exchange-section";
import { StockBrokerSection } from "./stock-broker-section";
import { WalletSection } from "./wallet-section";
import { OthersSection } from "./others-section";
import { QuickLookDialog } from "./quick-look-dialog";
import { AttachModal } from "./attach-modal";
import { SourceDesign } from "./source-design";
import { sourceAliasFallback } from "@/components/source-display-name";
import { validateCustomPrice } from "@/middlelayers/custom-price";

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
import { useOutletContext } from "react-router-dom";

// ============================================================================
// Constants (unchanged from original)
// ============================================================================

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
  onConfigurationSave?: (aliasChanged?: boolean) => void;
  initialPreferCurrency?: string;
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const section = useOutletContext<string | null>();
  const [sourceTab, setSourceTab] = useState<"exchanges" | "wallets" | "brokers" | "custom">("exchanges");
  const warmStartPreferCurrency =
    initialPreferCurrency || getCachedPreferCurrency();

  // ---- State ----
  const [groupUSD, setGroupUSD] = useState(true);
  const [hideInactive, setHideInactive] = useState(false);
  const [querySize, setQuerySize] = useState(0);
  const [formChanged, setFormChanged] = useState(false);
  const [configurationLoading, setConfigurationLoading] = useState(true);
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
  const [currencyRateError, setCurrencyRateError] = useState(false);

  const [isPro, setIsPro] = useState(false);
  const [proLicense, setProLicense] = useState("");
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [quickLookLoading, setQuickLookLoading] = useState(false);
  const [quickLookData, setQuickLookData] = useState<
    { symbol: string; amount: number; assetType?: "crypto" | "stock" }[]
  >([]);
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
  const safeError = (error: unknown) => redactSecrets(
    error instanceof Error ? error.message : String(error),
    [...configuredSecretValues({ exchanges, stockBrokers, addExchangeConfig, addStockBrokerConfig, proLicense }),
      ...wallets.map((wallet) => wallet.address)],
  );
  const [otherAmountDraftMap, setOtherAmountDraftMap] = useState<
    Record<number, string>
  >({});
  const pendingRename = useRef<{ name: string; undo: () => void } | undefined>(undefined);
  const aliasUndoPending = useRef(false);

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
  const customPriceCurrency = useMemo(() => ({
    currency: preferCurrency,
    rate: preferredCurrencyDetail?.rate ?? (preferCurrency === "USD" ? 1 : Number.NaN),
  }), [preferCurrency, preferredCurrencyDetail?.rate]);

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
            description: t("config.getPreferCurrencyFailed") + safeError(e),
            variant: "destructive",
          });
        })
        .finally(() => setPreferCurrencyLoading(false));
    }

    getConfiguration()
      .then((d) => {
        const globalConfig = d ?? initialConfiguration;

        const form = configurationToForm(globalConfig);
        setGroupUSD(form.groupUSD);
        setHideInactive(form.hideInactive);
        setExchanges(form.exchanges);
        setStockBrokers(form.stockBrokers);
        setWallets(form.wallets);
        setOthers(form.others);
        setConfigurationLoading(false);
      })
      .catch((e) => {
        setConfigurationLoading(false);
        toast({
          description: t("config.getConfigFailed") + safeError(e),
          variant: "destructive",
        });
      });
  }

  // ---- Generic helpers ----
  function markFormChanged() {
    setFormChanged(true);
  }

  function notifyConfigurationSaved(aliasChanged = false) {
    if (!onConfigurationSave) return;
    const main = document.getElementById("app-main-content");
    const scrollY = main?.scrollTop ?? 0;
    onConfigurationSave(aliasChanged);
    requestAnimationFrame(() => {
      if (main) main.scrollTop = scrollY;
    });
  }

  function submitConfiguration() {
    const globalConfig = configurationFromForm({ exchanges, stockBrokers, wallets, groupUSD, hideInactive, others });
    const rename = pendingRename.current;
    pendingRename.current = undefined;
    const aliasChanged = !!rename || aliasUndoPending.current;
    aliasUndoPending.current = false;
    let saveError: Error | undefined;
    saveConfiguration(globalConfig)
      .then(() => {
        notifyConfigurationSaved(aliasChanged);
        if (rename) {
          const expiresAt = Date.now() + 5000;
          toast({
            type: "background",
            description: t("config.renamedTo").replace("{name}", rename.name),
            duration: 5000,
            action: <ToastAction altText={t("common.undo")} onClick={() => {
              if (Date.now() <= expiresAt) { aliasUndoPending.current = true; rename.undo(); }
            }}>{t("common.undo")}</ToastAction>,
          });
        }
      })
      .catch((e) => (saveError = e))
      .finally(() => {
        if (saveError) {
          toast({
            description: safeError(saveError),
            variant: "destructive",
          });
        }
      });
  }

  function renameExchange(type: string, apiKey: string, alias: string) {
    const original = exchanges.find((row) => row.type === type && row.apiKey === apiKey);
    if (!original || original.alias === alias) return;
    setExchanges((current) => current.map((row) => row.type === type && row.apiKey === apiKey ? { ...row, alias } : row));
    pendingRename.current = { name: alias || sourceAliasFallback("exchange", type, apiKey), undo: () => {
      setExchanges((current) => current.map((row) => row.type === type && row.apiKey === apiKey ? { ...row, alias: original.alias } : row));
      markFormChanged();
    } };
    markFormChanged();
  }

  function renameWallet(type: string, address: string, alias: string) {
    const original = wallets.find((row) => row.type === type && row.address === address);
    if (!original || original.alias === alias) return;
    setWallets((current) => current.map((row) => row.type === type && row.address === address ? { ...row, alias } : row));
    pendingRename.current = { name: alias || sourceAliasFallback("wallet", type, address), undo: () => {
      setWallets((current) => current.map((row) => row.type === type && row.address === address ? { ...row, alias: original.alias } : row));
      markFormChanged();
    } };
    markFormChanged();
  }

  function renameBroker(type: string, queryId: string, alias: string) {
    const original = stockBrokers.find((row) => row.type === type && row.queryId === queryId);
    if (!original || original.alias === alias) return;
    setStockBrokers((current) => current.map((row) => row.type === type && row.queryId === queryId ? { ...row, alias } : row));
    pendingRename.current = { name: alias || sourceAliasFallback("broker", type, queryId), undo: () => {
      setStockBrokers((current) => current.map((row) => row.type === type && row.queryId === queryId ? { ...row, alias: original.alias } : row));
      markFormChanged();
    } };
    markFormChanged();
  }

  function renameOther(index: number, alias: string) {
    const original = others[index];
    if (!original || original.alias === alias) return;
    setOthers((current) => current.map((row, i) => i === index ? { ...row, alias } : row));
    pendingRename.current = { name: alias || sourceAliasFallback("custom", original.symbol), undo: () => {
      setOthers((current) => current.map((row, i) => i === index ? { ...row, alias: original.alias } : row));
      markFormChanged();
    } };
    markFormChanged();
  }

  // ---- QuickLook handlers ----
  async function handleQuickLookExchange(ex: ExchangeRow) {
    setQuickLookTitle(ex.alias ?? ex.type);
    setQuickLookData([]);
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
    } catch (e: any) {
      toast({
        description: t("config.failedFetchBalances") + safeError(e),
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
    } catch (e: any) {
      toast({
        description: classifySourceError(e) === "quota"
          ? t("refresh.reason.quota") : t("config.failedFetchBalances") + safeError(e),
        variant: "destructive",
      });
      setQuickLookOpen(false);
    } finally {
      if (wallet.type === "erc20" || wallet.type === "trc20") await invalidateUsageCache();
      setQuickLookLoading(false);
    }
  }

  async function handleQuickLookStockBroker(broker: StockBrokerRow) {
    setQuickLookTitle(broker.alias ?? broker.type);
    setQuickLookData([]);
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
    } catch (e: any) {
      toast({
        description: t("config.failedFetchPositions") + safeError(e),
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
          description: safeError(e),
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
          description: safeError(e),
          variant: "destructive",
        });
      });
  }

  function onUpdateCurrencyRatesClick() {
    setCurrencyRateError(false);
    updateCurrencyRates()
      .then(() => notifyConfigurationSaved())
      .catch((e) => {
        setCurrencyRateError(true);
        if (section !== "currency" || window.innerWidth < 1440) {
          toast({
            description: safeError(e),
            variant: "destructive",
          });
        }
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
          description: safeError(e),
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
          description: safeError(e),
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
          description: safeError(e),
          variant: "destructive",
        });
      })
      .finally(() => setSaveWalletConfigLoading(false));
  }

  // ---- Others handlers ----
  function handleAddOther(val: OtherRow) {
    setOthers([...others, { ...val, amount: val.amount || 0 }]);
    setOtherAmountDraftMap({});
    markFormChanged();
  }

  async function addExchangeFromDesign(draft: ExchangeDraft): Promise<boolean> {
    setSaveCexConfigLoading(true);
    try {
      if (!await validateExchangeConfig(draft)) return false;
      handleExchangeChange(draft);
      return true;
    } catch (error) {
      toast({ description: safeError(error), variant: "destructive" });
      return false;
    } finally {
      setSaveCexConfigLoading(false);
    }
  }

  async function addWalletFromDesign(draft: WalletDraft): Promise<boolean> {
    setSaveWalletConfigLoading(true);
    try {
      if (!await validateWalletAddress(draft)) return false;
      handleAddWallet(draft);
      return true;
    } catch (error) {
      toast({ description: safeError(error), variant: "destructive" });
      return false;
    } finally {
      setSaveWalletConfigLoading(false);
    }
  }

  async function addBrokerFromDesign(draft: StockBrokerDraft): Promise<boolean> {
    setSaveStockBrokerConfigLoading(true);
    try {
      if (!await validateStockBrokerConfig(draft)) return false;
      handleAddStockBroker(draft);
      return true;
    } catch (error) {
      toast({ description: safeError(error), variant: "destructive" });
      return false;
    } finally {
      setSaveStockBrokerConfigLoading(false);
    }
  }

  function addCustomFromDesign(row: OtherRow): boolean {
    if (!row.price || !validateCustomPrice(row.price, others.map((item) => item.symbol), row.symbol)) return false;
    handleAddOther(row);
    return true;
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
  const renameNames = [
    ...exchanges.map((row) => row.alias || sourceAliasFallback("exchange", row.type, row.apiKey)),
    ...wallets.map((row) => row.alias || sourceAliasFallback("wallet", row.type, row.address)),
    ...stockBrokers.map((row) => row.alias || sourceAliasFallback("broker", row.type, row.queryId)),
    ...others.map((row) => row.alias || sourceAliasFallback("custom", row.symbol)),
  ];

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
        <h3 className="text-lg font-medium tracking-tight">{t(section === "currency" ? "settings.phase6.currency" : "settings.phase6.sources")}</h3>
        <p className="text-sm text-muted-foreground">{t("config.subtitle")}</p>
      </div>

      {section === "currency" && <div className="t3-settings-legacy-currency"><GeneralSettings
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
      /></div>}
      {section === "currency" && <CurrencyDesign
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
        currencies={currencies}
        rateError={currencyRateError}
      />}

      {section === "sources" && <AutoRetrySetting t={t} />}
      {section === "sources" && <>
      <p className="text-sm text-muted-foreground">{t("settings.phase6.sourceSummary").replace("{count}", String(exchanges.length + wallets.length + stockBrokers.length + others.length))}</p>
      <div role="group" aria-label={t("settings.phase6.sources")} className="t3-settings-source-tabs">
        {(["exchanges", "wallets", "brokers", "custom"] as const).map((tab) =>
          <button key={tab} type="button" aria-pressed={sourceTab === tab}
            onClick={() => setSourceTab(tab)}>{t(`settings.phase6.sourceTab.${tab}`)}{" "}
            <span className="ml-1 text-muted-foreground">{({ exchanges: exchanges.length, wallets: wallets.length, brokers: stockBrokers.length, custom: others.length })[tab]}</span>
          </button>)}
      </div></>}

      {section === "sources" && sourceTab === "brokers" && <StockBrokerSection
        stockBrokers={stockBrokers}
        renameNames={renameNames}
        renameOffset={exchanges.length + wallets.length}
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
        onRename={renameBroker}
      />}

      {section === "sources" && sourceTab === "exchanges" && <ExchangeSection
        exchanges={exchanges}
        renameNames={renameNames}
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
        onRename={renameExchange}
      />}

      {section === "sources" && sourceTab === "wallets" && <WalletSection
        wallets={wallets}
        renameNames={renameNames}
        renameOffset={exchanges.length}
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
        onRename={renameWallet}
      />}

      {section === "sources" && sourceTab === "custom" && <OthersSection
        others={others}
        renameNames={renameNames}
        renameOffset={exchanges.length + wallets.length + stockBrokers.length}
        baseCurrency={customPriceCurrency}
        othersPage={othersPage}
        othersPageCount={othersPageCount}
        pagedOthers={pagedOthers}
        pagedOthersStartIndex={pagedOthersStartIndex}
        otherAmountDraftMap={otherAmountDraftMap}
        onAdd={handleAddOther}
        onPriceChange={(idx, price) => {
          setOthers((current) => current.map((item, index) => index === idx ? { ...item, price } : item));
          markFormChanged();
        }}
        onOthersChange={handleOthersChange}
        onOtherAmountInputChange={handleOtherAmountInputChange}
        onCommitOtherAmountInput={commitOtherAmountInput}
        onOthersPageChange={setOthersPage}
        onRemove={handleRemoveOther}
        onRename={renameOther}
        onOpenAttachModal={(idx) => {
          setAttachModalTargetIdx(idx);
          setAttachModalOpen(true);
        }}
        getAttachDisplayLabel={getAttachDisplayLabel}
      />}
      {section === "sources" && <SourceDesign
        loading={configurationLoading}
        tab={sourceTab}
        setTab={setSourceTab}
        exchanges={exchanges}
        wallets={wallets}
        brokers={stockBrokers}
        others={others}
        onExchangeToggle={handleActiveExchange}
        onWalletToggle={handleActiveWallet}
        onBrokerToggle={handleActiveStockBroker}
        onExchangeRemove={handleRemoveExchange}
        onWalletRemove={handleRemoveWallet}
        onBrokerRemove={handleRemoveStockBroker}
        onOtherRemove={handleRemoveOther}
        onOtherAttach={(index, attachment) => handleOthersChange(index, "attachTo", attachment ? encodedAttachTo(attachment) : "")}
        onExchangeQuickLook={handleQuickLookExchange}
        onWalletQuickLook={handleQuickLookWallet}
        onBrokerQuickLook={handleQuickLookStockBroker}
        onSaveExchange={addExchangeFromDesign}
        onSaveWallet={addWalletFromDesign}
        onSaveBroker={addBrokerFromDesign}
        onSaveCustom={addCustomFromDesign}
        onExchangeRename={renameExchange}
        onWalletRename={renameWallet}
        onBrokerRename={renameBroker}
        onOtherRename={renameOther}
      />}
    </div>
  );
};

export default memo(App);
