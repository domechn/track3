import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import type { CoinComparison, DateOption } from "@/mobile/components/comparison";
import type { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";
import { useTranslation } from "@/mobile/i18n";
import { BottomSheet } from "@/mobile/components/mobile";
import "@/mobile/components/mobile/fidelity.css";
import { barGeometry, comparisonMoverFacts, divergingScale } from "@/components/comparison-fidelity-movers";
import { boundedPercentText } from "@/components/profit-percentage";

const dateAt = (option?: DateOption) => option ? new Date(option.createdAt ?? `${option.label}T00:00:00`) : null;
const day = (date: Date, locale: string, year = true) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB",
  { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }).format(date);
const time = (date: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
const currencyText = (value: number, currency: CurrencyRateDetail, digits = 2, signed = false, masked = false) => {
  if (masked) return "***";
  const converted = currencyWrapper(currency)(value);
  return `${signed ? converted > 0 ? "+" : converted < 0 ? "−" : "" : converted < 0 ? "−" : ""}${currency.symbol}${Math.abs(converted).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
const numberText = (value: number, min = 0, max = 4, masked = false) =>
  masked ? "***" : value.toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });
const percentText = (fraction: number, digits = 2, signed = true, masked = false) => {
  if (masked) return "***";
  const rounded = Number((fraction * 100).toFixed(digits));
  return `${signed && rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(digits)}%`;
};
const tone = (value: number) => value > 0 ? "gain" : value < 0 ? "loss" : "neutral";
const barStyle = (value: number, scale: ReturnType<typeof divergingScale>): CSSProperties => {
  const bar = barGeometry(value, scale);
  return bar ? {
    left: bar.left === undefined ? undefined : `${bar.left}%`,
    right: bar.right === undefined ? undefined : `${bar.right}%`,
    width: `min(${bar.side}%, max(${bar.minimumPixels}px, ${bar.width}%))`,
  } : {};
};
const quickPresets = ["Yesterday", "7 days", "30 days", "Start of month"] as const;

export default function ComparisonFidelity({ currency, quoteColor, busy, dateOptions, baseId, headId, onBaseChange, onHeadChange,
  coins, baseTotal, headTotal, masked, onToggleMask }: {
  currency: CurrencyRateDetail; quoteColor: QuoteColor; busy: boolean; dateOptions: DateOption[];
  baseId: string; headId: string; onBaseChange: (id: string) => void; onHeadChange: (id: string) => void;
  coins: CoinComparison[]; baseTotal: number; headTotal: number; masked: boolean; onToggleMask: () => void;
}) {
  const { t, locale } = useTranslation();
  const [picker, setPicker] = useState<"A" | "B" | null>(null);
  const [candidate, setCandidate] = useState<string>("");
  const [month, setMonth] = useState<Date | null>(null);
  const [quickPreset, setQuickPreset] = useState<(typeof quickPresets)[number] | null>(null);
  const [expanded, setExpanded] = useState({ value: false, percent: false });
  const touchX = useRef<number | null>(null);
  const base = dateOptions.find((option) => option.value === baseId);
  const head = dateOptions.find((option) => option.value === headId);
  const baseDate = dateAt(base), headDate = dateAt(head);
  const change = headTotal - baseTotal;
  const changeFraction = baseTotal ? change / baseTotal : 0;
  const days = baseDate && headDate ? Math.round((headDate.getTime() - baseDate.getTime()) / 86400000) : 0;
  const facts = useMemo(() => comparisonMoverFacts(coins), [coins]);
  const sorted = facts.byValue.map((coin) => ({ coin, change: coin.value.head - coin.value.base }));
  const movers = sorted;
  const relative = facts.byPercent.map((coin) => ({ coin, change: coin.value.head - coin.value.base }));
  const topShare = facts.topShare / 100;
  const sameAmounts = sorted.every(({ coin }) => Math.abs(coin.amount.base - coin.amount.head) < 1e-8);
  const openPicker = (which: "A" | "B") => {
    const option = which === "A" ? base : head;
    setCandidate(option?.value ?? "");
    setMonth(dateAt(option));
    setPicker(which);
  };
  const applyPreset = (label: "Yesterday" | "7 days" | "30 days" | "Start of month") => {
    if (!headDate) return;
    setQuickPreset(label);
    const target = new Date(headDate);
    if (label === "Start of month") target.setDate(1);
    else target.setDate(target.getDate() - (label === "Yesterday" ? 1 : label === "7 days" ? 7 : 30));
    const available = dateOptions.filter((option) => (dateAt(option)?.getTime() ?? Infinity) <= target.getTime())
      .sort((a, b) => (dateAt(b)?.getTime() ?? 0) - (dateAt(a)?.getTime() ?? 0));
    if (available[0]) onBaseChange(available[0].value);
  };
  const currentMonth = month ?? baseDate ?? headDate ?? new Date();
  const newestMonth = dateOptions.reduce<Date | null>((newest, option) => {
    const date = dateAt(option);
    return date && (!newest || date > newest) ? date : newest;
  }, null);
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const offset = (monthStart.getDay() + 6) % 7;
  const count = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => new Date(monthStart.getFullYear(), monthStart.getMonth(), index - offset + 1));
  const chosen = dateOptions.find((option) => option.value === candidate);
  const chosenDate = dateAt(chosen);
  const optionsOnDay = (date: Date) => dateOptions.filter((option) => dateAt(option)?.toDateString() === date.toDateString());
  const valueBars = divergingScale(movers.map(({ change: value }) => value));
  const percentBars = divergingScale(relative.map(({ coin }) => coin.value.changePercent));
  const stableNote = !facts.topRiser
    ? facts.mostMovedStable
      ? facts.stableWithinBasisPoint
        ? t("fidelity.comparison.stableWithin")
        : t("fidelity.comparison.stableMoved").replace("{stable}", facts.mostMovedStable.symbol)
          .replace("{percent}", percentText(facts.mostMovedStable.changePercent / 100))
      : ""
    : facts.mostMovedStable
    ? facts.stableWithinBasisPoint
      ? t("fidelity.comparison.percentNote").replace("{symbol}", facts.topRiser)
      : t("fidelity.comparison.percentNoteMoved").replace("{symbol}", facts.topRiser)
        .replace("{stable}", facts.mostMovedStable.symbol)
        .replace("{percent}", percentText(facts.mostMovedStable.changePercent / 100))
    : t("fidelity.comparison.percentNoteNoStable").replace("{symbol}", facts.topRiser);
  const more = (by: "value" | "percent", count: number) => count > 10 &&
    <button type="button" className="fd-comparison-more" aria-expanded={expanded[by]}
      onClick={() => setExpanded((current) => ({ ...current, [by]: !current[by] }))}>
      {expanded[by] ? t("fidelity.comparison.showLess") : masked
        ? t("common.showMore") : t("fidelity.comparison.andMore").replace("{count}", String(count - 10))}
    </button>;
  const aDate = baseDate ? day(baseDate, locale, false) : "—";
  const bDate = headDate ? day(headDate, locale, false) : "—";
  const currencyValue = (value: number, digits = 2, signed = false) => currencyText(value, currency, digits, signed, masked);
  return <section className="fd-page fd-comparison analyze-comparison" data-quote-color={quoteColor} aria-busy={busy}>
    <header className="fd-comparison-head"><h1>{t("nav.comparison")}</h1><p>{baseDate && headDate && sorted.length
      ? t("fidelity.comparison.summary").replace("{change}", currencyValue(change, 2, true))
        .replace("{percent}", percentText(changeFraction, 2, true, masked))
        .replace("{from}", aDate).replace("{to}", bDate)
        .replace("{first}", sorted[0]?.coin.symbol ?? "—").replace("{second}", sorted[1]?.coin.symbol ?? "—")
        .replace("{share}", percentText(topShare, 0, false, masked))
      : t("fidelity.comparison.summaryEmpty")}</p></header>
    {busy ? <div className="fd-card fd-overview-loading"><span className="fd-skeleton" style={{ width: 130, height: 20 }} /><span className="fd-skeleton" style={{ width: 260, height: 36 }} /></div>
      : !base || !head ? <div className="fd-card fd-empty">{t("common.noData")}</div> : <main className="fd-comparison-grid">
        <section className="fd-card fd-comparison-snapshots comparison-controls-card">
          <div className="fd-card-heading"><h3>{t("fidelity.comparison.snapshots")}</h3><button type="button" className="comparison-mask-toggle fd-comparison-mask" aria-label={t(masked ? "comparison.showValues" : "comparison.hideValues")} aria-pressed={masked} onClick={onToggleMask}>{masked ? <EyeClosedIcon aria-hidden="true" /> : <EyeOpenIcon aria-hidden="true" />}</button></div>
          {(["A", "B"] as const).map((which) => { const option = which === "A" ? base : head; const at = dateAt(option)!;
            return <div className="fd-comparison-field" key={which}><label>{t(`fidelity.comparison.snapshot${which}`)}</label>
              <button type="button" onClick={() => openPicker(which)} aria-expanded={picker === which} aria-label={`${t(`fidelity.comparison.snapshot${which}`)}: ${day(at, locale)}`}>
                <span className="fd-comparison-clock" aria-hidden="true"><ClockIcon /></span><b>{day(at, locale)}</b><span>{time(at)} · {currencyText(which === "A" ? baseTotal : headTotal, currency, 0, false, masked)}</span><ChevronDownIcon aria-hidden="true" /></button></div>; })}
          <div className="fd-comparison-quick"><span>{t("fidelity.comparison.quickRange")}</span><div
            onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              const start = touchX.current;
              touchX.current = null;
              if (start === null) return;
              const delta = (event.changedTouches[0]?.clientX ?? start) - start;
              if (Math.abs(delta) < 40) return;
              const current = quickPresets.indexOf(quickPreset ?? (days === 30 ? "30 days" : "7 days"));
              applyPreset(quickPresets[Math.max(0, Math.min(quickPresets.length - 1, current + (delta < 0 ? 1 : -1)))]);
            }}>{quickPresets.map((option) =>
            <button type="button" key={option} aria-pressed={quickPreset === option || !quickPreset && option === "30 days" && days === 30}
              className={quickPreset === option || !quickPreset && option === "30 days" && days === 30 ? "selected" : ""}
              onClick={() => applyPreset(option)}>{t(`fidelity.comparison.preset.${option}`)}</button>)}</div></div>
          <div className="fd-comparison-kpis">
            <div><span>{t("fidelity.comparison.valueAt").replace("{which}", "A").replace("{date}", aDate)}</span><strong>{currencyValue(baseTotal)}</strong><small>{t("fidelity.comparison.snapshotTime").replace("{time}", time(baseDate!))}</small></div>
            <div><span>{t("fidelity.comparison.valueAt").replace("{which}", "B").replace("{date}", bDate)}</span><strong>{currencyValue(headTotal)}</strong><small>{t("fidelity.comparison.daysLater").replace("{days}", String(days))}</small></div>
            <div><span>{t("fidelity.comparison.change")}</span><strong data-tone={tone(change)}>{currencyValue(change, 2, true)}</strong><small>{t("fidelity.comparison.absolute")}</small></div>
            <div><span>{t("fidelity.comparison.changePercent")}</span><strong data-tone={tone(change)}>{percentText(changeFraction, 2, true, masked)}</strong><small>{t("fidelity.comparison.vsDate").replace("{date}", aDate)}</small></div>
          </div>
        </section>
        <section className="fd-card fd-comparison-assets"><div className="fd-card-heading"><h3>{t("fidelity.comparison.perAsset")}</h3><span>{t("fidelity.comparison.assetSubtitle").replace("{from}", aDate).replace("{to}", bDate)}</span></div>
          {sorted.map(({ coin, change: value }, index) => <div key={`${coin.assetType}:${coin.symbol}`} className={`fd-comparison-asset${index < 2 ? " top" : ""}`}>
            <b>{coin.symbol} <em>{numberText(coin.amount.head, coin.symbol === "USDT" || coin.symbol === "USDC" ? 2 : 0, 4, masked)}</em></b>
            <strong data-tone={tone(value)}>{currencyValue(value, 2, true)}</strong>
            <span>{currencyText(coin.price.base, currency)} → {currencyText(coin.price.head, currency)}</span>
            <span>{percentText(coin.value.changePercent / 100, 2, true, masked)}</span>
            <small>{t("fidelity.comparison.value") + " "}{currencyValue(coin.value.base)} → {currencyValue(coin.value.head)}</small></div>)}
          <div className="fd-comparison-total"><b>{t("fidelity.comparison.total")}</b><strong data-tone={tone(change)}>{currencyValue(change, 2, true)}</strong><small>{currencyValue(baseTotal)} → {currencyValue(headTotal)}</small><small>{percentText(changeFraction, 2, true, masked)}</small></div>
          {sameAmounts && <div className="fd-comparison-info"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="6.5" /><path d="M9 8v4M9 5.8v.2" /></svg><div><b>{t("fidelity.comparison.amountsSame")}</b><span>{t("fidelity.comparison.priceOnly").replace("{change}", currencyValue(change, 2, true))}</span></div></div>}
        </section>
        <div className="comparison-movers">
          <section className="fd-card fd-comparison-movers"><div className="fd-card-heading"><h3>{t("fidelity.comparison.moversValue")}</h3><span>{t("fidelity.comparison.absoluteUsd")}</span></div>
            <div className="fd-comparison-mover-list">
              {movers.slice(0, expanded.value ? undefined : 10).map(({ coin, change: value }) => <div key={coin.symbol} className="fd-comparison-mover"><b>{coin.symbol}</b><span style={{ "--fd-zero": `${valueBars.zero}%` } as CSSProperties}>{barGeometry(value, valueBars) && <i data-tone={tone(value)} style={barStyle(value, valueBars)} />}</span><strong data-tone={tone(value)}>{currencyValue(value, 0, true)}</strong></div>)}
            </div>
            {more("value", movers.length)}
            <p>{t("fidelity.comparison.topShare").replace("{first}", sorted[0]?.coin.symbol ?? "—").replace("{second}", sorted[1]?.coin.symbol ?? "—").replace("{share}", percentText(topShare, 0, false, masked))}</p>
          </section>
          <section className="fd-card fd-comparison-movers percent"><div className="fd-card-heading"><h3>{t("fidelity.comparison.moversPercent")}</h3><span>{t("fidelity.comparison.relative")}</span></div>
            <div className="fd-comparison-mover-list">
              {relative.slice(0, expanded.percent ? undefined : 10).map(({ coin, change: value }) => {
                const exact = percentText(coin.value.changePercent / 100, 2, true, masked);
                const shown = masked ? { text: exact, exact } : boundedPercentText(coin.value.changePercent, exact);
                return <div key={coin.symbol} className="fd-comparison-mover percent"><b>{coin.symbol}</b><span style={{ "--fd-zero": `${percentBars.zero}%` } as CSSProperties}>{barGeometry(coin.value.changePercent, percentBars) && <i data-tone={tone(coin.value.changePercent)} style={barStyle(coin.value.changePercent, percentBars)} />}</span>
                  <strong data-tone={tone(coin.value.changePercent)} title={masked ? undefined : shown.exact} aria-label={masked ? undefined : shown.exact}>{shown.text}</strong><small>{currencyValue(value, 0, true)}</small></div>;
              })}
            </div>
            {more("percent", relative.length)}
            {!masked && stableNote && <p>{stableNote}</p>}
          </section>
        </div>
      </main>}
    <BottomSheet open={picker !== null} onOpenChange={(open) => { if (!open) setPicker(null); }}
      title={t("fidelity.comparison.choose").replace("{which}", picker ?? "A")}
      detents={["medium"]} initialDetent="medium" className="fd-sheet fd-comparison-picker">
      <div className="fd-comparison-month"><button type="button" aria-label={t("fidelity.comparison.previousMonth")} onClick={() => setMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><ChevronLeftIcon aria-hidden="true" /></button>
        <b>{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "long", year: "numeric" }).format(currentMonth)}</b>
        <button type="button" aria-label={t("fidelity.comparison.nextMonth")} disabled={!!newestMonth && currentMonth.getFullYear() === newestMonth.getFullYear() && currentMonth.getMonth() >= newestMonth.getMonth()} onClick={() => setMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><ChevronRightIcon aria-hidden="true" /></button></div>
      <div className="fd-comparison-weekdays">{(["mo", "tu", "we", "th", "fr", "sa", "su"] as const).map((weekday) => <span key={weekday}>{t(`fidelity.calendar.weekday.${weekday}`)}</span>)}</div>
      <div className="fd-comparison-days">{cells.map((cell, index) => { const options = optionsOnDay(cell); const current = cell.toDateString() === chosenDate?.toDateString();
        const start = baseDate && cell >= new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
        const end = headDate && cell <= new Date(headDate.getFullYear(), headDate.getMonth(), headDate.getDate());
        return <button key={index} type="button" disabled={!options.length} data-current={current} data-between={start && end}
          data-end={cell.toDateString() === headDate?.toDateString()} onClick={() => setCandidate(options[0].value)}>{cell.getDate()}{options.length > 0 && <i />}</button>; })}</div>
      {chosenDate && optionsOnDay(chosenDate).length > 1 && <div className="fd-comparison-day-options" role="group" aria-label={t("fidelity.comparison.snapshotsOnDay")}>
        {optionsOnDay(chosenDate).map((option) => <button type="button" key={option.value}
          aria-pressed={candidate === option.value} onClick={() => setCandidate(option.value)}>{time(dateAt(option)!)}</button>)}
      </div>}
      <div className="fd-comparison-legend"><span><i />{t("fidelity.comparison.hasSnapshot")}</span><span>{t("fidelity.comparison.greyNone")}</span></div>
      <div className="fd-comparison-selected">{chosenDate && <><span>{day(chosenDate, locale)}, {time(chosenDate)}</span><strong>{chosen?.value === baseId ? currencyText(baseTotal, currency, 2, false, masked) : chosen?.value === headId ? currencyText(headTotal, currency, 2, false, masked) : "—"}</strong></>}</div>
      <div className="fd-comparison-picker-actions"><button type="button" onClick={() => setPicker(null)}>{t("common.cancel")}</button>
        <button type="button" disabled={!candidate} onClick={() => { if (picker === "A") onBaseChange(candidate); else onHeadChange(candidate); setQuickPreset(null); setPicker(null); }}>{t("fidelity.comparison.useSnapshot")}</button></div>
    </BottomSheet>
  </section>;
}
