import { useState } from "react";
import type { CurrencyRateDetail, WalletAssetsPercentageData } from "@/middlelayers/types";
import { currencyWrapper, prettyNumberKeepNDigitsAfterDecimalPoint, prettyNumberToLocaleString } from "@/utils/currency";
import { useTranslation } from "@/i18n";
import { WALLET_DETAIL_URLS } from "@/middlelayers/constants";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BackpackIcon } from "@radix-ui/react-icons";
import EmptyState from "./empty-state";
import AssetLabel from "./common/asset-label";
import { classifyWalletType } from "@/utils/wallet-treemap";
import type { AssetIconKind } from "./ui/asset-icon";

export function sourceIconKind(type?: string): AssetIconKind {
  const category = classifyWalletType(type);
  return category === "cex" ? "exchange" : category === "broker" ? "broker"
    : category === "onchain" ? "wallet" : "custom";
}

export function SourceAllocationList({ wallets, selectedSource, currency, name, title, showQuantity = false, emptyLabel }: {
  wallets: WalletAssetsPercentageData;
  selectedSource: string | null;
  currency: CurrencyRateDetail;
  name: (wallet: WalletAssetsPercentageData[number]) => string;
  title: string;
  showQuantity?: boolean;
  emptyLabel?: (count: number) => string;
}) {
  const { t } = useTranslation();
  const [emptyExpanded, setEmptyExpanded] = useState(false);
  const nonzero = emptyLabel ? wallets.filter((wallet) => wallet.amount !== 0 || wallet.value !== 0) : wallets;
  const empty = emptyLabel ? wallets.filter((wallet) => wallet.amount === 0 && wallet.value === 0) : [];
  const visible = selectedSource
    ? nonzero.filter((wallet) => wallet.wallet === selectedSource)
    : nonzero.slice(0, 8);
  const hidden = selectedSource ? [] : nonzero.slice(8);
  const hiddenValue = hidden.reduce((sum, wallet) => sum + wallet.value, 0);
  const hiddenPercentage = hidden.reduce((sum, wallet) => sum + wallet.percentage, 0);
  const hiddenAmount = hidden.reduce((sum, wallet) => sum + wallet.amount, 0);
  if (wallets.length === 0) return <EmptyState icon={BackpackIcon}
    title={t("walletAllocation.noData")} hint={t("wallets.empty.hint")} />;
  return <>
    {showQuantity && <div className="analyze-source-list-head">
      <span>{t("overview.design.sources")}</span>
      <span>{t("common.amountLabel")}</span>
      <span>{t("common.valueLabel")}</span>
      <span>%</span>
    </div>}
    <ol className={`analyze-source-list${showQuantity ? " analyze-source-list-quantity" : ""}`} aria-label={title}>
    {visible.map((wallet) => <li key={`${wallet.wallet}-${wallet.walletType ?? ""}`}>
      {showQuantity && wallet.walletType && WALLET_DETAIL_URLS[wallet.walletType]
        ? <button type="button" className="analyze-source-list-name text-left hover:underline"
          onClick={() => void openUrl(WALLET_DETAIL_URLS[wallet.walletType!](wallet.wallet))}>
            <AssetLabel kind={sourceIconKind(wallet.walletType)} type={wallet.walletType} name={name(wallet)} size={20} /></button>
        : <span className="analyze-source-list-name"><AssetLabel kind={sourceIconKind(wallet.walletType)}
          type={wallet.walletType} name={name(wallet)} size={20} /></span>}
      <span className="analyze-source-list-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, wallet.percentage))}%` }} />
      </span>
      {showQuantity && <span className="analyze-source-list-amount"><span className="analyze-source-list-amount-label">{t("common.amountLabel")}: </span>{prettyNumberKeepNDigitsAfterDecimalPoint(wallet.amount, 4)}</span>}
      <strong>{currency.symbol}{prettyNumberToLocaleString(currencyWrapper(currency)(wallet.value))}</strong>
      <small>{wallet.percentage.toFixed(1)}%</small>
    </li>)}
    {hidden.length > 0 && <li>
      <span className="analyze-source-list-name">{t("common.others")} (+{hidden.length})</span>
      <span className="analyze-source-list-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, hiddenPercentage))}%` }} />
      </span>
      {showQuantity && <span className="analyze-source-list-amount"><span className="analyze-source-list-amount-label">{t("common.amountLabel")}: </span>{prettyNumberKeepNDigitsAfterDecimalPoint(hiddenAmount, 4)}</span>}
      <strong>{currency.symbol}{prettyNumberToLocaleString(currencyWrapper(currency)(hiddenValue))}</strong>
      <small>{hiddenPercentage.toFixed(1)}%</small>
    </li>}
    {empty.length > 0 && <li className="analyze-source-list-empty"><button type="button" aria-expanded={emptyExpanded}
      onClick={() => setEmptyExpanded(!emptyExpanded)}>{emptyLabel?.(empty.length)} <span aria-hidden="true">{emptyExpanded ? "⌃" : "⌄"}</span></button></li>}
    {emptyExpanded && empty.map((wallet) => <li key={`${wallet.wallet}-${wallet.walletType ?? ""}`}>
      <span className="analyze-source-list-name"><AssetLabel kind={sourceIconKind(wallet.walletType)}
        type={wallet.walletType} name={name(wallet)} size={20} /></span>
      <span className="analyze-source-list-bar" aria-hidden="true" />
      {showQuantity && <span className="analyze-source-list-amount"><span className="analyze-source-list-amount-label">{t("common.amountLabel")}: </span>{prettyNumberKeepNDigitsAfterDecimalPoint(wallet.amount, 4)}</span>}
      <strong>{currency.symbol}{prettyNumberToLocaleString(currencyWrapper(currency)(wallet.value))}</strong>
      <small>0.0%</small>
    </li>)}
    </ol>
  </>;
}
