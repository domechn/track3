import type { CurrencyRateDetail, WalletAssetsPercentageData } from "@/middlelayers/types";
import { currencyWrapper, prettyNumberKeepNDigitsAfterDecimalPoint, prettyNumberToLocaleString } from "@/utils/currency";
import { useTranslation } from "@/i18n";
import { WALLET_DETAIL_URLS } from "@/middlelayers/constants";
import { openUrl } from "@tauri-apps/plugin-opener";

export function SourceAllocationList({ wallets, selectedSource, currency, name, title, showQuantity = false }: {
  wallets: WalletAssetsPercentageData;
  selectedSource: string | null;
  currency: CurrencyRateDetail;
  name: (wallet: WalletAssetsPercentageData[number]) => string;
  title: string;
  showQuantity?: boolean;
}) {
  const { t } = useTranslation();
  const visible = selectedSource
    ? wallets.filter((wallet) => wallet.wallet === selectedSource)
    : wallets.slice(0, 8);
  const hidden = selectedSource ? [] : wallets.slice(8);
  const hiddenValue = hidden.reduce((sum, wallet) => sum + wallet.value, 0);
  const hiddenPercentage = hidden.reduce((sum, wallet) => sum + wallet.percentage, 0);
  const hiddenAmount = hidden.reduce((sum, wallet) => sum + wallet.amount, 0);
  if (wallets.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{t("walletAllocation.noData")}</p>;
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
          onClick={() => void openUrl(WALLET_DETAIL_URLS[wallet.walletType!](wallet.wallet))}>{name(wallet)}</button>
        : <span className="analyze-source-list-name">{name(wallet)}</span>}
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
    </ol>
  </>;
}
