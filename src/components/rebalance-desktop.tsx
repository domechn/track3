import { Fragment, useState, type ComponentProps } from "react";
import type { RebalanceHolding, RebalanceResult, RebalanceTarget } from "@/middlelayers/rebalance";
import type { AssetType } from "@/middlelayers/datafetch/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { useTranslation } from "@/i18n";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import FidelityIcon from "./fidelity-icon";
import AssetLabel from "./common/asset-label";
import { SignedInlineText } from "./common/signed-inline-text";
import "./rebalance-desktop.css";
import { useChartHitArea } from "./chart-tooltip";

type Props = {
  holdings: RebalanceHolding[];
  targets: RebalanceTarget[];
  tolerance: number;
  result?: RebalanceResult;
  currency: CurrencyRateDetail;
  minimumTradeValue: number;
  ignoreBelowValue: number;
  stablecoinsAsCash: boolean;
  mode: "full" | "buys";
  injectedCash: number;
  validation: string;
  normalizeError: boolean;
  loading: boolean;
  loadError: boolean;
  profileLoadError: boolean;
  partialSnapshot: boolean;
  saved: boolean;
  dirty: boolean;
  status: string;
  isProUser?: boolean;
  lastRefreshAt?: string;
  onTarget: (index: number, target: RebalanceTarget) => void;
  onPreset: (equal: boolean) => void;
  onNormalize: () => void;
  onTolerance: (value: number) => void;
  onMinimumTrade: (value: number) => void;
  onIgnoreBelow: (value: number) => void;
  onStablecoinsAsCash: (value: boolean) => void;
  onMode: (value: "full" | "buys") => void;
  onInjectedCash: (value: number) => void;
  onAddTarget: (holding?: RebalanceHolding) => void;
  onRemoveTarget: (index: number) => void;
  onSave: () => void;
  onDelete: () => void;
  onExport: () => void;
};

const fixed = (value: number, digits = 1) => value.toLocaleString("en-US", {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});

function DraftInput({ value, format, parse, onValue, ...inputProps }: {
  value: number;
  format: (value: number) => string;
  parse: (raw: string) => number;
  onValue: (value: number) => void;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "onBlur">) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input {...inputProps} value={draft ?? (Number.isNaN(value) ? "" : format(value))}
    onChange={(event) => {
      const raw = event.target.value;
      setDraft(raw);
      onValue(parse(raw));
    }} onBlur={() => setDraft(null)} />;
}

export default function RebalanceDesktop(props: Props) {
  const { t } = useTranslation();
  const chart = useChartHitArea();
  const pts = (value: number) => t("rebalance.fidelity.pts")
    .replace("{value}", `${value > 0 ? "+" : value < 0 ? "−" : ""}${fixed(Math.abs(value))}`);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastIgnoreBelow, setLastIgnoreBelow] = useState(props.ignoreBelowValue);
  const {
    holdings, targets, tolerance, result, currency, minimumTradeValue, ignoreBelowValue,
    stablecoinsAsCash, partialSnapshot,
  } = props;
  const money = (value: number, digits = 2) =>
    Number.isFinite(value) ? `${currency.symbol}${fixed(value, digits)}` : "–";
  const currentTotal = holdings.reduce((sum, item) => sum + item.value, 0);
  const targetTotal = targets.reduce((sum, item) => sum + (Number.isFinite(item.percent) ? item.percent : 0), 0);
  const complete = targets.length > 0 && Math.abs(targetTotal - 100) < 0.000001;
  const sorted = [...holdings].sort((a, b) => b.value - a.value);
  const targetFor = (holding: RebalanceHolding) => targets.find((target) =>
    target.kind === "asset" && target.assetType === holding.assetType && target.symbol === holding.symbol);
  const allocation = sorted.map((holding) => {
    const target = targetFor(holding);
    const current = currentTotal ? holding.value / currentTotal * 100 : 0;
    return { ...holding, current, target, drift: target && Number.isFinite(target.percent) ? current - target.percent : undefined };
  });
  const largest = allocation.filter((row) => row.drift !== undefined)
    .sort((a, b) => Math.abs(b.drift ?? 0) - Math.abs(a.drift ?? 0))[0];
  const outside = allocation.filter((row) => row.drift !== undefined && Math.abs(row.drift) > tolerance);
  const trades = result?.rows.filter((row) => row.kind === "asset" && row.tradeValue !== 0) ?? [];
  const sells = trades.filter((row) => row.tradeValue < 0).sort((a, b) => a.tradeValue - b.tradeValue);
  const buys = trades.filter((row) => row.tradeValue > 0).sort((a, b) => b.tradeValue - a.tradeValue);
  const sellTotal = sells.reduce((sum, row) => sum - row.tradeValue, 0);
  const buyTotal = buys.reduce((sum, row) => sum + row.tradeValue, 0);
  const netCash = sellTotal - buyTotal;
  const afterOutside = result?.rows.filter((row) => row.kind === "asset" &&
    targets.some((target) => target.kind === "asset" && target.assetType === row.assetType && target.symbol === row.symbol) &&
    result.projectedTotal > 0 && Math.abs((row.value + row.tradeValue) / result.projectedTotal * 100 - row.targetPercent) > tolerance) ?? [];
  const hasTrades = complete && !!result && !partialSnapshot;
  const empty = !targets.length;
  const bad = !!targets.length && !complete;
  const optionsInvalid = ![props.injectedCash, minimumTradeValue, ignoreBelowValue].every((value) => Number.isFinite(value) && value >= 0);
  const invalid = bad || !!props.validation || props.normalizeError || optionsInvalid;
  const barScale = Math.max(40, ...allocation.map((row) => Math.max(row.current, Number.isFinite(row.target?.percent) ? row.target!.percent : 0)));
  const unit = (value: number | null) =>
    value === null ? "–" : Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 4 });
  const advancedActive = props.mode !== "full" || props.injectedCash !== 0 || ![0.5, 1, 2, 5].includes(tolerance);
  const tradeRows = [...sells, ...buys];
  const tradeCountNote = (rows: typeof trades) => rows.length === 0 ? t("rebalance.fidelity.tradeCountZero")
    : t(rows.length === 1 ? "rebalance.fidelity.tradeCountOne" : "rebalance.fidelity.tradeCount")
      .replace("{count}", String(rows.length)).replace("{assets}", rows.map((row) => row.symbol).join(", "));
  const summary = [
    { label: t("rebalance.summary.portfolio"), value: money(currentTotal), note: t("rebalance.fidelity.allSources") },
    { label: empty ? t("rebalance.fidelity.targets") : t("rebalance.summary.targets"),
      value: empty ? t("rebalance.fidelity.notSet") : `${fixed(targetTotal)}%`,
      note: empty ? t("rebalance.fidelity.assetCount").replace("{count}", "0").replace("{total}", String(allocation.length)) : complete
        ? t("rebalance.fidelity.validCount").replace("{count}", String(allocation.filter((row) => row.target).length)).replace("{total}", String(allocation.length))
        : t("rebalance.fidelity.from100").replace("{drift}", pts(targetTotal - 100)), tone: empty ? "zero" : complete ? "positive" : "negative" },
    { label: t("rebalance.summary.drift"), value: largest ? `${largest.symbol} ${pts(largest.drift ?? 0)}` : "–",
      note: largest ? t("rebalance.fidelity.nowTarget").replace("{current}", `${fixed(largest.current)}%`).replace("{target}", `${fixed(largest.target?.percent ?? 0)}%`) : t("rebalance.fidelity.needsTargets"),
      tone: largest && Math.abs(largest.drift ?? 0) > tolerance ? "warning" : "zero" },
    { label: t("rebalance.summary.outside"), value: empty ? "–" : t("rebalance.fidelity.ofCount").replace("{count}", String(outside.length)).replace("{total}", String(allocation.length)),
      note: t("rebalance.fidelity.toleranceValue").replace("{value}", fixed(tolerance)), tone: empty ? "zero" : undefined },
    { label: t("rebalance.summary.trades"), value: hasTrades ? String(trades.length) : "–",
      note: empty ? t("rebalance.fidelity.needsTargets") : bad ? t("rebalance.fidelity.pausedUntil") :
        t("rebalance.fidelity.sellMin").replace("{sell}", money(sellTotal)).replace("{minimum}", money(minimumTradeValue)),
      tone: hasTrades ? undefined : "zero" },
  ];
  const subtitle = empty ? t("rebalance.fidelity.emptySubtitle") : bad
    ? t("rebalance.fidelity.invalidSubtitle").replace("{total}", `${fixed(targetTotal)}%`)
    : t("rebalance.fidelity.subtitle")
      .replace("{outside}", String(outside.length)).replace("{count}", String(allocation.length))
      .replace("{tolerance}", fixed(tolerance)).replace("{total}", money(currentTotal));
  const refreshDate = props.lastRefreshAt ? new Date(props.lastRefreshAt) : null;
  const refreshTime = props.lastRefreshAt?.match(/(?:T| )(\d{2}:\d{2})/)?.[1];
  const refreshStale = !!refreshDate && !Number.isNaN(refreshDate.valueOf()) && refreshDate.toDateString() !== new Date().toDateString();
  const refreshLabel = refreshStale ? `${refreshDate!.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} ${refreshTime}` : refreshTime;
  const canSave = complete && !props.validation && !optionsInvalid;

  return <div className="t3-fidelity-page t3-fidelity-rebalance">
    <header className="t3-fidelity-head">
      <div><h1>{t("rebalance.title")}</h1><p>{subtitle}</p></div>
      {refreshTime && <span className={`t3-fidelity-stamp ${refreshStale ? "stale" : ""}`}><i />{t("rebalance.fidelity.pricesAsOf")} {refreshLabel}</span>}
    </header>
    {props.loadError && <p role="alert" className="t3-fidelity-error">{t("rebalance.loadError")}</p>}
    {props.profileLoadError && <p role="alert" className="t3-fidelity-error">{t("rebalance.profileLoadError")}</p>}
    {partialSnapshot && <p role="status" className="t3-fidelity-error">{t("rebalance.partialPause")}</p>}
    <div className="t3-fidelity-grid">
      <section className="t3-fidelity-card t3-fidelity-kpis" data-testid="rebalance-summary" data-valid={complete}>
        {summary.map((item) => <div key={item.label}><span>{item.label}</span><strong data-tone={item.tone}><SignedInlineText text={item.value} /></strong><small><SignedInlineText text={item.note} /></small></div>)}
      </section>
      <section className="t3-fidelity-card t3-fidelity-allocation" data-chart-group="">
        <div className="t3-fidelity-card-head"><h2>{t("rebalance.targets")}</h2><span>{t(empty ? "rebalance.fidelity.barScale" : "rebalance.fidelity.tickScale").replace("{scale}", fixed(barScale, 0))}</span></div>
        <div className="t3-fidelity-allocation-row t3-fidelity-table-head">
          <span>{t("rebalance.fidelity.asset")}</span><span>{t("rebalance.fidelity.currentVsTarget")}</span>
          <span>{t("rebalance.fidelity.current")}</span><span>{t("rebalance.fidelity.target")}</span><span>{t("rebalance.fidelity.drift")}</span>
        </div>
        {props.loading ? <div className="t3-fidelity-empty" role="status">{t("rebalance.fidelity.loading")}</div>
          : allocation.length === 0 ? <div className="t3-fidelity-empty t3-fidelity-allocation-empty">
            <b>{t("rebalance.fidelity.noAssets")}</b><span>{t("rebalance.fidelity.addSourceHint")}</span>
          </div> : allocation.map((row, index) => {
          const targetIndex = targets.indexOf(row.target!);
          const detail = <div><strong>{row.symbol}</strong><div>{t("rebalance.fidelity.current")} {fixed(row.current, 2)}%</div>
            <div>{t("rebalance.fidelity.target")} {row.target ? `${fixed(row.target.percent, 2)}%` : "–"}</div>
            <div>{t("rebalance.fidelity.drift")} {row.drift === undefined ? "–"
              : t("rebalance.fidelity.pts").replace("{value}", `${row.drift > 0 ? "+" : row.drift < 0 ? "−" : ""}${fixed(Math.abs(row.drift), 2)}`)}</div></div>;
          return <div className="t3-fidelity-allocation-row" key={`${row.assetType}:${row.symbol}`}>
            <div className="t3-fidelity-asset"><AssetLabel asset={row} size={20} quiet secondary={t(`rebalance.${row.assetType}`)} /></div>
            <div className="t3-fidelity-allocation-bar" role="button"
              {...chart.markProps(index, t("rebalance.fidelity.chartMark").replace("{asset}", row.symbol)
                .replace("{current}", `${fixed(row.current, 2)}%`)
                .replace("{target}", row.target ? `${fixed(row.target.percent, 2)}%` : t("rebalance.fidelity.notSet")), detail)}
              aria-label={`${row.symbol}: ${fixed(row.current)}% current${row.target && Number.isFinite(row.target.percent) ? `, ${fixed(row.target.percent)}% target` : ""}`}
              aria-description={t("rebalance.fidelity.chartMark").replace("{asset}", row.symbol)
                .replace("{current}", `${fixed(row.current, 2)}%`)
                .replace("{target}", row.target ? `${fixed(row.target.percent, 2)}%` : t("rebalance.fidelity.notSet"))}>
              <i style={{ width: `${row.current / barScale * 100}%` }} />
              {row.target && Number.isFinite(row.target.percent) && <u style={{ left: `${row.target.percent / barScale * 100}%` }} />}
            </div>
            <span className="t3-fidelity-num">{fixed(row.current)}%</span>
            {row.target ? <label className="t3-fidelity-target"><DraftInput key={`${row.assetType}:${row.symbol}`} type="text" inputMode="decimal"
              value={row.target.percent} format={(value) => fixed(value)} parse={(raw) => raw === "" ? NaN : Number(raw)}
              aria-label={t("rebalance.percentFor").replace("{asset}", row.symbol)}
              aria-invalid={invalid} aria-describedby={invalid ? "rebalance-target-error" : undefined}
              onValue={(percent) => props.onTarget(targetIndex, { ...row.target!, percent })} /><span>%</span></label>
              : <button className="t3-fidelity-target t3-fidelity-set" type="button" onClick={() => {
                props.onAddTarget(row); setAdvancedOpen(true);
              }}><FidelityIcon name="plus" /> {t("rebalance.fidelity.set")}</button>}
            <span className={`t3-fidelity-num ${row.drift !== undefined && Math.abs(row.drift) > tolerance ? "t3-fidelity-warning" : "t3-fidelity-muted"}`}>
              {row.drift === undefined ? "–" : pts(row.drift)}
            </span>
          </div>;
        })}
        {chart.tooltip}
        <div className={`t3-fidelity-allocation-row t3-fidelity-total ${bad ? "bad" : ""}`}>
          <b>{t("rebalance.fidelity.total")}</b><span /><span className="t3-fidelity-num">{fixed(100)}%</span>
          <strong className={bad ? "t3-fidelity-negative" : empty ? "t3-fidelity-muted" : "t3-fidelity-positive"}>{fixed(targetTotal)}%</strong>
          <span className="t3-tag" data-tone={bad ? "negative" : empty ? "neutral" : "positive"}>
            {bad ? t("rebalance.fidelity.ptsOver").replace("{value}", fixed(targetTotal - 100)) : empty ? t("rebalance.fidelity.needs100") : t("rebalance.fidelity.sums100")}
          </span>
        </div>
        {invalid && <div className="t3-fidelity-banner" id="rebalance-target-error" role="alert"><FidelityIcon name="alert" /><div><b>{bad ? t("rebalance.fidelity.invalidTitle").replace("{total}", `${fixed(targetTotal)}%`) : props.normalizeError ? t("rebalance.validationOther") : props.validation || t("rebalance.validationOptions")}</b>
          {bad && <span>{t("rebalance.fidelity.invalidHint").replace("{asset}", largest?.symbol ?? "").replace("{points}", fixed(targetTotal - 100))}</span>}</div></div>}
      </section>
      <section className="t3-fidelity-card t3-fidelity-rules">
        <div className="t3-fidelity-card-head"><button type="button" className="t3-fidelity-heading-button" onClick={() => setAdvancedOpen(true)}>{t("rebalance.fidelity.rules")}</button><span className="t3-fidelity-rules-actions">{props.dirty ? <>{t("rebalance.fidelity.unsaved")}<button type="button" aria-label={t("rebalance.saveTargets")} disabled={!canSave} onClick={props.onSave}>{t("common.save")}</button></> : advancedActive ? t("rebalance.fidelity.advancedActive") : props.saved ? t("rebalance.fidelity.savedHere") : t("rebalance.fidelity.notSaved")}</span></div>
        <div className="t3-fidelity-fields">
          <div className="t3-fidelity-field"><b>{t("rebalance.fidelity.presets")}</b><div className="t3-fidelity-presets">
            <button onClick={() => props.onPreset(true)}>{t("rebalance.fidelity.equalWeights")}</button>
            <button onClick={() => props.onPreset(false)}>{t("rebalance.fidelity.currentAllocation")}</button>
            <button disabled={empty} className={bad ? "selected" : ""} onClick={props.onNormalize}>{t("rebalance.normalize")}</button>
          </div><small>{t("rebalance.fidelity.presetsHint").replace("{share}", fixed(allocation.length ? 100 / allocation.length : 0))}</small></div>
          <div className="t3-fidelity-field"><b>{t("rebalance.fidelity.tolerance")}</b><div className="t3-fidelity-segmented">
            {[0.5, 1, 2, 5].map((value) => <button key={value} className={tolerance === value ? "selected" : ""} onClick={() => props.onTolerance(value)}>{t("rebalance.fidelity.pts").replace("{value}", fixed(value))}</button>)}
          </div><small>{t("rebalance.fidelity.toleranceHint")}</small></div>
          <label className="t3-fidelity-field t3-fidelity-minimum"><b>{t("rebalance.fidelity.minimumTrade")}</b><DraftInput type="text" inputMode="decimal" value={minimumTradeValue}
            format={(value) => `${currency.symbol}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            parse={(raw) => {
              const numeric = raw.replaceAll(currency.symbol, "").replaceAll(",", "").trim();
              return numeric === "" ? NaN : Number(numeric);
            }}
            onValue={props.onMinimumTrade} aria-label={t("rebalance.fidelity.minimumTrade")} /><small>{t("rebalance.fidelity.minimumHint")}</small></label>
          <label className="t3-fidelity-switch-field"><span><b>{t("rebalance.fidelity.ignoreSmall")}</b><small>{t("rebalance.fidelity.ignoreHint").replace("{amount}", money(ignoreBelowValue || lastIgnoreBelow || 5000 * currency.rate, 0))}</small></span>
            <input type="checkbox" role="switch" checked={ignoreBelowValue > 0} onChange={(event) => {
              if (!event.target.checked) setLastIgnoreBelow(ignoreBelowValue);
              props.onIgnoreBelow(event.target.checked ? lastIgnoreBelow || 5000 * currency.rate : 0);
            }} /></label>
          <label className="t3-fidelity-switch-field"><span><b>{t("rebalance.stablecoinsAsCash")}</b><small>{t("rebalance.fidelity.stableHintAccurate")}</small></span>
            <input type="checkbox" role="switch" checked={stablecoinsAsCash} onChange={(event) => props.onStablecoinsAsCash(event.target.checked)} /></label>
        </div>
        <div className="t3-fidelity-foot"><FidelityIcon name="lock" />{t("rebalance.fidelity.sync")}</div>
      </section>
      <section className="t3-fidelity-card t3-fidelity-trades">
        <div className="t3-fidelity-card-head"><h2>{t("rebalance.suggestions")}</h2><span>{hasTrades
          ? t(props.mode === "buys" ? "rebalance.fidelity.tradesHintBuys" : "rebalance.fidelity.tradesHintAccurate").replace("{minimum}", money(minimumTradeValue))
          : invalid ? t("rebalance.fidelity.paused") : t("rebalance.fidelity.nothing")}</span></div>
        {hasTrades ? <table aria-label={t("rebalance.suggestions")}><thead><tr>
          {["step", "action", "asset", "amount", "units", "price", "shareNowTarget"].map((heading) => <th key={heading}>{t(`rebalance.fidelity.column.${heading}`)}</th>)}
        </tr></thead><tbody>
          {tradeRows.map((row, index) => <Fragment key={`${row.assetType}:${row.symbol}`}>
            {index === sells.length && <tr className="subtotal" key="sells"><td /><td colSpan={2}>{t("rebalance.fidelity.totalSells")}</td><td className="t3-fidelity-amount">{money(sellTotal)}</td><td colSpan={3} /></tr>}
            <tr key={`${row.assetType}:${row.symbol}`}><td>{index + 1}</td><td><span className="t3-tag" data-tone={row.tradeValue > 0 ? "accent" : "neutral"}>{t(row.tradeValue > 0 ? "rebalance.buy" : "rebalance.sell")}</span></td>
              <td><AssetLabel asset={row} size={20} quiet /></td><td>{money(Math.abs(row.tradeValue))}</td><td>{unit(row.tradeQuantity)}</td><td>{money(row.price)}</td><td>{fixed(row.currentPercent)}% <span className="t3-fidelity-share-arrow">→</span> {fixed(row.targetPercent)}%</td></tr>
          </Fragment>)}
          {sells.length > 0 && buys.length === 0 && <tr className="subtotal"><td /><td colSpan={2}>{t("rebalance.fidelity.totalSells")}</td><td className="t3-fidelity-amount">{money(sellTotal)}</td><td colSpan={3} /></tr>}
          <tr className="subtotal"><td /><td colSpan={2}>{t("rebalance.fidelity.totalBuys")}</td><td className="t3-fidelity-amount">{money(buyTotal)}</td><td colSpan={3} /></tr>
          <tr className="net"><td /><td colSpan={2}><b>{t("rebalance.fidelity.net")}</b></td><td className="t3-fidelity-amount"><b className="t3-signed-unit">{`${netCash < 0 ? "−" : ""}${money(Math.abs(netCash))}`}</b></td><td colSpan={3}>{t(Math.abs(netCash) < .005 ? "rebalance.fidelity.netHint" : netCash < 0 ? "rebalance.fidelity.netHintSpent" : "rebalance.fidelity.netHintReserve")}</td></tr>
        </tbody></table> : <div className="t3-fidelity-empty"><b>{bad ? t("rebalance.fidelity.must100") : invalid ? props.validation || t(optionsInvalid ? "rebalance.validationOptions" : "rebalance.validationOther") : t("rebalance.fidelity.noTargets")}</b>
          <span>{bad ? t("rebalance.fidelity.pausedHint").replace("{total}", `${fixed(targetTotal)}%`) : invalid ? props.validation || t(optionsInvalid ? "rebalance.validationOptions" : "rebalance.validationOther") : t("rebalance.fidelity.emptyHint")}</span>
          <div>{bad ? <button className="accent" onClick={props.onNormalize}>{t("rebalance.normalize")}</button> : !invalid && <>
            <button className="primary" onClick={() => props.onPreset(false)}>{t("rebalance.fidelity.startCurrent")}</button>
            <button onClick={() => props.onPreset(true)}>{t("rebalance.fidelity.equalWeights")}</button>
          </>}</div></div>}
      </section>
      <section className="t3-fidelity-card t3-fidelity-result">
        <div className="t3-fidelity-card-head"><h2>{t("rebalance.fidelity.result")}</h2><span>{hasTrades ? t("rebalance.fidelity.ifMade") : bad ? t("rebalance.fidelity.paused") : t("rebalance.fidelity.waiting")}</span></div>
        {[
          { label: t("rebalance.sell"), value: hasTrades ? money(sellTotal) : "–", note: tradeCountNote(sells) },
          { label: t("rebalance.buy"), value: hasTrades ? money(buyTotal) : "–", note: tradeCountNote(buys) },
          { label: t("rebalance.fidelity.netCash"), value: hasTrades ? `${netCash < 0 ? "−" : ""}${money(Math.abs(netCash))}` : "–", note: t(stablecoinsAsCash ? "rebalance.fidelity.stableCash" : "rebalance.fidelity.stableAssets") },
          ...(hasTrades ? [{ label: t("rebalance.fidelity.outsideAfter"), value: t("rebalance.fidelity.ofCount").replace("{count}", String(afterOutside.length)).replace("{total}", String(allocation.length)), note: t(afterOutside.length < outside.length ? "rebalance.fidelity.downFrom" : afterOutside.length > outside.length ? "rebalance.fidelity.upFrom" : "rebalance.fidelity.unchangedFrom").replace("{count}", String(outside.length)).replace("{total}", String(allocation.length)).replace("{assets}", outside.map((row) => row.symbol).join(", ")) }] : []),
        ].map((item) => <div className="t3-fidelity-result-row" key={item.label}><small>{item.label}</small><strong>{item.value}</strong>{hasTrades && <small>{item.note}</small>}</div>)}
        <div className="t3-fidelity-result-export"><button disabled={!hasTrades} onClick={props.onExport}><FidelityIcon name="download" />{t("rebalance.export")}</button>
          <small>{hasTrades ? t(trades.length === 1 ? "rebalance.fidelity.exportHintOne" : "rebalance.fidelity.exportHint").replace("{count}", String(trades.length)) : t("rebalance.fidelity.exportDisabled")}</small></div>
      </section>
    </div>
    <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}><DialogContent className="t3-fidelity-advanced">
      <DialogTitle>{t("rebalance.fidelity.advanced")}</DialogTitle><DialogDescription>{t("rebalance.fidelity.advancedHint")}</DialogDescription>
      <div className="t3-fidelity-advanced-options">
        <label className="t3-fidelity-field"><b>{t("rebalance.fidelity.toleranceInput")}</b><input type="number" min="0" max="100" step="0.1" value={Number.isNaN(tolerance) ? "" : tolerance} onChange={(event) => props.onTolerance(event.target.value === "" ? NaN : Number(event.target.value))} /></label>
        <label className="t3-fidelity-field"><b>{t("rebalance.mode")}</b><select value={props.mode} onChange={(event) => props.onMode(event.target.value as "full" | "buys")}>
          <option value="full">{t("rebalance.modeFull")}</option><option value="buys">{t("rebalance.modeBuys")}</option></select></label>
        <label className="t3-fidelity-field"><b>{t("rebalance.injectedCash").replace("{currency}", currency.currency)}</b><input type="number" min="0" step="0.01" value={Number.isNaN(props.injectedCash) ? "" : props.injectedCash} onChange={(event) => props.onInjectedCash(event.target.value === "" ? NaN : Number(event.target.value))} /></label>
        <label className="t3-fidelity-field"><b>{t("rebalance.ignoreBelow").replace("{currency}", currency.currency)}</b><input type="number" min="0" step="0.01" value={Number.isNaN(ignoreBelowValue) ? "" : ignoreBelowValue} onChange={(event) => props.onIgnoreBelow(event.target.value === "" ? NaN : Number(event.target.value))} /></label>
      </div>
      <div className="t3-fidelity-advanced-rows">{targets.map((target, index) => <div key={index}>
        <select aria-label={t("rebalance.targetKind")} value={target.kind} onChange={(event) => props.onTarget(index, event.target.value === "cash"
          ? { kind: "cash", percent: target.percent } : event.target.value === "type"
          ? { kind: "type", assetType: "crypto", percent: target.percent }
          : { kind: "asset", assetType: "crypto", symbol: "", percent: target.percent })}>
          <option value="asset">{t("rebalance.targetAsset")}</option><option value="type">{t("rebalance.targetType")}</option><option value="cash">{t("rebalance.targetCashOnly")}</option>
        </select>
        {target.kind === "asset" ? <input aria-label={t("rebalance.symbol")} value={target.symbol} onChange={(event) => props.onTarget(index, { ...target, symbol: event.target.value.toUpperCase() })} />
          : target.kind === "type" ? <select aria-label={t("rebalance.targetType")} value={target.assetType} onChange={(event) => props.onTarget(index, { ...target, assetType: event.target.value as AssetType })}><option value="crypto">{t("rebalance.crypto")}</option><option value="stock">{t("rebalance.stock")}</option></select> : <span>{t("rebalance.targetCashOnly")}</span>}
        <input aria-label={t("rebalance.percentFor").replace("{asset}", target.kind === "asset" ? target.symbol : target.kind)} type="number" value={Number.isNaN(target.percent) ? "" : target.percent} onChange={(event) => props.onTarget(index, { ...target, percent: event.target.value === "" ? NaN : Number(event.target.value) })} />
        <button onClick={() => props.onRemoveTarget(index)}>{t("common.delete")}</button>
      </div>)}</div>
      <div className="t3-fidelity-advanced-actions"><Button variant="outline" onClick={() => props.onAddTarget()}>{t("rebalance.addTarget")}</Button><Button disabled={!complete || !!props.validation || optionsInvalid} onClick={props.onSave}>{t("rebalance.saveTargets")}</Button>
        {props.saved && <Button variant="outline" onClick={() => setConfirmDelete(true)}>{t("rebalance.deleteTargets")}</Button>}</div>
      {props.status && <p role="status">{props.status}</p>}
    </DialogContent></Dialog>
    <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}><DialogContent><DialogTitle>{t("rebalance.confirmDelete")}</DialogTitle>
      <DialogDescription>{t("rebalance.fidelity.deleteDescription")}</DialogDescription><div className="t3-fidelity-advanced-actions"><Button variant="outline" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button><Button onClick={() => { props.onDelete(); setConfirmDelete(false); }}>{t("common.delete")}</Button></div>
    </DialogContent></Dialog>
  </div>;
}
