import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClockIcon, InfoCircledIcon, ReloadIcon, UploadIcon } from "@radix-ui/react-icons";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { useTranslation } from "@/mobile/i18n";
import SourceMark from "@/mobile/components/source-mark";
import "@/mobile/components/mobile/fidelity.css";

type Source = { sourceId: string; label: string; kind?: string; provider?: string };
type Kind = "exchange" | "wallet" | "broker";
const kinds: Kind[] = ["exchange", "wallet", "broker"];

function SourceIcon({ kind }: { kind: Kind }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "exchange" ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h5" /></> :
      kind === "wallet" ? <><path d="M10 8 8 6a4 4 0 0 0-6 6l3 3a4 4 0 0 0 6 0l2-2" /><path d="m14 16 2 2a4 4 0 0 0 6-6l-3-3a4 4 0 0 0-6 0l-2 2M9 15l6-6" /></> :
      <><path d="M4 20V10M9 20V4M14 20v-7M19 20V8" /></>}
  </svg>;
}

export default function FirstRunFidelity({ sources, currency, onRefresh }: {
  sources: Source[]; currency: CurrencyRateDetail; onRefresh?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>("exchange");
  const configured = sources.length > 0;
  const label = sources[0]?.label ?? "";
  return <section className={`fd-page fd-first-run${configured ? " one" : " empty"}`}>
    <header className="fd-first-run-head">
      <h1>{t("nav.overview")}</h1>
      <p>{configured ? sources.length === 1
        ? t("fidelity.firstRun.oneSummary").replace("{source}", label)
        : t("fidelity.firstRun.multipleSummary").replace("{count}", String(sources.length))
        : t("fidelity.firstRun.emptySummary")}</p>
      {configured && <><div className="fd-range" role="radiogroup" aria-label={t("overview.chartRange")}>
        {["1D", "7D", "30D", "90D", "1Y", "All"].map((range) => <button key={range} type="button" role="radio" aria-checked={range === "30D"} disabled>{range}</button>)}</div>
        <button type="button" className="fd-first-run-refresh" onClick={() => void onRefresh?.()}><ReloadIcon aria-hidden="true" />{t("fidelity.firstRun.refreshNow")}</button></>}
    </header>
    {configured ? <>
      <div className="fd-first-run-banner" role="status"><InfoCircledIcon aria-hidden="true" /><div><b>{sources.length === 1
        ? t("fidelity.firstRun.notRefreshed").replace("{source}", label)
        : t("fidelity.firstRun.multipleNotRefreshed").replace("{count}", String(sources.length))}</b>
        <p>{t("fidelity.firstRun.notRefreshedDetail")}</p></div></div>
      <div className="fd-first-run-grid">
        <section className="fd-card fd-first-run-hero"><div className="fd-card-heading"><h3>{t("fidelity.firstRun.portfolioValue")}</h3><span>{currency.currency}</span></div>
          <span className="fd-label">{t("overview.design.totalValue")}</span><strong className="fd-first-run-dash">—</strong><span className="fd-sub">{t("fidelity.firstRun.neverRefreshed")}</span>
          <div className="fd-first-run-kpis">{["fidelity.firstRun.today", "fidelity.overview.sevenDays", "fidelity.overview.thirtyDays"].map((key) =>
            <div key={key}><span className="fd-label">{t(key)}</span><b>—</b><small>&nbsp;</small></div>)}</div>
          <div className="fd-first-run-chart fd-empty"><b>{t("fidelity.firstRun.chartStart")}</b><span>{t("fidelity.firstRun.lineStart")}</span></div>
        </section>
        <section className="fd-card fd-first-run-sources"><div className="fd-card-heading"><h3>{t("overview.design.sources")}</h3><span>{sources.length === 1 ? t("fidelity.firstRun.sourceCount") : t("fidelity.firstRun.multipleSourceCount").replace("{count}", String(sources.length))}</span></div>
          {sources.map((source) => <div className="fd-first-run-source" key={source.sourceId}><SourceMark source={source} /><div><b>{source.label}</b><small><ClockIcon aria-hidden="true" />{t("fidelity.firstRun.neverRefreshed")}</small></div><strong>—</strong></div>)}
          <div className="fd-first-run-source-footer"><i />{t("fidelity.firstRun.zeroRefreshed")}</div>
        </section>
        <section className="fd-card fd-first-run-bottom"><div className="fd-card-heading"><h3>{t("overview.design.holdings")}</h3><span>{t("fidelity.firstRun.zeroAssets")}</span></div>
          <div className="fd-empty"><b>{t("fidelity.firstRun.noHoldings")}</b><span>{sources.length === 1
            ? t("fidelity.firstRun.holdingsAfter").replace("{source}", label)
            : t("fidelity.firstRun.holdingsAfterRefresh")}</span></div></section>
        <section className="fd-card fd-first-run-bottom"><div className="fd-card-heading"><h3>{t("overview.design.whatMoved")}</h3><span>{t("fidelity.overview.sevenDays")}</span></div>
          <div className="fd-empty"><b>{t("fidelity.firstRun.noComparison")}</b><span>{t("fidelity.firstRun.movesAfter")}</span></div></section>
      </div>
    </> : <div className="fd-first-run-grid">
      <section className="fd-card fd-first-run-choose"><h2>{t("fidelity.firstRun.addFirstSource")}</h2>
        <p>{t("fidelity.firstRun.description")}</p>
        <div className="fd-first-run-options" role="radiogroup" aria-label={t("fidelity.firstRun.addFirstSource")}>
          {kinds.map((option) => <button key={option} type="button" role="radio" aria-checked={kind === option} onClick={() => setKind(option)}>
            <SourceIcon kind={option} /><span><b>{t(`fidelity.firstRun.kind.${option}`)}</b><small>{t(`fidelity.firstRun.hint.${option}`)}</small></span><i /></button>)}</div>
        <button type="button" className="fd-first-run-primary" onClick={() => navigate("/settings/configuration")}>{t(`fidelity.firstRun.add.${kind}`)}</button>
        <small>{t("fidelity.firstRun.timeHint")}</small>
      </section>
      <section className="fd-card fd-first-run-backup"><h3>{t("fidelity.firstRun.haveBackup")}</h3><p>{t("fidelity.firstRun.backupDescription")}</p>
        <button type="button" onClick={() => navigate("/settings/data?section=backup")}><UploadIcon aria-hidden="true" />{t("fidelity.firstRun.importBackup")}</button>
      </section>
      <section className="fd-card fd-first-run-bottom"><div className="fd-card-heading"><h3>{t("fidelity.firstRun.portfolioValue")}</h3><span>{currency.currency}</span></div>
        <div className="fd-empty"><b>{t("fidelity.firstRun.totalAppears")}</b><span>{t("fidelity.firstRun.addRefresh")}</span></div></section>
      <section className="fd-card fd-first-run-bottom"><div className="fd-card-heading"><h3>{t("overview.design.holdings")}</h3></div>
        <div className="fd-empty"><b>{t("fidelity.firstRun.noHoldings")}</b><span>{t("fidelity.firstRun.holdingsFirst")}</span></div></section>
    </div>}
  </section>;
}
