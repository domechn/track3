import { useEffect, useState } from "react";
import { CheckIcon, ChevronDownIcon, ReloadIcon } from "@radix-ui/react-icons";
import { queryHistoricalData } from "@/middlelayers/charts-history";
import { CURRENCY_RATE_HANDLER } from "@/middlelayers/entities/currency";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { useTranslation } from "@/i18n";
import type { GeneralSettingsProps } from "./types";

type Holding = { symbol: string; amount: number; value: number };
type Props = GeneralSettingsProps & {
  currencies: CurrencyRateDetail[];
  rateError: boolean;
};

const previewCurrencies = ["EUR", "GBP", "CNY", "JPY", "HKD"];
const displayName: Record<string, string> = {
  EUR: "Euro", GBP: "British pound", CNY: "Chinese yuan",
  JPY: "Japanese yen", HKD: "Hong Kong dollar",
};
const number = (value: number, digits: number) => value.toLocaleString("en-US", {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const money = (value: number) => `$${number(value, 2)}`;

export function CurrencyDesign({
  groupUSD, onGroupUSDChange, hideInactive, onHideInactiveChange,
  querySize, onQuerySizeChange, preferCurrency, preferCurrencyLoading,
  currencies, onPreferCurrencyChange, refreshCurrencyLoading,
  onUpdateCurrencyRatesClick, rateError,
}: Props) {
  const { t } = useTranslation();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>();
  const [selectOpen, setSelectOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  useEffect(() => {
    let live = true;
    void queryHistoricalData(1, true, { includeTransactions: false })
      .then((rows) => { if (live) setHoldings(rows[0]?.assets ?? []); }).catch(() => {});
    void CURRENCY_RATE_HANDLER.getCurrencyRateByCurrency("EUR")
      .then((rate) => { if (live) setUpdatedAt((rate as CurrencyRateDetail & { updatedAt?: string }).updatedAt); }).catch(() => {});
    return () => { live = false; };
  }, [refreshCurrencyLoading]);
  const total = holdings.reduce((sum, row) => sum + row.value, 0);
  const stable = ["USDT", "USDC"].map((symbol) => holdings.find((row) => row.symbol === symbol));
  const stamp = updatedAt ? new Date(updatedAt) : undefined;
  const today = stamp?.toDateString() === new Date().toDateString();
  const shortDate = stamp?.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) ?? "—";
  const clock = stamp?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) ?? "—";
  const rateList = previewCurrencies.map((code) => currencies.find((item) => item.currency === code))
    .filter((item): item is CurrencyRateDetail => !!item);
  const chosen = currencies.find((item) => item.currency === preferCurrency);
  const currencyLabel = `${preferCurrency} · ${chosen?.alias ?? (preferCurrency === "USD" ? "US dollar" : preferCurrency)}`;

  return <div className="t3-fidelity-currency" data-testid="currency-settings">
    <section className="t3-fidelity-currency-main">
      <div className="heading">{t("fidelity.currency.currency")}</div>
      <div className="setting-row">
        <div><b>{t("fidelity.currency.base")}</b><small>{t("fidelity.currency.baseNote")}</small></div>
        <div className="control">
          <button type="button" className="select" aria-label={t("config.baseCurrency")} aria-expanded={selectOpen}
            onClick={() => setSelectOpen(!selectOpen)} disabled={preferCurrencyLoading}>
            {currencyLabel}<ChevronDownIcon />
          </button>
          {selectOpen && <div className="options" role="listbox" aria-label={t("config.baseCurrency")}>
            {["USD", ...previewCurrencies].map((code) => {
              const item = currencies.find((rate) => rate.currency === code);
              return <button key={code} type="button" role="option" aria-selected={preferCurrency === code}
                onClick={() => { onPreferCurrencyChange(code); setSelectOpen(false); }}>
                <strong>{code}</strong><span>{displayName[code] ?? item?.alias ?? "US dollar"}</span>{preferCurrency === code && <CheckIcon />}
              </button>;
            })}
          </div>}
        </div>
      </div>
      <div className="setting-row rates-row">
        <div><b>{t("fidelity.currency.rates")}</b><small>{rateError
          ? <><em>{t("fidelity.currency.rateError")}</em> {t("fidelity.currency.rateOld").replace("{date}", shortDate).replace("{time}", clock)}</>
          : refreshCurrencyLoading ? t("fidelity.currency.fetching")
            : t("fidelity.currency.updated").replace("{when}", today ? t("fidelity.currency.today") : shortDate).replace("{time}", clock)}</small></div>
        <button type="button" className="pill" onClick={onUpdateCurrencyRatesClick} disabled={refreshCurrencyLoading}>
          <ReloadIcon className={refreshCurrencyLoading ? "spin" : ""} />
          {t(refreshCurrencyLoading ? "fidelity.currency.updating" : "fidelity.currency.update")}
        </button>
      </div>
      <div className="heading display">{t("fidelity.currency.display")}</div>
      <div className="setting-row">
        <div><b>{t("fidelity.currency.stable")}</b><small>{t("fidelity.currency.stableNote")}</small></div>
        <button className="switch" role="switch" aria-checked={groupUSD} aria-label={t("fidelity.currency.stable")}
          onClick={() => onGroupUSDChange(!groupUSD)}><span /></button>
      </div>
      <div className="setting-row">
        <div><b>{t("fidelity.currency.hide")}</b><small>{t("fidelity.currency.hideNote")}</small></div>
        <button className="switch" role="switch" aria-checked={hideInactive} aria-label={t("fidelity.currency.hide")}
          onClick={() => onHideInactiveChange(!hideInactive)}><span /></button>
      </div>
      <div className="setting-row last">
        <div><b>{t("fidelity.currency.history")}</b><small>{t("fidelity.currency.historyNote")}</small></div>
        <div className="control size">
          <button type="button" className="select" aria-expanded={sizeOpen} aria-label={t("fidelity.currency.history")}
            onClick={() => setSizeOpen(!sizeOpen)}>{querySize}<ChevronDownIcon /></button>
          {sizeOpen && <div className="options" role="listbox" aria-label={t("fidelity.currency.history")}>
            {[10, 20, 50].map((size) => <button role="option" aria-selected={querySize === size} key={size} type="button"
              onClick={() => { onQuerySizeChange(String(size)); setSizeOpen(false); }}>{size}</button>)}
          </div>}
        </div>
      </div>
    </section>
    <div className="t3-fidelity-currency-side">
      <section className="t3-fidelity-currency-rates">
        <div className="card-heading"><b>{t("fidelity.currency.preview")}</b><small className={rateError ? "warning" : ""}>{rateError
          ? t("fidelity.currency.from").replace("{date}", shortDate)
          : refreshCurrencyLoading ? t("fidelity.currency.updatingShort")
            : t("fidelity.currency.previewAt").replace("{time}", clock)}</small></div>
        <table><thead><tr><th>{t("fidelity.currency.currency")}</th><th>{t("fidelity.currency.rate")}</th><th>{t("fidelity.currency.yourTotal")}</th></tr></thead>
          <tbody>{(refreshCurrencyLoading ? previewCurrencies : rateList.map((item) => item.currency)).map((code) => {
            const item = rateList.find((rate) => rate.currency === code);
            return <tr key={code}><td>{refreshCurrencyLoading ? <i className="skeleton" /> : <><strong>{code}</strong><small>{displayName[code]}</small></>}</td>
              <td>{refreshCurrencyLoading ? <i className="skeleton" /> : item ? number(item.rate, 4) : "—"}</td>
              <td>{refreshCurrencyLoading ? <i className="skeleton" /> : item ? number(total * item.rate, 0) : "—"}</td></tr>;
          })}</tbody></table>
      </section>
      <section className="t3-fidelity-currency-stable">
        <div className="card-heading"><b>{t("fidelity.currency.stableTitle")}</b><small>{t(groupUSD ? "fidelity.currency.stableOn" : "fidelity.currency.stableOff")}</small></div>
        <p>{t("fidelity.currency.stableDescription")}</p>
        {stable.map((row, index) => <div className="stable-row" key={index}><span><b>{row?.symbol ?? ["USDT", "USDC"][index]}</b> <small>{row ? number(row.amount, 2) : "—"}</small></span><strong>{row ? money(row.value) : "—"}</strong></div>)}
        <div className="stable-row total"><b>{t("fidelity.currency.stableTotal")}</b><strong>{money(stable.reduce((sum, row) => sum + (row?.value ?? 0), 0))}</strong></div>
      </section>
    </div>
  </div>;
}
