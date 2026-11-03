import { useTranslation } from "@/mobile/i18n";
import { ReloadIcon } from "@radix-ui/react-icons";
import "@/mobile/components/mobile/fidelity.css";

function Skeleton({ width, height = 14 }: { width: string; height?: number }) {
  return <span className="fd-loading-skeleton" style={{ width, height }} aria-hidden="true" />;
}

export default function LoadingOverviewFidelity() {
  const { t } = useTranslation();
  return <section className="fd-page fd-overview-loading-page">
    <header className="fd-loading-head">
      <h1>{t("nav.overview")}</h1>
      <Skeleton width="min(100%, 360px)" />
      <div><span className="fd-loading-stamp"><span aria-hidden="true">◌</span>{t("fidelity.loading.readingDevice")}</span>
        <button type="button" disabled><ReloadIcon aria-hidden="true" /> {t("common.refresh")}</button></div>
    </header>
    <main className="fd-overview-loading-grid" aria-busy="true" aria-label={t("fidelity.loading.overview")}>
      <section className="fd-card fd-loading-hero"><div className="fd-card-heading"><h3>{t("fidelity.firstRun.portfolioValue")}</h3></div>
        <div className="fd-loading-kpis">{[true, false, false, false].map((big, index) =>
          <div key={index}><Skeleton width="72px" height={12} /><Skeleton width={big ? "210px" : "72px"} height={big ? 34 : 22} /><Skeleton width={big ? "150px" : "88px"} height={12} /></div>)}</div>
        <div className="fd-loading-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70 L12 62 L24 66 L36 56 L48 60 L60 46 L72 50 L84 34 L100 20" /></svg></div>
      </section>
      <section className="fd-card fd-loading-sources"><div className="fd-card-heading"><h3>{t("overview.design.sources")}</h3></div>
        {Array.from({ length: 5 }, (_, index) => <div className="fd-loading-source" key={index}>
          <Skeleton width="28px" height={28} /><div><Skeleton width="120px" /><Skeleton width="84px" height={12} /></div>
          <div><Skeleton width="84px" /><Skeleton width="40px" height={12} /></div>
        </div>)}
      </section>
      <section className="fd-card fd-loading-holdings"><div className="fd-card-heading"><h3>{t("overview.design.holdings")}</h3></div>
        <div className="fd-loading-table"><div className="fd-loading-table-head"><span>{t("fidelity.loading.asset")}</span><span>{t("fidelity.loading.value")}</span><span>7D</span></div>
          {Array.from({ length: 8 }, (_, index) => <div key={index}><Skeleton width="60px" /><Skeleton width="84px" /><Skeleton width="48px" /></div>)}</div>
      </section>
      <section className="fd-card fd-loading-movers"><div className="fd-card-heading"><h3>{t("overview.design.whatMoved")}</h3><span>{t("fidelity.overview.sevenDays")}</span></div>
        {[72, 58, 46, 34, 26, 18, 12, 38].map((width, index) => <div className="fd-loading-mover" key={index}>
          <Skeleton width="32px" /><Skeleton width={`${width}%`} height={10} /><Skeleton width="56px" /></div>)}
      </section>
    </main>
  </section>;
}
