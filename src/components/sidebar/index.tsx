import { cn } from "@/lib/utils";
import { Link, useLocation, useMatch, useResolvedPath } from "react-router-dom";
import { useTranslation } from "@/i18n";
import type { ReactNode } from "react";
import { useAlertBadge } from "../use-alert-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrackLogo } from "@/components/brand/track-logo";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { settingsCog } from "@/components/settings-cog";
import { useContext } from "react";
import { DisplayCurrencyContext } from "@/contexts/display-currency";
import CurrencySwitchButton from "@/components/currency-switch-button";

const overview = { to: "/overview", labelKey: "nav.overview" };
const analyze = [
  { to: "/summary", labelKey: "nav.summary" },
  { to: "/wallets", labelKey: "nav.wallets" },
  { to: "/comparison", labelKey: "nav.comparison" },
  { to: "/cost-basis", labelKey: "nav.costBasis" },
];
const manage = [
  { to: "/history", labelKey: "nav.history" },
  { to: "/rebalance", labelKey: "nav.rebalance" },
  { to: "/goals", labelKey: "nav.goals" },
  { to: "/assistant", labelKey: "nav.assistant" },
];
const settings = { to: "/settings", labelKey: "nav.settings" };

type NavEntry = typeof overview;

const recordsIcons: Record<string, ReactNode> = {
  "/overview": <><rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1" /><rect x="10" y="2.5" width="5.5" height="5.5" rx="1" /><rect x="2.5" y="10" width="5.5" height="5.5" rx="1" /><rect x="10" y="10" width="5.5" height="5.5" rx="1" /></>,
  "/summary": <path d="M3 15V8M7 15V3M11 15v-5M15 15V6" />,
  "/wallets": <><rect x="2.5" y="4.5" width="13" height="9.5" rx="2" /><path d="M2.5 7.5h13M12 11h1.5" /></>,
  "/comparison": <path d="M6 3v12M12 3v12M3 6l3-3 3 3M9 12l3 3 3-3" />,
  "/cost-basis": <path d="M9 2.5v13M12 5.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2.2 3 1 3 2.3-1.3 2-3 2-3-.8-3-2" />,
  "/history": <path d="M2.5 9a6.5 6.5 0 1 0 2-4.7M2.5 3v3h3M9 5.5V9l2.5 1.5" />,
  "/rebalance": <path d="M3 6h9M9 3l3 3-3 3M15 12H6M9 9l-3 3 3 3" />,
  "/goals": <><circle cx="9" cy="9" r="6.5" /><circle cx="9" cy="9" r="3" /></>,
  "/assistant": <path d="M3 4h12v8H8l-3.5 3v-3H3z" />,
  "/settings": settingsCog,
};
const recordsControlsSliders = <>
  <path d="M2.5 5h2m4 0h7M2.5 13h8m4 0h1" />
  <circle cx="6.5" cy="5" r="2" />
  <circle cx="12.5" cy="13" r="2" />
</>;

function NavItem({ item, collapsed, unread, fidelity }: { item: NavEntry; collapsed: boolean; unread?: number; fidelity?: boolean }) {
  const { t } = useTranslation();
  const label = item.to === "/goals" ? t("overview.fidelity.alerts") : t(item.labelKey);
  const resolved = useResolvedPath(item.to);
  const match = useMatch({ path: resolved.pathname, end: false });
  const { pathname } = useLocation();
  const current = !!match || (fidelity && item.to === "/overview" && pathname.startsWith("/coins/"));
  const unreadText = unread ? t("goals.unread").replace("{count}", String(unread)) : "";
  const link = <Link to={item.to}
    aria-label={unreadText ? `${label} ${unreadText}` : collapsed ? label : undefined}
    aria-current={current ? "page" : undefined}
    className={cn(
      "t3-nav-item group relative flex items-center gap-3 px-[9px] text-[13px] font-medium whitespace-nowrap",
      collapsed && "justify-center px-0",
    )}>
    <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {recordsIcons[item.to]}</svg>
    {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
    {!!unread && <span aria-hidden="true" className={cn(
      "grid min-w-[18px] h-[18px] place-items-center rounded-pill bg-negative px-1 text-[11px] font-bold text-primary-foreground dark:text-background",
      collapsed && "absolute right-1 top-1 h-[7px] min-w-[7px] w-[7px] p-0 text-[0px] ring-2 ring-background",
    )}>{unread > 99 ? "99+" : unread}</span>}
    {!!unread && !collapsed && <span className="sr-only"> {unreadText}</span>}
  </Link>;
  return collapsed ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger>
    <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent></Tooltip> : link;
}

function NavGroup({ label, items, collapsed, unread, fidelity }: {
  label: string; items: NavEntry[]; collapsed: boolean; unread: number; fidelity?: boolean;
}) {
  return <div className={cn("t3-nav-divider fidelity-records-rail-group", fidelity && "t3-fidelity-nav-group")}>
    {!collapsed && <div className="t3-rail-group-label px-[9px] pb-1 text-xs">{label}</div>}
    {items.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed} fidelity={fidelity}
      unread={item.to === "/goals" ? unread : undefined} />)}
  </div>;
}

export default function Sidebar({ collapsed, onToggle, isProUser, recordsToolsOpen = false, fidelity = false }: {
  collapsed: boolean; onToggle: () => void; isProUser: boolean; recordsToolsOpen?: boolean; fidelity?: boolean;
}) {
  const { t } = useTranslation();
  const displayCurrency = useContext(DisplayCurrencyContext);
  const unread = useAlertBadge();
  const { pathname } = useLocation();
  const records = pathname === "/history" || pathname === "/cost-basis";
  const recordsControlLabel = t(pathname === "/history" ? "records.historyFilters" : "records.controls");
  const recordsControlIcon = <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {recordsControlsSliders}
  </svg>;
  const recordsControl = records ? <button type="button" aria-label={recordsControlLabel} aria-haspopup="true"
    aria-expanded={recordsToolsOpen} aria-pressed={recordsToolsOpen} aria-controls="t3-records-toolbar-panel"
    onClick={() => window.dispatchEvent(new Event("records-controls-toggle"))}
    className={cn("t3-nav-item t3-records-control group relative flex w-full items-center gap-3 px-[9px] text-[13px] font-medium whitespace-nowrap",
      collapsed && "justify-center px-0")}>
    {recordsControlIcon}
    {!collapsed && <span>{recordsControlLabel}</span>}
  </button> : <span aria-hidden="true" className={cn("t3-nav-item t3-records-control invisible flex w-full items-center gap-3 px-[9px]",
    collapsed && "justify-center px-0")}>{recordsControlIcon}</span>;
  return <aside style={{ width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)" }}
    aria-keyshortcuts="Alt+ArrowRight Alt+ArrowLeft"
    onKeyDown={(event) => {
      if (event.altKey && ((event.key === "ArrowRight" && collapsed) || (event.key === "ArrowLeft" && !collapsed))) {
        event.preventDefault();
        onToggle();
      }
    }}
    className={cn("t3-desktop-rail fixed inset-y-0 left-0 z-20 flex flex-col overflow-hidden border-r bg-background transition-[width] duration-300 ease-in-out",
      collapsed && "t3-rail-collapsed",
      !fidelity && "fidelity-records-rail", !fidelity && collapsed && "fidelity-records-rail-collapsed", fidelity && "t3-fidelity-sidebar")}>
    <div className="flex h-14 shrink-0 items-center gap-2 px-[6px]">
      <Link to="/overview" aria-label={collapsed ? "Track3" : undefined}
        className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <TrackLogo size={28} decorative />
        {!collapsed && <span className="truncate text-[15px] font-semibold">{t("app.brand")}</span>}
      </Link>
      {isProUser && !collapsed && <span className="rounded-pill bg-accent-data/15 px-2 text-xs text-foreground dark:text-accent-data">{t("app.proBadge")}</span>}
    </div>
    <TooltipProvider delayDuration={220}><nav aria-label={t("nav.main", "Main navigation")} className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-[10px] touch:px-[5px] pb-2">
      <NavItem item={overview} collapsed={collapsed} fidelity={fidelity} />
      <NavGroup label={t("nav.analyze", "Analyze")} items={analyze} collapsed={collapsed} unread={unread} fidelity={fidelity} />
      <NavGroup label={t("nav.manage", "Manage")} items={isProUser ? manage : manage.slice(0, -1)} collapsed={collapsed} unread={unread} fidelity={fidelity} />
    </nav><div className="t3-rail-footer t3-nav-divider shrink-0">
      {collapsed && records ? <Tooltip><TooltipTrigger asChild>{recordsControl}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>{recordsControlLabel}</TooltipContent></Tooltip> : recordsControl}
      {displayCurrency && <CurrencySwitchButton preferredCurrency={displayCurrency.preferredCurrency}
        displayCurrency={displayCurrency.displayCurrency} onToggle={displayCurrency.toggleDisplayCurrency}
        disabled={displayCurrency.switching} collapsed={collapsed} />}
      <NavItem item={settings} collapsed={collapsed} fidelity={fidelity} />
    </div></TooltipProvider>
    <button type="button" aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
      aria-expanded={!collapsed} onClick={onToggle}
      className={cn("mx-[6px] mb-2 flex h-11 shrink-0 items-center rounded-md text-muted-foreground hover:bg-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "w-11 justify-center" : "gap-3 px-[9px] text-[13px]")}>
      {collapsed ? <ChevronRightIcon aria-hidden="true" /> : <ChevronLeftIcon aria-hidden="true" />}
      {!collapsed && <span>{t("sidebar.collapse")}</span>}
    </button>
  </aside>;
}
