import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "@/mobile/i18n";
import { useHaptics } from "@/mobile/components/mobile";
import { MobileIcon } from "@/mobile/components/mobile/icons";
import {
  ChevronLeftIcon, ChevronRightIcon, DashboardIcon, BarChartIcon,
  BackpackIcon, MixIcon, LayersIcon, ClockIcon, ActivityLogIcon,
  BellIcon, RocketIcon, GearIcon,
} from "@radix-ui/react-icons";

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
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { collapsed = false, unread = 0, onCollapse, onTabSwitch } = props;
  const groups = [
    { items: [{ to: "/overview", key: "nav.overview", icon: DashboardIcon }] },
    { label: t("nav.analyze"), items: [
      { to: "/summary", key: "nav.summary", icon: BarChartIcon },
      { to: "/wallets", key: "nav.wallets", icon: BackpackIcon },
      { to: "/comparison", key: "nav.comparison", icon: MixIcon },
      { to: "/cost-basis", key: "nav.costBasis", icon: LayersIcon },
    ] },
    { label: t("nav.manage"), items: [
      { to: "/history", key: "nav.history", icon: ClockIcon },
      { to: "/rebalance", key: "nav.rebalance", icon: ActivityLogIcon },
      { to: "/goals", key: "nav.goals", icon: BellIcon },
      { to: "/assistant", key: "nav.assistant", icon: RocketIcon },
    ] },
  ];
  const renderItem = (item: typeof groups[number]["items"][number]) => {
    const label = t(item.key);
    const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
    const badgeText = item.to === "/goals" && unread > 0 ? t("goals.unread").replace("{count}", String(unread)) : "";
    const Icon = item.icon;
    return <Link key={item.to} to={item.to} onClick={() => onTabSwitch?.(false)}
      className="mobile-rail-item" aria-current={active ? "page" : undefined}
      aria-label={collapsed || badgeText ? `${label}${badgeText ? ` ${badgeText}` : ""}` : undefined}
      title={collapsed ? label : undefined}>
      <Icon aria-hidden="true" />
      {!collapsed && <span className="mobile-nav-label">{label}</span>}
      {badgeText && <span aria-hidden="true" className="mobile-rail-badge">{unread > 99 ? "99+" : unread}</span>}
      {badgeText && !collapsed && <span className="sr-only"> {badgeText}</span>}
    </Link>;
  };
  return <nav aria-label={t("nav.main")} className="mobile-sidebar" data-collapsed={collapsed}>
    <div className="mobile-rail-brand"><span aria-hidden="true"><DashboardIcon /></span>{!collapsed && <b>{t("app.brand")}</b>}</div>
    {groups.map((group, index) => <div className="mobile-rail-group" key={index}>
      {group.label && !collapsed && <div className="mobile-rail-group-label">{group.label}</div>}
      {group.items.map(renderItem)}
    </div>)}
    <div className="mobile-rail-spacer" />
    {renderItem({ to: "/settings", key: "nav.settings", icon: GearIcon })}
    <button type="button" className="mobile-sidebar-collapse" onClick={onCollapse}
      aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")} aria-expanded={!collapsed}>
      {collapsed ? <ChevronRightIcon aria-hidden="true" /> : <ChevronLeftIcon aria-hidden="true" />}
      {!collapsed && <span className="mobile-nav-label">{t("sidebar.collapse")}</span>}
    </button>
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
