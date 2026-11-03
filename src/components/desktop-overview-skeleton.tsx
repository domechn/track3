import { useTranslation } from "@/i18n";
import { UpdateIcon } from "@radix-ui/react-icons";

function Bar({ width, height = 14 }: { width: number | string; height?: number }) {
  return <span className="t3-desktop-skeleton-bar" style={{ width, height }} aria-hidden="true" />;
}

export default function DesktopOverviewSkeleton() {
  const { t } = useTranslation();
  return <div className="t3-desktop-overview-skeleton" role="status" aria-label="Loading overview" aria-busy="true">
    <header className="t3-desktop-skeleton-head">
      <div><h1>{t("overview.h1")}</h1><Bar width={360} /></div>
      <span className="t3-desktop-skeleton-reading"><span aria-hidden="true" />{t("loading.fidelity.reading")}</span>
      <button type="button" disabled><UpdateIcon aria-hidden="true" />{t("common.refresh")}</button>
    </header>
    <div className="t3-desktop-skeleton-grid">
      <section className="t3-desktop-skeleton-card t3-desktop-skeleton-wide t3-desktop-skeleton-upper">
        <h2>{t("firstrun.fidelity.portfolioValue")}</h2>
        <div className="t3-desktop-skeleton-kpis">
          {[0, 1, 2, 3].map((index) => <div key={index}>
            <Bar width={72} height={12} />
            <Bar width={index === 0 ? 210 : 72} height={index === 0 ? 34 : 22} />
            <Bar width={index === 0 ? 150 : 88} height={12} />
          </div>)}
        </div>
        <div className="t3-desktop-skeleton-chart" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => <i key={index} />)}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 70 L12 62 L24 66 L36 56 L48 60 L60 46 L72 50 L84 34 L100 20" /></svg>
        </div>
      </section>
      <section className="t3-desktop-skeleton-card t3-desktop-skeleton-side t3-desktop-skeleton-upper">
        <h2>{t("overview.design.sources")}</h2>
        <div className="t3-desktop-skeleton-source-list">{Array.from({ length: 5 }, (_, index) => <div key={index}>
          <Bar width={28} height={28} />
          <span><Bar width={120} /><Bar width={84} height={12} /></span>
          <span><Bar width={84} /><Bar width={40} height={12} /></span>
        </div>)}</div>
      </section>
      <section className="t3-desktop-skeleton-card t3-desktop-skeleton-wide t3-desktop-skeleton-lower">
        <h2>{t("overview.design.holdings")}</h2>
        <div className="t3-desktop-skeleton-table-head"><span>{t("overview.design.asset")}</span><span>{t("overview.design.price")}</span><span>{t("overview.design.value")}</span><span>{t("overview.fidelity.sevenDays")}</span></div>
        {Array.from({ length: 8 }, (_, index) => <div className="t3-desktop-skeleton-table-row" key={index}>
          <Bar width={60} /><Bar width={64} /><Bar width={84} /><Bar width={48} />
        </div>)}
      </section>
      <section className="t3-desktop-skeleton-card t3-desktop-skeleton-side t3-desktop-skeleton-lower">
        <header><h2>{t("overview.design.whatMoved")}</h2><span>{t("overview.fidelity.sevenDaysLong")}</span></header>
        {Array.from({ length: 8 }, (_, index) => <div className="t3-desktop-skeleton-mover" key={index}>
          <Bar width={32} /><Bar width={`${[72, 58, 46, 34, 26, 18, 12, 38][index]}%`} height={10} /><Bar width={56} />
        </div>)}
      </section>
    </div>
  </div>;
}
