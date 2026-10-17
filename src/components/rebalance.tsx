import { useEffect, useMemo, useRef, useState } from "react";
import { save as saveFile } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import {
  calculateRebalance,
  deleteRebalanceProfile,
  getRebalanceProfile,
  loadRebalanceHoldings,
  normalizeTargets,
  saveRebalanceProfile,
  suggestionsToCsv,
  validateProfile,
  type RebalanceHolding,
  type RebalanceOptions,
  type RebalanceResult,
  type RebalanceTarget,
} from "@/middlelayers/rebalance";
import type { AssetType } from "@/middlelayers/datafetch/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "./ui/alert-dialog";

type TargetDraft = RebalanceTarget & { id: number; previousAsset?: { assetType: AssetType; symbol: string } };

const numberOrZero = (raw: string) => raw === "" ? Number.NaN : Number(raw);

export default function Rebalance({ currency }: { currency: CurrencyRateDetail }) {
  const { t } = useTranslation();
  const labelFor = (target: RebalanceTarget) =>
    target.kind === "asset" ? target.symbol || t("rebalance.targetAsset") :
    target.kind === "type" ? t(`rebalance.${target.assetType}`) : t("rebalance.targetCash");
  const dataChangedVersion = useDataChangedVersion();
  const [holdings, setHoldings] = useState<RebalanceHolding[]>([]);
  const [stablecoinSymbols, setStablecoinSymbols] = useState<string[]>([]);
  const [targets, setTargets] = useState<TargetDraft[]>([]);
  const [tolerance, setTolerance] = useState(0);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"full" | "buys">("full");
  const [injectedCash, setInjectedCash] = useState(0);
  const [minimumTradeValue, setMinimumTradeValue] = useState(0);
  const [ignoreBelowValue, setIgnoreBelowValue] = useState(0);
  const profileLoaded = useRef(false);
  const nextTargetId = useRef(0);
  const withIds = (draft: RebalanceTarget[]): TargetDraft[] =>
    draft.map((target) => ({ ...target, id: nextTargetId.current++ }));

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      profileLoaded.current
        ? Promise.resolve({ profile: undefined, failed: false })
        : getRebalanceProfile().then(
          (profile) => ({ profile, failed: false }),
          () => ({ profile: undefined, failed: true }),
        ),
      loadRebalanceHoldings(currency),
    ])
      .then(([{ profile, failed }, latest]) => {
        if (!active) return;
        if (!profileLoaded.current) {
          setTargets(withIds(profile?.targets ?? []));
          setTolerance(profile?.tolerancePercent ?? 0);
          setSaved(!!profile || failed);
          setProfileLoadError(failed);
          profileLoaded.current = true;
        }
        setHoldings(latest.holdings);
        setStablecoinSymbols(latest.stablecoinSymbols);
        setLoadError(false);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [currency.currency, currency.rate, dataChangedVersion]);

  const validation = useMemo(() => {
    if (!targets.length) return "";
    try {
      validateProfile({ targets, tolerancePercent: tolerance });
      return "";
    } catch (error) {
      return error instanceof Error && error.message.includes("sum to 100")
        ? t("rebalance.validationSum") : t("rebalance.validationOther");
    }
  }, [targets, tolerance, t]);
  const optionsValid = [injectedCash, minimumTradeValue, ignoreBelowValue]
    .every((value) => Number.isFinite(value) && value >= 0);

  const result: RebalanceResult | undefined = useMemo(() => {
    if (!targets.length || validation || !optionsValid) return undefined;
    try {
      const options: RebalanceOptions = {
        mode, injectedCash, minimumTradeValue, ignoreBelowValue,
        tolerancePercent: tolerance, stablecoinSymbols,
      };
      return calculateRebalance(holdings, targets, options);
    } catch {
      return undefined;
    }
  }, [targets, validation, optionsValid, holdings, mode, injectedCash, minimumTradeValue, ignoreBelowValue, tolerance, stablecoinSymbols]);

  function updateTarget(index: number, next: RebalanceTarget & { previousAsset?: { assetType: AssetType; symbol: string } }) {
    setTargets((previous) => previous.map((target, i) => i === index ? { ...next, id: target.id } : target));
    setStatus("");
  }

  function applyPreset(equal: boolean) {
    const active = holdings.filter((holding) => holding.amount > 0 && holding.value > 0);
    if (!active.length) return;
    const draft: RebalanceTarget[] = active.map((holding) => ({
      kind: "asset",
      assetType: holding.assetType,
      symbol: holding.symbol,
      percent: equal ? 1 : holding.value,
    }));
    setTargets(withIds(normalizeTargets(draft)));
    setStatus("");
  }

  async function save() {
    if (validation || !targets.length) return;
    try {
      const cleanTargets: RebalanceTarget[] = targets.map((target) =>
        target.kind === "asset"
          ? { kind: "asset", assetType: target.assetType, symbol: target.symbol.trim().toUpperCase(), percent: target.percent }
          : target.kind === "type"
            ? { kind: "type", assetType: target.assetType, percent: target.percent }
            : { kind: "cash", percent: target.percent },
      );
      await saveRebalanceProfile({ targets: cleanTargets, tolerancePercent: tolerance });
      setTargets(cleanTargets.map((target, index) => ({ ...target, id: targets[index].id })));
      setSaved(true);
      setProfileLoadError(false);
      setStatus(t("rebalance.saved"));
    } catch {
      setStatus(t("rebalance.saveError"));
    }
  }

  async function removeSaved() {
    try {
      await deleteRebalanceProfile();
      setTargets([]);
      setTolerance(0);
      setSaved(false);
      setProfileLoadError(false);
      setStatus(t("rebalance.deleted"));
    } catch {
      setStatus(t("rebalance.saveError"));
    }
  }

  async function exportCsv() {
    if (!result) return;
    try {
      const filePath = await saveFile({
        defaultPath: "track3-rebalance.csv",
        filters: [{ name: "track3-rebalance", extensions: ["csv"] }],
      });
      if (filePath) await writeTextFile(filePath, suggestionsToCsv(result, currency.currency, t));
    } catch {
      setStatus(t("rebalance.exportError"));
    }
  }

  const total = targets.reduce((sum, target) => sum + target.percent, 0);
  const numberField = (
    id: string, label: string, value: number, setter: (next: number) => void,
  ) => (
    <label htmlFor={id} className="space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <Input id={id} className="h-8 text-xs tabular-nums" type="number" min="0" step="0.01"
        value={Number.isNaN(value) ? "" : value}
        onChange={(event) => setter(numberOrZero(event.target.value))} />
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("rebalance.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rebalance.description")}</p>
      </header>
      {loading && <p role="status">{t("common.loading")}</p>}
      {loadError && <p role="alert" className="text-sm text-destructive">{t("rebalance.loadError")}</p>}
      {profileLoadError && !loading && <p role="alert" className="text-sm text-destructive">{t("rebalance.profileLoadError")}</p>}
      {!loading && !loadError && (
        <>
          {!holdings.length && <p className="text-sm text-muted-foreground">{t("rebalance.noData")}</p>}
          <Card>
            <CardHeader className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{t("rebalance.targets")}</CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" disabled={!holdings.length} onClick={() => applyPreset(true)}>{t("rebalance.equalWeight")}</Button>
                  <Button size="sm" variant="outline" disabled={!holdings.length} onClick={() => applyPreset(false)}>{t("rebalance.currentHoldings")}</Button>
                  <Button size="sm" variant="outline" disabled={!targets.length} onClick={() => {
                    try {
                      setTargets((previous) => normalizeTargets(previous)
                        .map((target, index) => ({ ...previous[index], percent: target.percent })));
                    } catch { /* draft needs positive weights */ }
                  }}>{t("rebalance.normalize")}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {targets.map((target, index) => (
                <div key={target.id} className="grid grid-cols-[minmax(90px,1fr)_minmax(85px,1fr)_72px_32px] items-end gap-1.5 sm:grid-cols-[150px_minmax(120px,1fr)_110px_32px]">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>{t("rebalance.targetKind")}</span>
                    <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={target.kind} onChange={(event) => {
                        const percent = target.percent;
                        const previousAsset = target.kind === "asset"
                          ? { assetType: target.assetType, symbol: target.symbol } : target.previousAsset;
                        updateTarget(index, event.target.value === "cash"
                          ? { kind: "cash", percent, previousAsset }
                          : event.target.value === "type"
                            ? { kind: "type", assetType: target.kind === "cash" ? "crypto" : target.assetType, percent, previousAsset }
                            : { kind: "asset", assetType: previousAsset?.assetType ?? "crypto", symbol: previousAsset?.symbol ?? "", percent });
                      }}>
                      <option value="asset">{t("rebalance.targetAsset")}</option>
                      <option value="type">{t("rebalance.targetType")}</option>
                      <option value="cash">{t("rebalance.targetCash")}</option>
                    </select>
                  </label>
                  {target.kind === "cash" ? <span className="pb-2 text-xs">{t("rebalance.targetCash")}</span> :
                    target.kind === "type" ? (
                      <label className="space-y-1 text-xs text-muted-foreground">
                        <span>{t("rebalance.targetType")}</span>
                        <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={target.assetType}
                          onChange={(event) => updateTarget(index, { ...target, assetType: event.target.value as AssetType })}>
                          <option value="crypto">{t("rebalance.crypto")}</option>
                          <option value="stock">{t("rebalance.stock")}</option>
                        </select>
                      </label>
                    ) : (
                      <label className="space-y-1 text-xs text-muted-foreground">
                        <span>{t("rebalance.symbol")}</span>
                        <Input className="h-8 text-xs" value={target.symbol} placeholder={t("rebalance.symbolPlaceholder")}
                          onChange={(event) => updateTarget(index, { ...target, symbol: event.target.value.toUpperCase() })}
                          aria-label={t("rebalance.symbol")} />
                      </label>
                    )}
                  <label className="space-y-1 text-xs text-muted-foreground">
                    <span>{t("rebalance.percent")}</span>
                    <Input className="h-8 px-1.5 text-xs tabular-nums" type="number" min="0" max="100" step="0.01"
                      aria-label={t("rebalance.percentFor").replace("{asset}", labelFor(target))}
                      value={Number.isNaN(target.percent) ? "" : target.percent}
                      onChange={(event) => updateTarget(index, { ...target, percent: numberOrZero(event.target.value) })} />
                  </label>
                  <Button className="h-8 w-8 p-0" size="sm" variant="ghost"
                    aria-label={t("rebalance.remove").replace("{asset}", labelFor(target))}
                    onClick={() => setTargets((previous) => previous.filter((_, i) => i !== index))}>×</Button>
                </div>
              ))}
              <div className="flex flex-wrap items-end justify-between gap-2 border-t pt-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setTargets((previous) => [
                    ...previous, { id: nextTargetId.current++, kind: "asset", assetType: "crypto", symbol: "", percent: 0 },
                  ])}>{t("rebalance.addTarget")}</Button>
                  {numberField("rebalance-tolerance", t("rebalance.tolerance"), tolerance, setTolerance)}
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {t("rebalance.total").replace("{total}", total.toFixed(2))}
                </span>
              </div>
              {validation && <p role="alert" className="text-xs text-destructive">{validation}</p>}
              {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
              <div className="flex gap-2">
                <Button size="sm" disabled={!targets.length || !!validation} onClick={() => void save()}>{t("rebalance.saveTargets")}</Button>
                {saved && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">{t("rebalance.deleteTargets")}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("rebalance.deleteTargets")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("rebalance.confirmDelete")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeSaved()}>{t("common.delete")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="px-4 py-3"><CardTitle className="text-base">{t("rebalance.options")}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4 md:grid-cols-4">
              <label htmlFor="rebalance-mode" className="space-y-1 text-xs text-muted-foreground">
                <span>{t("rebalance.mode")}</span>
                <select id="rebalance-mode" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={mode} onChange={(event) => setMode(event.target.value as "full" | "buys")}>
                  <option value="full">{t("rebalance.modeFull")}</option>
                  <option value="buys">{t("rebalance.modeBuys")}</option>
                </select>
              </label>
              {numberField("rebalance-cash", t("rebalance.injectedCash").replace("{currency}", currency.currency), injectedCash, setInjectedCash)}
              {numberField("rebalance-minimum", t("rebalance.minimumTrade").replace("{currency}", currency.currency), minimumTradeValue, setMinimumTradeValue)}
              {numberField("rebalance-ignore", t("rebalance.ignoreBelow").replace("{currency}", currency.currency), ignoreBelowValue, setIgnoreBelowValue)}
            </CardContent>
          </Card>
          {!optionsValid && <p role="alert" className="text-xs text-destructive">{t("rebalance.validationOptions")}</p>}
          {!targets.length && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{t("rebalance.empty")}</p>}
          {result && (
            <>
              <Card>
                <CardHeader className="px-4 py-3"><CardTitle className="text-base">{t("rebalance.deviations")}</CardTitle></CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  {result.rows.filter((row) => row.kind === "asset").map((row) => (
                    <div key={`${row.assetType}:${row.symbol}`} role="img"
                      aria-label={t("rebalance.deviationAria")
                        .replace("{asset}", row.symbol)
                        .replace("{current}", row.currentPercent.toFixed(1))
                        .replace("{target}", row.targetPercent.toFixed(1))
                        .replace("{deviation}", row.deviationPercent.toFixed(1))}
                      className="grid grid-cols-[70px_minmax(0,1fr)_68px] items-center gap-2 text-xs tabular-nums">
                      <span className="truncate font-medium">{row.symbol}</span>
                      <div className="relative h-3 rounded bg-muted">
                        <span className="absolute bottom-0 left-1/2 top-0 w-px bg-foreground/50" />
                        <span className={`absolute bottom-0 top-0 rounded-sm ${row.deviationPercent >= 0 ? "left-1/2 bg-amber-500/80" : "right-1/2 bg-sky-500/80"}`}
                          style={{ width: `${Math.min(50, Math.abs(row.deviationPercent) / 2)}%` }} />
                      </div>
                      <span className="text-right">{row.deviationPercent >= 0 ? "+" : ""}{row.deviationPercent.toFixed(1)} {t("rebalance.percentagePoints")}</span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">{t("rebalance.groupRule")}</p>
                  {result.warnings.map((warning) => (
                    <p key={warning.kind === "empty-type" ? warning.assetType : warning.kind} className="text-xs text-amber-600">
                      {warning.kind === "empty-type"
                        ? t("rebalance.groupEmpty").replace("{group}", t(`rebalance.${warning.assetType}`))
                        : t("rebalance.missingPriceTarget")}
                    </p>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3">
                  <CardTitle className="text-base">{t("rebalance.suggestions")}</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => void exportCsv()}>{t("rebalance.export")}</Button>
                </CardHeader>
                <CardContent className="px-0 pb-3">
                  <div className="overflow-x-auto">
                    <table aria-label={t("rebalance.suggestions")} className="w-full min-w-[680px] text-xs tabular-nums">
                      <thead className="border-y bg-muted/40 text-muted-foreground">
                        <tr>
                          {[t("rebalance.symbol"), t("rebalance.current"), t("rebalance.target"), t("rebalance.deviation"),
                            t("rebalance.action"), `${t("rebalance.value")} (${currency.currency})`,
                            t("rebalance.quantity"), t("rebalance.note")].map((heading) =>
                            <th key={heading} scope="col" className="px-2 py-2 text-left font-medium">{heading}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row) => (
                          <tr key={`${row.assetType ?? "cash"}:${row.symbol}`} className="border-b last:border-0">
                            <th scope="row" className="px-2 py-2 text-left font-medium">{row.symbol}</th>
                            <td className="px-2 py-2">{row.currentPercent.toFixed(2)}%</td>
                            <td className="px-2 py-2">{row.targetPercent.toFixed(2)}%</td>
                            <td className="px-2 py-2">{row.deviationPercent >= 0 ? "+" : ""}{row.deviationPercent.toFixed(2)} {t("rebalance.percentagePoints")}</td>
                            <td className="px-2 py-2">{row.kind === "cash"
                              ? t("rebalance.cashReserveAmount").replace("{amount}", row.tradeValue.toFixed(2)).replace("{currency}", currency.currency) :
                              row.tradeValue > 0 ? t("rebalance.buy") : row.tradeValue < 0 ? t("rebalance.sell") : t("rebalance.noTrade")}</td>
                            <td className="px-2 py-2">{Math.abs(row.tradeValue).toFixed(2)}</td>
                            <td className="px-2 py-2">{row.tradeQuantity === null ? "—" : Math.abs(row.tradeQuantity).toFixed(8)}</td>
                            <td className="px-2 py-2 text-muted-foreground">{row.note === "missing-price" ? t("rebalance.missingPrice") :
                              row.note === "below-threshold" ? t("rebalance.belowThreshold") : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-4 pt-2 text-xs text-muted-foreground">{t("rebalance.rounding").replace("{currency}", currency.currency)}</p>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
