import { useEffect, useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, UpdateIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/mobile/i18n";
import { Switch } from "@/mobile/components/ui/switch";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { selectFromDatabase } from "@/middlelayers/database";
import type { CurrencyRateModel } from "@/middlelayers/types";
import type { GeneralSettingsProps } from "@/components/configuration/types";

const previewCurrencies = ["EUR", "GBP", "CNY", "JPY", "HKD"];
const labels: Record<string, string> = {
  USD: "US dollar", EUR: "Euro", GBP: "British pound", CNY: "Chinese yuan",
  JPY: "Japanese yen", HKD: "Hong Kong dollar",
};
const money = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value: number, digits: number) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function FidelityCurrency(props: GeneralSettingsProps & { rateError?: boolean }) {
  const { t } = useTranslation();
  const [picker, setPicker] = useState<"currency" | "size">();
  const [rates, setRates] = useState<CurrencyRateModel[]>([]);
  const [total, setTotal] = useState(0);
  const [stable, setStable] = useState<{ symbol: string; amount: number; value: number }[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.all([selectFromDatabase<CurrencyRateModel>("currency_rates", {}), ASSET_HANDLER.listAssets(1)])
      .then(([nextRates, snapshots]) => {
        if (!live) return;
        setRates(nextRates);
        const assets = snapshots.flat();
        setTotal(assets.reduce((sum, asset) => sum + asset.value, 0));
        setStable(["USDT", "USDC"].map((symbol) => ({
          symbol,
          amount: assets.filter((asset) => asset.symbol === symbol).reduce((sum, asset) => sum + asset.amount, 0),
          value: assets.filter((asset) => asset.symbol === symbol).reduce((sum, asset) => sum + asset.value, 0),
        })));
      }).catch(() => {});
    return () => { live = false; };
  }, [props.refreshCurrencyLoading]);
  const preview = useMemo(() => previewCurrencies.map((currency) => rates.find((rate) => rate.currency === currency))
    .filter((rate): rate is CurrencyRateModel => Boolean(rate)), [rates]);
  const updatedAt = rates.find((rate) => rate.currency === "EUR")?.updatedAt;
  const updatedTime = updatedAt ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(updatedAt)) : undefined;
  const updatedDate = updatedAt ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(updatedAt)) : undefined;
  const updatedLabel = updatedTime ? t("fidelity.settings.currency.updated").replace("{time}", updatedTime) : "—";
  const groupTotal = stable.reduce((sum, asset) => sum + asset.value, 0);

  return <div className="fidelity-currency">
    <section className="fidelity-currency-card is-settings">
      <h2>{t("fidelity.settings.currency.currency")}</h2>
      <div className="fidelity-currency-row">
        <div><strong>{t("fidelity.settings.currency.base")}</strong>
          <p>{t("fidelity.settings.currency.baseHint")}</p></div>
        <div className="fidelity-currency-control">
          <button type="button" className="fidelity-currency-select"
            aria-label={`${t("config.mobile.baseCurrency")} ${props.preferCurrency} ${labels[props.preferCurrency] ?? props.preferredCurrencyDetail?.alias ?? props.preferCurrency}`}
            aria-expanded={picker === "currency"}
            aria-haspopup="listbox" onClick={() => setPicker(picker === "currency" ? undefined : "currency")}>
            <span>{props.preferCurrency} · {labels[props.preferCurrency] ?? props.preferredCurrencyDetail?.alias ?? props.preferCurrency}</span>
            <ChevronDownIcon aria-hidden="true" /></button>
          {picker === "currency" && <div className="fidelity-currency-options" role="listbox">
            {["USD", ...previewCurrencies].map((currency) => <button key={currency} type="button" role="option"
              aria-selected={props.preferCurrency === currency} onClick={() => {
                props.onPreferCurrencyChange(currency);
                setPicker(undefined);
              }}><strong>{currency}</strong><span>{labels[currency]}</span>
              {props.preferCurrency === currency && <CheckIcon aria-hidden="true" />}</button>)}
          </div>}
        </div>
      </div>
      <div className={`fidelity-currency-row is-stack${props.rateError ? " is-error" : ""}`}>
        <div><strong>{t("fidelity.settings.currency.rates")}</strong>
          <p role={props.rateError ? "alert" : undefined}>{props.rateError
            ? <><span className="fidelity-currency-error">{t("fidelity.settings.currency.ratesError")}</span>{" "}
              {t("fidelity.settings.currency.showingRates").replace("{date}", updatedDate ?? "—").replace("{time}", updatedTime ?? "—")}</>
            : props.refreshCurrencyLoading ? t("fidelity.settings.currency.fetching") : updatedLabel}</p></div>
        <button type="button" className="fidelity-currency-update" aria-label={t("config.updateCurrencyRates")}
          onClick={props.onUpdateCurrencyRatesClick}
          disabled={props.preferCurrencyLoading || props.refreshCurrencyLoading}>
          <UpdateIcon aria-hidden="true" className={props.refreshCurrencyLoading ? "animate-spin" : ""} />
          {t(props.refreshCurrencyLoading ? "fidelity.settings.currency.updating" : "fidelity.settings.currency.update")}</button>
      </div>
      <h2 className="fidelity-currency-display-heading">{t("fidelity.settings.currency.display")}</h2>
      <div className="fidelity-currency-row">
        <div><strong>{t("fidelity.settings.currency.group")}</strong>
          <p>{t("fidelity.settings.currency.groupHint")}</p></div>
        <Switch checked={props.groupUSD} onCheckedChange={props.onGroupUSDChange}
          aria-label={`${t("fidelity.settings.currency.group")} · ${t("config.groupStablecoins")}`} />
      </div>
      <div className="fidelity-currency-row">
        <div><strong>{t("fidelity.settings.currency.hide")}</strong>
          <p>{t("fidelity.settings.currency.hideHint")}</p></div>
        <Switch checked={props.hideInactive} onCheckedChange={props.onHideInactiveChange}
          aria-label={t("fidelity.settings.currency.hide")} />
      </div>
      <div className="fidelity-currency-row">
        <div><strong>{t("fidelity.settings.currency.history")}</strong>
          <p>{t("fidelity.settings.currency.historyHint")}</p></div>
        <div className="fidelity-currency-control">
          <button type="button" className="fidelity-currency-select is-small"
            aria-label={t("config.mobile.countOfResults")}
            aria-expanded={picker === "size"} aria-haspopup="listbox"
            onClick={() => setPicker(picker === "size" ? undefined : "size")}>
            <span>{props.querySize}</span><ChevronDownIcon aria-hidden="true" /></button>
          {picker === "size" && <div className="fidelity-currency-options" role="listbox">
            {["10", "20", "50"].map((size) => <button key={size} type="button" role="option"
              aria-selected={String(props.querySize) === size} onClick={() => {
                props.onQuerySizeChange(size);
                setPicker(undefined);
              }}>{size}</button>)}
          </div>}
        </div>
      </div>
    </section>
    <section className="fidelity-currency-card">
      <header><h2>{t("fidelity.settings.currency.preview")}</h2>
        <span className={props.rateError ? "is-stale" : undefined}>{props.rateError
          ? t("fidelity.settings.currency.previewStale").replace("{date}", updatedDate ?? "—")
          : updatedTime ? t("fidelity.settings.currency.previewTime").replace("{time}", updatedTime) : "—"}</span></header>
      <table className="fidelity-currency-table"><thead><tr>
        <th>{t("fidelity.settings.currency.currency")}</th><th>{t("fidelity.settings.currency.rate")}</th>
        <th>{t("fidelity.settings.currency.yourTotal")}</th></tr></thead>
        <tbody>{preview.map((rate) => <tr key={rate.currency}>
          <td><strong>{rate.currency}</strong><small>{labels[rate.currency] ?? rate.alias}</small></td>
          <td>{number(rate.rate, 4)}</td><td>{number(total * rate.rate, 0)}</td>
        </tr>)}</tbody></table>
    </section>
    <section className="fidelity-currency-card">
      <header><h2>{t("fidelity.settings.currency.stablecoin")}</h2>
        <span>{t(props.groupUSD ? "fidelity.settings.currency.groupOn" : "fidelity.settings.currency.groupOff")}</span></header>
      <p>{t("fidelity.settings.currency.stableHint")}</p>
      {stable.map((asset) => <div key={asset.symbol} className="fidelity-currency-kv"><span>{asset.symbol} <small>{number(asset.amount, 2)}</small></span>
        <strong>{money(asset.value)}</strong></div>)}
      <div className="fidelity-currency-kv is-total"><span>{t("fidelity.settings.currency.usdStablecoins")}</span><strong>{money(groupTotal)}</strong></div>
    </section>
  </div>;
}
