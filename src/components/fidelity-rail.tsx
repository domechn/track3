import { Link, useLocation } from "react-router-dom";
import { useAlertBadge } from "./use-alert-badge";
import { useTranslation } from "@/i18n";
import SyncStatusIndicator from "./sync-status-indicator";
import { TrackLogo } from "@/components/brand/track-logo";
import { settingsCog } from "./settings-cog";

const entries = [
  { to: "/overview", labelKey: "nav.overview", icon: "overview" },
  { sep: true },
  { to: "/summary", labelKey: "nav.summary", icon: "analytics" },
  { to: "/wallets", labelKey: "nav.wallets", icon: "wallets" },
  { to: "/comparison", labelKey: "nav.comparison", icon: "comparison" },
  { to: "/cost-basis", labelKey: "nav.costBasis", icon: "cost" },
  { sep: true },
  { to: "/history", labelKey: "nav.history", icon: "history" },
  { to: "/rebalance", labelKey: "nav.rebalance", icon: "rebalance" },
  { to: "/goals", labelKey: "nav.goals", icon: "goals" },
  { to: "/assistant", labelKey: "nav.assistant", icon: "assistant" },
] as const;

function RailIcon({ name }: { name: string }) {
  let shape;
  switch (name) {
    case "overview": shape = <><rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1" /><rect x="10" y="2.5" width="5.5" height="5.5" rx="1" /><rect x="2.5" y="10" width="5.5" height="5.5" rx="1" /><rect x="10" y="10" width="5.5" height="5.5" rx="1" /></>; break;
    case "analytics": shape = <path d="M3 15V8M7 15V3M11 15v-5M15 15V6" />; break;
    case "wallets": shape = <><rect x="2.5" y="4.5" width="13" height="9.5" rx="2" /><path d="M2.5 7.5h13M12 11h1.5" /></>; break;
    case "comparison": shape = <path d="M6 3v12M12 3v12M3 6l3-3 3 3M9 12l3 3 3-3" />; break;
    case "cost": shape = <path d="M9 2.5v13M12 5.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2.2 3 1 3 2.3-1.3 2-3 2-3-.8-3-2" />; break;
    case "history": shape = <path d="M2.5 9a6.5 6.5 0 1 0 2-4.7M2.5 3v3h3M9 5.5V9l2.5 1.5" />; break;
    case "rebalance": shape = <path d="M3 6h9M9 3l3 3-3 3M15 12H6M9 9l-3 3 3 3" />; break;
    case "goals": shape = <><circle cx="9" cy="9" r="6.5" /><circle cx="9" cy="9" r="3" /></>; break;
    case "assistant": shape = <path d="M3 4h12v8H8l-3.5 3v-3H3z" />; break;
    case "settings": shape = settingsCog; break;
    default: shape = null;
  }
  return <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shape}</svg>;
}

export default function FidelityRail({ isProUser = false }: { isProUser?: boolean }) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const unread = useAlertBadge();
  const goalsLabel = t("overview.fidelity.alerts");
  return <nav className="t3-fidelity-rail" aria-label={t("nav.main")}>
    <Link to="/overview" className="t3-fidelity-brand" aria-label="Track3"><TrackLogo size={28} decorative /></Link>
    {entries.map((entry, index) => "sep" in entry ? <div className="t3-fidelity-rail-sep" key={`sep-${index}`} /> :
      entry.to === "/assistant" && !isProUser ? null :
      <Link key={entry.to} to={entry.to} title={entry.to === "/goals" ? goalsLabel : t(entry.labelKey)} aria-label={`${entry.to === "/goals" ? goalsLabel : t(entry.labelKey)}${entry.to === "/goals" && unread > 0 ? ` ${t("goals.unread").replace("{count}", String(unread))}` : ""}`}
        aria-current={pathname.startsWith(entry.to) ? "page" : undefined}
        className={`t3-fidelity-rail-item ${pathname.startsWith(entry.to) ? "selected" : ""}`}>
        <RailIcon name={entry.icon} />{entry.to === "/goals" && unread > 0 && <i className="t3-fidelity-rail-badge" aria-hidden="true" />}
      </Link>)}
    <div className="t3-fidelity-rail-spacer" />
    <SyncStatusIndicator />
    <Link to="/settings" className="t3-fidelity-rail-item" aria-label={t("nav.settings")} title={t("nav.settings")}><RailIcon name="settings" /></Link>
  </nav>;
}
