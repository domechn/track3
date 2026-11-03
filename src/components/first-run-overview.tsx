import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChartIcon, ClockIcon, InfoCircledIcon, Link2Icon, ReloadIcon, UploadIcon,
} from "@radix-ui/react-icons";
import { getConfiguration } from "@/middlelayers/configuration";
import { overviewRefreshRequestedEvent } from "@/components/source-status-event";
import { useTranslation } from "@/i18n";
import "./first-run-overview.css";

type SourceChoice = "exchange" | "wallet" | "broker";

export default function FirstRunOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<SourceChoice>("exchange");
  const [configured, setConfigured] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getConfiguration().then((config) => {
      if (!active) return;
      const walletNames = (["btc", "erc20", "sol", "doge", "trc20", "ton", "sui"] as const)
        .flatMap((key) => config?.[key]?.addresses?.map((address) =>
          typeof address === "string" ? address : address.alias || address.address) ?? []);
      setConfigured([
        ...(config?.exchanges ?? []).map((exchange) => exchange.alias || exchange.name),
        ...walletNames,
        ...(config?.stockConfig?.brokers ?? []).map((broker) => broker.alias || broker.name),
      ]);
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { active = false; };
  }, []);

  const one = configured.length > 0;
  const add = () => navigate("/settings/configuration?section=sources");
  const refresh = () => window.dispatchEvent(new Event(overviewRefreshRequestedEvent));
  const sourceTypes: Array<{ id: SourceChoice; title: string; examples: string; method: string; icon: ReactNode }> = [
    { id: "exchange", title: t("firstrun.fidelity.exchange"), examples: t("firstrun.fidelity.exchangeExamples"),
      method: t("firstrun.fidelity.exchangeMethod"), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M6 15h5" /></svg> },
    { id: "wallet", title: t("firstrun.fidelity.wallet"), examples: t("firstrun.fidelity.walletExamples"),
      method: t("firstrun.fidelity.walletMethod"), icon: <Link2Icon aria-hidden="true" /> },
    { id: "broker", title: t("firstrun.fidelity.broker"), examples: t("firstrun.fidelity.brokerExamples"),
      method: t("firstrun.fidelity.brokerMethod"), icon: <BarChartIcon aria-hidden="true" /> },
  ];

  return <div className="t3-fr" data-mode={one ? "one" : "empty"} aria-busy={!loaded}>
    <header className="t3-fr-heading">
      <div><h1>{t("overview.h1")}</h1><p>{one
        ? t("firstrun.fidelity.oneSubtitle").replace("{source}", configured[0])
        : t("firstrun.fidelity.emptySubtitle")}</p></div>
      <div className="t3-fr-heading-actions">
        {one && <div className="t3-fr-ranges" role="group" aria-label={t("overview.fidelity.period")}>
          {["1D", "7D", "30D", "90D", "1Y", "All"].map((range) => <button type="button"
            key={range} disabled aria-pressed={range === "30D"}>{range}</button>)}
        </div>}
        <button type="button" className="t3-fr-refresh" disabled={!one} onClick={refresh}>
          <ReloadIcon aria-hidden="true" />{t(one ? "firstrun.fidelity.refreshNow" : "common.refresh")}
        </button>
      </div>
    </header>
    {!one ? <div className="t3-fr-grid">
      <section className="t3-fr-card t3-fr-first">
        <h2>{t("firstrun.fidelity.addFirst")}</h2>
        <p>{t("firstrun.fidelity.addDescription")}</p>
        <div className="t3-fr-choices">
          {sourceTypes.map(({ id, title, examples, method, icon }) => <button key={id} type="button"
            aria-pressed={choice === id} className="t3-fr-choice" onClick={() => setChoice(id)}>
            {icon}<strong>{title}</strong><span>{examples}</span><small>{method}</small><i aria-hidden="true" />
          </button>)}
        </div>
        <div className="t3-fr-first-footer">
          <button type="button" className="t3-fr-primary" onClick={add}>
            {t(`firstrun.fidelity.add.${choice}`)}</button>
          <span>{t("firstrun.fidelity.twoMinutes")}</span>
        </div>
      </section>
      <section className="t3-fr-card t3-fr-backup">
        <h2>{t("firstrun.fidelity.haveBackup")}</h2>
        <p>{t("firstrun.fidelity.backupDescription")}</p>
        <button type="button" onClick={() => navigate("/settings/data")}>
          <strong>{t("firstrun.fidelity.localFile")}</strong><span>{t("firstrun.fidelity.jsonExport")}</span>
        </button>
        <button type="button" onClick={() => navigate("/settings/sync")}>
          <strong>{t("firstrun.fidelity.encryptedSync")}</strong><span>{t("firstrun.fidelity.s3Passphrase")}</span>
        </button>
        <button type="button" className="t3-fr-import" onClick={() => navigate("/settings/data")}>
          <UploadIcon aria-hidden="true" />{t("firstrun.fidelity.importBackup")}</button>
      </section>
      <section className="t3-fr-card t3-fr-empty-value">
        <div className="t3-fr-card-head"><h2>{t("firstrun.fidelity.portfolioValue")}</h2><span>USD</span></div>
        <div className="t3-fr-empty"><strong>{t("firstrun.fidelity.valueEmpty")}</strong>
          <span>{t("firstrun.fidelity.valueEmptyHint")}</span></div>
      </section>
      <section className="t3-fr-card t3-fr-empty-hold">
        <div className="t3-fr-card-head"><h2>{t("firstrun.fidelity.holdings")}</h2></div>
        <div className="t3-fr-empty"><strong>{t("firstrun.fidelity.noHoldings")}</strong>
          <span>{t("firstrun.fidelity.holdingsHint")}</span></div>
      </section>
    </div> : <>
      <div className="t3-fr-banner"><InfoCircledIcon aria-hidden="true" /><div>
        <strong>{t("firstrun.fidelity.notRefreshed").replace("{source}", configured[0])}</strong>
        <span>{t("firstrun.fidelity.oneBanner")}</span></div></div>
      <div className="t3-fr-grid t3-fr-one-grid">
        <section className="t3-fr-card t3-fr-one-value">
          <div className="t3-fr-card-head"><h2>{t("firstrun.fidelity.portfolioValue")}</h2><span>USD</span></div>
          <div className="t3-fr-kpis">
            {["total", "today", "seven", "thirty"].map((key) => <div key={key}>
              <span>{t(`firstrun.fidelity.kpi.${key}`)}</span><strong>—</strong>
              {key === "total" && <small>{t("firstrun.fidelity.neverRefreshed")}</small>}</div>)}
          </div>
          <div className="t3-fr-empty"><strong>{t("firstrun.fidelity.chartFirst")}</strong>
            <span>{t("firstrun.fidelity.chartSecond")}</span></div>
        </section>
        <section className="t3-fr-card t3-fr-one-sources">
          <div className="t3-fr-card-head"><h2>{t("firstrun.fidelity.sources")}</h2>
            <span>{t("firstrun.fidelity.sourceCount").replace("{count}", String(configured.length))}</span></div>
          {configured.map((source) => <div className="t3-fr-source" key={source}>
            <b>{source.toLowerCase() === "binance" ? "Bn" : source.slice(0, 2)}</b><div><strong>{source}</strong><span><ClockIcon aria-hidden="true" />
              {t("firstrun.fidelity.neverRefreshed")}</span></div><span>—</span></div>)}
          <div className="t3-fr-source-footer"><i />{t("firstrun.fidelity.zeroRefreshed")
            .replace("{count}", String(configured.length))}</div>
        </section>
        <section className="t3-fr-card t3-fr-one-hold">
          <div className="t3-fr-card-head"><h2>{t("firstrun.fidelity.holdings")}</h2><span>0 assets</span></div>
          <div className="t3-fr-empty"><strong>{t("firstrun.fidelity.noHoldings")}</strong>
            <span>{t("firstrun.fidelity.oneHoldingsHint").replace("{source}", configured[0])}</span></div>
        </section>
        <section className="t3-fr-card t3-fr-one-moved">
          <div className="t3-fr-card-head"><h2>{t("firstrun.fidelity.whatMoved")}</h2><span>7 days</span></div>
          <div className="t3-fr-empty"><strong>{t("firstrun.fidelity.noMoves")}</strong>
            <span>{t("firstrun.fidelity.noMovesHint")}</span></div>
        </section>
      </div>
    </>}
  </div>;
}
