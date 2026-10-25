import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "@/mobile/i18n";
import { useHaptics } from "@/mobile/components/mobile";
import { MobileIcon } from "@/mobile/components/mobile/icons";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";

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

function Navigation({ unread = 0, onTabSwitch, sidebar = false, collapsed = false, onCollapse }: {
  unread?: number;
  onTabSwitch?: (rootTap: boolean) => void;
  sidebar?: boolean;
  collapsed?: boolean;
  onCollapse?: () => void;
}) {
  const { t } = useTranslation();
  const haptic = useHaptics();
  const { pathname, search, hash } = useLocation();
  const selected = tabForPath(pathname);
  const tabs = [
    { id: "overview" as const, title: t("nav.overview") },
    { id: "history" as const, title: t("nav.history") },
    { id: "analytics" as const, title: t("nav.analytics", "Analytics") },
    { id: "more" as const, title: t("nav.more", "More") },
  ];
  return <nav aria-label={t("mobile.tabs", "Tabs")} className={sidebar ? "mobile-sidebar" : "mobile-tab-bar"}
    data-collapsed={sidebar && collapsed}>
    {tabs.map(({ id, title }) => <Link key={id} to={tabRoots[id]}
      aria-label={id === "more" && unread > 0
        ? `${title}, ${t("goals.unread").replace("{count}", String(unread))}` : title}
      onClick={(event) => {
        haptic("selection");
        if (selected === id && pathname === tabRoots[id] && !search && !hash) {
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
      <span className="mobile-nav-label">{title}</span>
      {id === "more" && unread > 0 && <span className="sr-only">{t("goals.unread").replace("{count}", String(unread))}</span>}
    </Link>)}
    {sidebar && <button type="button" className="mobile-sidebar-collapse" onClick={onCollapse}
      aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")} aria-expanded={!collapsed}>
      {collapsed ? <ChevronRightIcon aria-hidden="true" /> : <ChevronLeftIcon aria-hidden="true" />}
      <span className="mobile-nav-label">{t(collapsed ? "sidebar.expand" : "sidebar.collapse")}</span>
    </button>}
  </nav>;
}

export function MobileNavigation(props: { unread?: number; onTabSwitch?: (rootTap: boolean) => void }) {
  return <Navigation {...props} />;
}

export function MobileSidebar(props: { unread?: number; onTabSwitch?: (rootTap: boolean) => void; collapsed?: boolean; onCollapse?: () => void }) {
  return <Navigation {...props} sidebar />;
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
