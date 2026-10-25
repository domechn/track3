import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "@/mobile/i18n";
import { useHaptics } from "@/mobile/components/mobile";
import { MobileIcon } from "@/mobile/components/mobile/icons";

export type MobileTab = "overview" | "history" | "analytics" | "more";
export const tabRoots: Record<MobileTab, string> = {
  overview: "/overview", history: "/history", analytics: "/summary", more: "/more",
};

export function tabForPath(path: string): MobileTab {
  if (path.startsWith("/history")) return "history";
  if (path.startsWith("/overview")) return "overview";
  if (/^\/(summary|wallets|comparison|cost-basis|coins)(\/|$)/.test(path)) return "analytics";
  return "more";
}

export function MobileNavigation({ unread = 0, onTabSwitch }: { unread?: number; onTabSwitch?: (rootTap: boolean) => void }) {
  const { t } = useTranslation();
  const haptic = useHaptics();
  const { pathname } = useLocation();
  const selected = tabForPath(pathname);
  const tabs = [
    { id: "overview" as const, title: t("nav.overview") },
    { id: "history" as const, title: t("nav.history") },
    { id: "analytics" as const, title: t("nav.analytics", "Analytics") },
    { id: "more" as const, title: t("nav.more", "More") },
  ];
  return <nav aria-label={t("mobile.tabs", "Tabs")} className="mobile-tab-bar">
    {tabs.map(({ id, title }) => <Link key={id} to={tabRoots[id]}
      onClick={(event) => {
        haptic("selection");
        if (selected === id && pathname === tabRoots[id]) {
          event.preventDefault();
          onTabSwitch?.(true);
          window.scrollTo(0, 0);
        } else {
          onTabSwitch?.(selected === id);
        }
      }}
      className="mobile-tab" aria-current={selected === id ? "page" : undefined}>
      <span className="mobile-tab-icon"><MobileIcon name={id} filled={selected === id} />{id === "more" && unread > 0 &&
        <span className="mobile-tab-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}</span>
      <span>{title}</span>
      {id === "more" && unread > 0 && <span className="sr-only">{t("goals.unread").replace("{count}", String(unread))}</span>}
    </Link>)}
  </nav>;
}

export function routeTitle(path: string, t: (key: string, fallback?: string) => string) {
  const base = path.split("/")[1];
  if (base === "coins" && path.split("/")[2]) return path.split("/")[2];
  const titles: Record<string, string> = {
    overview: "nav.overview", history: "nav.history", summary: "nav.summary",
    wallets: "nav.wallets", comparison: "nav.comparison", "cost-basis": "nav.costBasis",
    coins: "nav.analytics", rebalance: "nav.rebalance", goals: "nav.goals",
    assistant: "nav.assistant", settings: "nav.settings", more: "nav.more",
  };
  return t(titles[base] ?? "nav.more", "More");
}
