import AssetLabel from "@/components/common/asset-label";
import { SignedInlineText } from "@/components/common/signed-inline-text";
import { useRef, useState } from "react";
import type { RebalanceHolding, RebalanceResult, RebalanceTarget } from "@/middlelayers/rebalance";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { useTranslation } from "@/mobile/i18n";
import PlanIcon from "@/mobile/components/plan-icon";
import { planAssetName } from "@/mobile/components/plan-asset-name";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/mobile/components/ui/alert-dialog";
import "./plan-fidelity.css";
import { useChartHitArea } from "@/components/chart-tooltip";

type Draft = RebalanceTarget & { id: number };
type Props = {
  currency: CurrencyRateDetail;
  holdings: RebalanceHolding[];
  targets: Draft[];
  result?: RebalanceResult;
  tolerance: number;
  minimumTradeValue: number;
  ignoreBelowValue: number;
  stablecoinsAsCash: boolean;
  mode: "full" | "buys";
  injectedCash: number;
  loading: boolean;
  loadError: boolean;
  profileLoadError: boolean;
  partialSnapshot: boolean;
  status: string;
  saved: boolean;
  savedUnchanged: boolean;
  canSave: boolean;
  onSave: () => void;
  onDelete: () => void;
  onAdvanced: () => void;
  onTarget: (holding: RebalanceHolding, percent: number | null) => void;
  onPreset: (equal: boolean) => void;
  onNormalize: () => void;
  onTolerance: (value: number) => void;
  onMinimum: (value: number) => void;
  onIgnore: (value: number) => void;
  onStablecoins: (value: boolean) => void;
  onExport: () => void;
};

const nf = (digits: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const inputNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const money = (value: number, symbol: string) => `${symbol}${nf(2).format(Math.abs(value))}`;
const pct = (value: number) => `${nf(1).format(value)}%`;
const kpi = (label: string, value: string, note: string, tone = "") =>
  <div className="pf-kpi"><span>{label}</span><strong className={tone}><SignedInlineText text={value} /></strong><small><SignedInlineText text={note} /></small></div>;

export default function RebalanceFidelity({
  currency, holdings, targets, result, tolerance, minimumTradeValue, ignoreBelowValue,
  mode, injectedCash,
  stablecoinsAsCash, loading, loadError, profileLoadError, partialSnapshot, status,
  saved, savedUnchanged, canSave, onSave, onDelete, onAdvanced,
  onTarget, onPreset, onNormalize, onTolerance, onMinimum, onIgnore, onStablecoins, onExport,
}: Props) {
  const { t } = useTranslation();
  const chart = useChartHitArea();
  const pts = (value: number) => t("fidelity.rebalance.points").replace("{value}",
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${nf(1).format(Math.abs(value))}`);
  const absPts = (value: number) => t("fidelity.rebalance.points").replace("{value}", nf(1).format(Math.abs(value)));
  const [editingMinimum, setEditingMinimum] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ key: string; text: string; holding: RebalanceHolding } | null>(null);
  const [editingIgnore, setEditingIgnore] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const lastIgnoreValue = useRef(ignoreBelowValue || 5000);
  if (ignoreBelowValue > 0) lastIgnoreValue.current = ignoreBelowValue;
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const totalTarget = targets.reduce((sum, target) => sum + (Number.isFinite(target.percent) ? target.percent : 0), 0);
  const allUnset = targets.length === 0;
  const valid = !allUnset && Math.abs(totalTarget - 100) < 0.000001;
  const assetRows = holdings.filter((holding) => holding.value > 0 ||
    targets.some((target) => target.kind === "asset" && target.assetType === holding.assetType && target.symbol === holding.symbol))
    .sort((a, b) => b.value - a.value);
  for (const target of targets) {
    if (target.kind !== "asset" || assetRows.some((holding) => holding.assetType === target.assetType && holding.symbol === target.symbol)) continue;
    assetRows.push({ assetType: target.assetType, symbol: target.symbol, amount: 0, value: 0, price: 0 });
  }
  if (editingTarget && !assetRows.some((holding) => holding.assetType === editingTarget.holding.assetType &&
    holding.symbol === editingTarget.holding.symbol)) assetRows.push(editingTarget.holding);
  const rows = assetRows.map((holding) => {
    const target = targets.find((item) => item.kind === "asset" && item.symbol === holding.symbol && item.assetType === holding.assetType);
    const current = totalValue > 0 ? holding.value / totalValue * 100 : 0;
    return { holding, current, target, drift: current - (target?.percent ?? 0) };
  });
  const breached = rows.filter((row) => row.target && Math.abs(row.drift) > tolerance);
  const largest = [...rows].filter((row) => row.target)
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))[0];
  const trades = result?.rows.filter((row) => row.kind === "asset" && row.tradeValue !== 0) ?? [];
  const sells = trades.filter((row) => row.tradeValue < 0).sort((a, b) => a.tradeValue - b.tradeValue);
  const buys = trades.filter((row) => row.tradeValue > 0).sort((a, b) => b.tradeValue - a.tradeValue);
  const sellTotal = sells.reduce((sum, row) => sum - row.tradeValue, 0);
  const buyTotal = buys.reduce((sum, row) => sum + row.tradeValue, 0);
  const netCashChange = sellTotal - buyTotal;
  const hasPlan = !allUnset && valid && !!result;
  const outsideAfter = result?.rows.filter((row) => row.kind === "asset" && result.projectedTotal > 0 &&
    Math.abs((row.value + row.tradeValue) / result.projectedTotal * 100 - row.targetPercent) > tolerance).length ?? 0;
  const symbols = (items: typeof sells) => items.map((row) => row.symbol).join(", ");
  const applyCash = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingMinimum(event.currentTarget.value);
    const raw = event.currentTarget.value.replaceAll(",", "");
    if (raw && !/^\d*\.?\d*$/.test(raw)) return;
    onMinimum(raw ? Number(raw) : 0);
  };
  const tradeRow = (row: typeof sells[number], index: number) =>
    <div className="pf-trade" key={`${row.assetType}:${row.symbol}`}>
      <span className="pf-step">{index}</span>
      <span className="t3-tag" data-tone={row.tradeValue > 0 ? "accent" : "neutral"}>{t(row.tradeValue > 0 ? "rebalance.buy" : "rebalance.sell")}</span>
      <b><AssetLabel asset={row} size={20} quiet /></b>
      <strong aria-label={`${row.tradeValue > 0 ? "+" : "−"}${money(row.tradeValue, currency.symbol)}`}>
        {money(row.tradeValue, currency.symbol)}</strong>
      <small>{t("fidelity.rebalance.tradeDetail")
        .replace("{quantity}", new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(Math.abs(row.tradeQuantity ?? 0)))
        .replace("{asset}", row.symbol).replace("{price}", money(row.price, currency.symbol))
        .replace("{current}", pct(row.currentPercent)).replace("{target}", pct(row.targetPercent))}</small>
    </div>;

  return <div className="pf-page pf-rebalance" data-testid="rebalance-phone">
    <header className="pf-head">
      <h1>{t("rebalance.title")}</h1>
      <p>{allUnset
        ? t("fidelity.rebalance.emptySubtitle")
        : !valid ? t("fidelity.rebalance.invalidSubtitle").replace("{total}", pct(totalTarget))
          : t("fidelity.rebalance.subtitle").replace("{count}", String(breached.length))
            .replace("{assets}", String(rows.length)).replace("{tolerance}", nf(1).format(tolerance))
            .replace("{value}", money(totalValue, currency.symbol))}</p>
    </header>
    {loading && <div role="status">{t("rebalance.loading")}</div>}
    {loadError && <p role="alert">{t("rebalance.loadError")}</p>}
    {profileLoadError && <p role="alert">{t("rebalance.profileLoadError")}</p>}
    {partialSnapshot && <p role="status">{t("rebalance.partialPause")}</p>}
    <section className="pf-card pf-summary" data-testid="rebalance-summary">
      {kpi(t("fidelity.rebalance.portfolio"), money(totalValue, currency.symbol), t("fidelity.rebalance.allSources"))}
      {kpi(allUnset ? t("fidelity.rebalance.targets") : t("fidelity.rebalance.targetsTotal"),
        allUnset ? t("fidelity.rebalance.notSet") : pct(totalTarget),
        allUnset ? t("fidelity.rebalance.assetsCount").replace("{count}", String(rows.length))
          : valid ? t("fidelity.rebalance.targetsValid").replace("{set}", String(rows.filter((row) => row.target).length))
            .replace("{assets}", String(rows.length))
            : t("fidelity.rebalance.from100").replace("{difference}", pts(totalTarget - 100)),
        allUnset ? "pf-zero" : valid ? "pf-positive" : "pf-negative")}
      {kpi(t("fidelity.rebalance.largestDrift"), largest ? `${largest.holding.symbol} ${pts(largest.drift)}` : "–",
        largest ? t("fidelity.rebalance.nowTarget").replace("{current}", pct(largest.current))
          .replace("{target}", pct(largest.target!.percent)) : t("fidelity.rebalance.needsTargets"),
        largest ? "pf-warning" : "pf-zero")}
      {kpi(t("fidelity.rebalance.outside"), allUnset ? "–" : t("fidelity.rebalance.outsideCount")
        .replace("{count}", String(breached.length)).replace("{assets}", String(rows.length)),
        t("fidelity.rebalance.toleranceValue").replace("{value}", nf(1).format(tolerance)), allUnset ? "pf-zero" : "")}
      {kpi(t("rebalance.suggestions"), hasPlan ? String(trades.length) : "–",
        allUnset ? t("fidelity.rebalance.needsTargets") : hasPlan
          ? t("fidelity.rebalance.sellMinimum").replace("{sell}", money(sellTotal, currency.symbol))
            .replace("{minimum}", money(minimumTradeValue, currency.symbol))
          : t("fidelity.rebalance.pausedUntil"), hasPlan ? "" : "pf-zero")}
    </section>
    <section className="pf-card pf-allocation" data-chart-group="">
      <div className="pf-card-head"><h2>{t("fidelity.rebalance.allocation")}</h2><small>{t(allUnset ? "fidelity.rebalance.barScale" : "fidelity.rebalance.tickScale")}</small></div>
      <div className="pf-alloc-list">{rows.map(({ holding, current, target, drift }, index) => {
        const detail = <div><strong>{holding.symbol}</strong><div>{t("rebalance.current")} {current.toFixed(2)}%</div>
          <div>{t("rebalance.target")} {target ? `${target.percent.toFixed(2)}%` : "–"}</div>
          <div>{t("fidelity.rebalance.largestDrift")} {target
            ? t("fidelity.rebalance.points").replace("{value}",
              `${drift > 0 ? "+" : drift < 0 ? "−" : ""}${Math.abs(drift).toFixed(2)}`) : "–"}</div></div>;
        return <div className="pf-alloc-row" key={`${holding.assetType}:${holding.symbol}`}>
          <div className="pf-asset"><AssetLabel asset={holding} size={20} quiet secondary={planAssetName(holding)} /></div>
          <span className="pf-current">{pct(current)}</span>
          <label className="pf-target">
            <span className="sr-only">{t("rebalance.percentFor").replace("{asset}", holding.symbol)}</span>
            {!target && editingTarget?.key !== `${holding.assetType}:${holding.symbol}` &&
              <span className="pf-set-face" aria-hidden="true"><PlanIcon name="plus" />{t("fidelity.rebalance.setWord")}</span>}
            <input aria-label={t("rebalance.percentFor").replace("{asset}", holding.symbol)}
              type="number" min="0" max="100" step="0.1"
              value={editingTarget?.key === `${holding.assetType}:${holding.symbol}` ? editingTarget.text : target ? target.percent.toFixed(1) : ""}
              onFocus={(event) => setEditingTarget({ key: `${holding.assetType}:${holding.symbol}`, text: event.currentTarget.value, holding })}
              onBlur={() => setEditingTarget(null)}
              onChange={(event) => {
                const text = event.currentTarget.value;
                setEditingTarget({ key: `${holding.assetType}:${holding.symbol}`, text, holding });
                onTarget(holding, text === "" ? null : Number(text));
              }} />
            {target && <span>%</span>}
          </label>
          <div className="pf-alloc-bar" role="button" {...chart.markProps(index,
            t("fidelity.rebalance.barLabel").replace("{asset}", holding.symbol)
              .replace("{current}", `${current.toFixed(2)}%`)
              .replace("{target}", target ? `${target.percent.toFixed(2)}%` : t("fidelity.rebalance.notSetLower")), detail)}>
            <i style={{ width: `${Math.min(100, current / 40 * 100)}%` }} />
            {target && <u style={{ left: `${Math.min(100, target.percent / 40 * 100)}%` }} />}
          </div>
          <span className={`pf-drift ${target && Math.abs(drift) > tolerance ? "pf-warning" : ""}`}>{target ? pts(drift) : "–"}</span>
        </div>; })}</div>
      {chart.tooltip}
      <div className={`pf-alloc-total ${!valid && !allUnset ? "pf-bad" : ""}`}>
        <b>{t("fidelity.rebalance.total")}</b><span>{pct(rows.reduce((sum, row) => sum + row.current, 0))}</span>
        <strong className={allUnset ? "pf-zero" : valid ? "pf-positive" : "pf-negative"}>{pct(totalTarget)}</strong>
        <em className="t3-tag" data-tone={allUnset ? "neutral" : valid ? "positive" : "negative"}>
          {allUnset ? t("fidelity.rebalance.needs100") : valid ? t("fidelity.rebalance.sums100")
            : t("fidelity.rebalance.over").replace("{difference}", absPts(totalTarget - 100))}
        </em>
      </div>
      {!valid && !allUnset && <div className="pf-banner pf-error" role="alert">
        <PlanIcon name="alert" /><div><b>{t("fidelity.rebalance.invalidBanner").replace("{total}", pct(totalTarget))}</b>
          <span>{t("fidelity.rebalance.invalidHelp").replace("{asset}", largest?.holding.symbol ?? "").replace("{difference}", absPts(totalTarget - 100))}</span></div>
      </div>}
    </section>
    <section className="pf-card pf-rules">
      <div className="pf-card-head"><h2 aria-label={t("fidelity.rebalance.rules")}><button className="pf-heading-action"
        aria-label={t("fidelity.rebalance.actions")} aria-expanded={actionsOpen}
        aria-controls="pf-profile-actions" onClick={() => setActionsOpen(!actionsOpen)}>
        {t("fidelity.rebalance.rules")}</button></h2><small>{t(
        profileLoadError ? "fidelity.rebalance.savedUnknown"
          : savedUnchanged ? "fidelity.rebalance.savedHere"
            : targets.length ? "fidelity.rebalance.unsaved" : "fidelity.rebalance.notSaved"
      )}</small></div>
      <div className="pf-rule-fields">
        <div className="pf-field"><b>{t("fidelity.rebalance.presets")}</b><div className="pf-preset-row">
          <button onClick={() => onPreset(true)} disabled={!rows.length}>{t("fidelity.rebalance.equalWeights")}</button>
          <button onClick={() => onPreset(false)} disabled={!rows.length}>{t("fidelity.rebalance.currentAllocation")}</button>
          <button className={!valid && !allUnset ? "pf-accent" : ""} onClick={onNormalize} disabled={allUnset}>{t("fidelity.rebalance.normalize")}</button>
        </div><small>{t("fidelity.rebalance.presetsHelp").replace("{equal}", nf(1).format(rows.length ? 100 / rows.length : 0))}</small></div>
        <div className="pf-field"><b>{t("fidelity.rebalance.tolerance")}</b><div className="pf-segment">
          {[0.5, 1, 2, 5, ...(![0.5, 1, 2, 5].includes(tolerance) ? [tolerance] : [])]
            .sort((a, b) => a - b).map((value) => <button key={value} className={tolerance === value ? "active" : ""}
            aria-pressed={tolerance === value} onClick={() => onTolerance(value)}>{t("fidelity.rebalance.points")
              .replace("{value}", nf(1).format(value))}</button>)}
        </div><small>{t("fidelity.rebalance.toleranceHelp")}</small></div>
        <label className="pf-field"><b>{t("fidelity.rebalance.minimumTrade")}</b><span className="pf-money-input">
          {currency.symbol}<input type="text" inputMode="decimal" value={editingMinimum ?? inputNumber.format(minimumTradeValue)}
            onFocus={() => setEditingMinimum(String(minimumTradeValue))} onBlur={() => setEditingMinimum(null)}
            onChange={applyCash} /></span>
          <small>{t("fidelity.rebalance.minimumHelp")}</small></label>
        <div className="pf-ignore-rule"><label className="pf-switch-row"><span><b>{t("fidelity.rebalance.ignoreSmall")}</b>
          <small>{t("fidelity.rebalance.ignoreHelp").replace("{amount}", `${currency.symbol}${nf(0).format(ignoreBelowValue || 5000)}`)}</small></span>
          <input type="checkbox" role="switch" checked={ignoreBelowValue > 0}
            onChange={(event) => onIgnore(event.currentTarget.checked ? lastIgnoreValue.current : 0)} /></label>
          {(ignoreBelowValue > 0 || editingIgnore !== null) && <label className="pf-ignore-limit">
            {t("fidelity.rebalance.ignoreLimit")}
            <span className="pf-money-input">{currency.symbol}<input aria-label={t("fidelity.rebalance.ignoreLimit")}
              type="number" min="0" step="1" value={editingIgnore ?? String(ignoreBelowValue)}
              onFocus={(event) => setEditingIgnore(event.currentTarget.value)}
              onBlur={() => setEditingIgnore(null)}
              onChange={(event) => {
                setEditingIgnore(event.currentTarget.value);
                onIgnore(Number(event.currentTarget.value));
              }} /></span></label>}</div>
        <label className="pf-switch-row"><span><b>{t("rebalance.stablecoinsAsCash")}</b>
          <small>{t("fidelity.rebalance.stableHelp")}</small></span>
          <input type="checkbox" role="switch" checked={stablecoinsAsCash} onChange={(event) => onStablecoins(event.currentTarget.checked)} /></label>
      </div>
      <div className="pf-foot"><PlanIcon name="lock" />{t("fidelity.rebalance.sync")}</div>
      {targets.some((target) => target.kind !== "asset") && <p className="pf-extra-targets">
        {t("fidelity.rebalance.otherTargets").replace("{targets}", targets.filter((target) => target.kind !== "asset")
          .map((target) => `${target.kind === "type" ? t(`rebalance.${target.assetType}`) : t("rebalance.targetCash")} ${pct(target.percent)}`).join(", "))}
      </p>}
      {(mode === "buys" || injectedCash > 0) && <p className="pf-extra-targets">
        {t(mode === "buys" ? injectedCash > 0
          ? "fidelity.rebalance.buyOnlyCashAdded" : "fidelity.rebalance.buyOnly"
          : "fidelity.rebalance.cashAdded").replace("{cash}", money(injectedCash, currency.symbol))}
      </p>}
      {actionsOpen && <div className="pf-profile-actions" id="pf-profile-actions">
        <button className="pf-primary" disabled={!canSave} onClick={() => { setActionsOpen(false); onSave(); }}>{t("rebalance.saveTargets")}</button>
        {saved && <AlertDialog>
          <AlertDialogTrigger asChild><button>{t("rebalance.deleteTargets")}</button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{t("rebalance.deleteTargets")}</AlertDialogTitle>
              <AlertDialogDescription>{t("rebalance.confirmDelete")}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setActionsOpen(false); onDelete(); }}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>}
        <button onClick={() => { setActionsOpen(false); onAdvanced(); }}>{t("fidelity.rebalance.advanced")}</button>
      </div>}
      {status && <p role="status">{status}</p>}
    </section>
    <section className="pf-card pf-trades">
      <div className="pf-card-head"><h2>{t("rebalance.suggestions")}</h2><small>{allUnset ? t("fidelity.rebalance.nothing") : hasPlan
        ? t("fidelity.rebalance.tradeHelp").replace("{minimum}", money(minimumTradeValue, currency.symbol))
        : t("fidelity.rebalance.paused")}</small></div>
      {hasPlan ? <div className="pf-trade-list">
        {sells.map((row, i) => tradeRow(row, i + 1))}
        <div className="pf-trade-sub"><span>{t("fidelity.rebalance.totalSells")}</span>{money(sellTotal, currency.symbol)}</div>
        {buys.map((row, i) => tradeRow(row, sells.length + i + 1))}
        <div className="pf-trade-sub"><span>{t("fidelity.rebalance.totalBuys")}</span>{money(buyTotal, currency.symbol)}</div>
        <div className="pf-trade-sub pf-trade-net"><b>{t("fidelity.rebalance.net")}</b><strong className="t3-signed-unit">{`${netCashChange < 0 ? "−" : netCashChange > 0 ? "+" : ""}${money(netCashChange, currency.symbol)}`}</strong></div>
      </div> : <div className="pf-empty">
        <b>{allUnset ? t("fidelity.rebalance.noTargetsYet") : t("fidelity.rebalance.must100")}</b>
        <span>{allUnset ? t("fidelity.rebalance.emptyTradeHelp") :
          t("fidelity.rebalance.invalidTradeHelp").replace("{total}", pct(totalTarget))}</span>
        {allUnset ? <div className="pf-empty-actions">
          <button className="pf-primary" onClick={() => onPreset(false)}>{t("fidelity.rebalance.startCurrent")}</button>
          <button onClick={() => onPreset(true)}>{t("fidelity.rebalance.equalWeights")}</button>
        </div> : <button className="pf-accent" onClick={onNormalize}>{t("fidelity.rebalance.normalize")}</button>}
      </div>}
    </section>
    <section className="pf-card pf-result">
      <div className="pf-card-head"><h2>{t("fidelity.rebalance.result")}</h2><small>{allUnset ? t("fidelity.rebalance.waiting") : hasPlan
        ? t("fidelity.rebalance.ifMade") : t("fidelity.rebalance.paused")}</small></div>
      {[[t("rebalance.sell"), sellTotal, sells], [t("rebalance.buy"), buyTotal, buys], [t("fidelity.rebalance.netCash"), netCashChange, [] as typeof sells]].map(([label, value, items], index) =>
        <div className="pf-result-row" key={String(label)}><span>{label as string}</span><strong>{hasPlan
          ? `${index === 2 && (value as number) !== 0 ? (value as number) < 0 ? "−" : "+" : ""}${money(value as number, currency.symbol)}` : "–"}</strong>
          {hasPlan && (items as typeof sells).length > 0 && <small>{t((items as typeof sells).length === 1
            ? "fidelity.rebalance.oneTrade" : "fidelity.rebalance.tradeCount")
            .replace("{count}", String((items as typeof sells).length)).replace("{assets}", symbols(items as typeof sells))}</small>}
          {hasPlan && index === 2 && <small>{t(stablecoinsAsCash
            ? "fidelity.rebalance.stableCash" : "fidelity.rebalance.stableAssets")}</small>}</div>)}
      {hasPlan && <div className="pf-result-row"><span>{t("fidelity.rebalance.outsideAfter")}</span>
        <strong>{t("fidelity.rebalance.outsideCount").replace("{count}", String(outsideAfter))
          .replace("{assets}", String(rows.length))}</strong>
        <small>{t("fidelity.rebalance.downFrom").replace("{count}", String(breached.length))
          .replace("{assets}", String(rows.length)).replace("{symbols}", breached.map(({ holding }) => holding.symbol).join(", "))}</small></div>}
      <button className="pf-export" disabled={!hasPlan || partialSnapshot} onClick={onExport}><PlanIcon name="download" />{t("rebalance.export")}</button>
      <small className="pf-export-note">{hasPlan ? t("fidelity.rebalance.exportRows")
        .replace("{count}", String(result?.rows.length ?? 0)) : t("fidelity.rebalance.exportWait")}</small>
    </section>
  </div>;
}
