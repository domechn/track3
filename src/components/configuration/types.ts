import { CurrencyRateDetail } from "@/middlelayers/types";
import { OtherAttachment } from "@/middlelayers/datafetch/types";

// --- Row data types for each config section ---

export interface ExchangeRow {
  type: string;
  alias?: string;
  apiKey: string;
  secret: string;
  password?: string;
  passphrase?: string;
  active: boolean;
}

export interface StockBrokerRow {
  type: string;
  alias?: string;
  token: string;
  queryId: string;
  active: boolean;
}

export interface WalletRow {
  type: string;
  alias?: string;
  address: string;
  active: boolean;
}

export interface OtherRow {
  alias?: string;
  symbol: string;
  amount: number;
  attachTo?: OtherAttachment;
}

// --- Draft config types for add dialogs ---

export interface ExchangeDraft {
  type: string;
  apiKey: string;
  secret: string;
  password?: string;
  passphrase?: string;
  alias?: string;
  active: boolean;
}

export interface StockBrokerDraft {
  type: string;
  token: string;
  queryId: string;
  alias?: string;
  active: boolean;
}

export interface WalletDraft {
  type: string;
  address: string;
  alias?: string;
  active: boolean;
}

export interface OtherDraft {
  alias?: string;
  symbol: string;
  amount: number;
  attachTo?: OtherAttachment;
}

// --- Option types for selects ---

export interface SelectOption {
  value: string;
  label: string;
}

// --- QuickLook types ---

export interface QuickLookItem {
  symbol: string;
  amount: number;
  assetType?: "crypto" | "stock";
}

// --- Summary cards props ---

export interface SummaryCardsProps {
  exchangeCount: number;
  activeExchangeCount: number;
  stockBrokerCount: number;
  activeStockBrokerCount: number;
  walletCount: number;
  activeWalletCount: number;
  othersCount: number;
  preferCurrency: string;
  preferCurrencyLoading: boolean;
}

// --- General settings props ---

export interface GeneralSettingsProps {
  groupUSD: boolean;
  onGroupUSDChange: (v: boolean) => void;
  hideInactive: boolean;
  onHideInactiveChange: (v: boolean) => void;
  querySize: number;
  onQuerySizeChange: (val: string) => void;
  preferCurrency: string;
  preferCurrencyLoading: boolean;
  preferCurrencyOptions: SelectOption[];
  preferredCurrencyDetail: CurrencyRateDetail | undefined;
  onPreferCurrencyChange: (val: string) => void;
  refreshCurrencyLoading: boolean;
  onUpdateCurrencyRatesClick: () => void;
}

// --- Exchange section props ---

export interface ExchangeSectionProps {
  exchanges: ExchangeRow[];
  visibleExchanges: ExchangeRow[];
  exchangePage: number;
  exchangePageCount: number;
  isPro: boolean;
  cexOptions: SelectOption[];
  addExchangeDialogOpen: boolean;
  addExchangeConfig: ExchangeDraft | undefined;
  saveCexConfigLoading: boolean;
  onExchangePageChange: (page: number) => void;
  onAddExchangeDialogOpenChange: (open: boolean) => void;
  onAddExchangeConfigChange: (cfg: ExchangeDraft) => void;
  onAddExchangeFormSubmit: () => void;
  onToggleActive: (type: string, apiKey: string) => void;
  onRemove: (type: string, apiKey: string) => void;
  onQuickLook: (ex: ExchangeRow) => void;
}

// --- Stock broker section props ---

export interface StockBrokerSectionProps {
  stockBrokers: StockBrokerRow[];
  visibleStockBrokers: StockBrokerRow[];
  stockBrokerPage: number;
  stockBrokerPageCount: number;
  isPro: boolean;
  stockBrokerOptions: SelectOption[];
  addStockBrokerDialogOpen: boolean;
  addStockBrokerConfig: StockBrokerDraft | undefined;
  saveStockBrokerConfigLoading: boolean;
  onStockBrokerPageChange: (page: number) => void;
  onAddStockBrokerDialogOpenChange: (open: boolean) => void;
  onAddStockBrokerConfigChange: (cfg: StockBrokerDraft) => void;
  onAddStockBrokerFormSubmit: () => void;
  onToggleActive: (type: string, queryId: string) => void;
  onRemove: (type: string, queryId: string) => void;
  onQuickLook: (broker: StockBrokerRow) => void;
}

// --- Wallet section props ---

export interface WalletSectionProps {
  wallets: WalletRow[];
  visibleWallets: WalletRow[];
  walletPage: number;
  walletPageCount: number;
  isPro: boolean;
  walletOptions: SelectOption[];
  addWalletDialogOpen: boolean;
  addWalletConfig: WalletDraft | undefined;
  saveWalletConfigLoading: boolean;
  onWalletPageChange: (page: number) => void;
  onAddWalletDialogOpenChange: (open: boolean) => void;
  onAddWalletConfigChange: (cfg: WalletDraft) => void;
  onAddWalletFormSubmit: () => void;
  onToggleActive: (type: string, address: string) => void;
  onRemove: (type: string, address: string) => void;
  onQuickLook: (wallet: WalletRow) => void;
}

// --- Others section props ---

export interface OthersSectionProps {
  others: OtherRow[];
  othersPage: number;
  othersPageCount: number;
  pagedOthers: OtherRow[];
  pagedOthersStartIndex: number;
  otherAmountDraftMap: Record<number, string>;
  onAdd: (val: { symbol: string; amount: number; alias?: string }) => void;
  onOthersChange: (
    idx: number,
    key: "alias" | "symbol" | "amount" | "attachTo",
    val: string,
  ) => void;
  onOtherAmountInputChange: (idx: number, val: string) => void;
  onCommitOtherAmountInput: (idx: number) => void;
  onOthersPageChange: (page: number) => void;
  onRemove: (idx: number) => void;
  onOpenAttachModal: (idx: number) => void;
  getAttachDisplayLabel: (a: OtherAttachment) => string;
}

// --- QuickLook dialog props ---

export interface QuickLookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  loading: boolean;
  data: QuickLookItem[];
  logoMap: { [x: string]: string };
}

// --- Attach modal props ---

export interface AttachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAttachTo: OtherAttachment | undefined;
  cexOptions: SelectOption[];
  walletOptions: SelectOption[];
  onSelect: (encoded: string) => void;
}
