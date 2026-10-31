import { cn } from "@/lib/utils";
import { Link, useMatch, useResolvedPath } from "react-router-dom";
import {
  DashboardIcon, BarChartIcon, BackpackIcon, MixIcon, ActivityLogIcon,
  ClockIcon, LayersIcon, GearIcon, RocketIcon, ChevronLeftIcon,
  ChevronRightIcon, BellIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { useAlertBadge } from "../use-alert-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const overview = { to: "/overview", labelKey: "nav.overview", icon: DashboardIcon };
const analyze = [
  { to: "/summary", labelKey: "nav.summary", icon: BarChartIcon },
  { to: "/wallets", labelKey: "nav.wallets", icon: BackpackIcon },
  { to: "/comparison", labelKey: "nav.comparison", icon: MixIcon },
  { to: "/cost-basis", labelKey: "nav.costBasis", icon: LayersIcon },
];
const manage = [
  { to: "/history", labelKey: "nav.history", icon: ClockIcon },
  { to: "/rebalance", labelKey: "nav.rebalance", icon: ActivityLogIcon },
  { to: "/goals", labelKey: "nav.goals", icon: BellIcon },
  { to: "/assistant", labelKey: "nav.assistant", icon: RocketIcon },
];
const settings = { to: "/settings", labelKey: "nav.settings", icon: GearIcon };

type NavEntry = typeof overview;

function NavItem({ item, collapsed, unread }: { item: NavEntry; collapsed: boolean; unread?: number }) {
  const { t } = useTranslation();
  const label = t(item.labelKey);
  const resolved = useResolvedPath(item.to);
  const match = useMatch({ path: resolved.pathname, end: false });
  const unreadText = unread ? t("goals.unread").replace("{count}", String(unread)) : "";
  const Icon = item.icon;
  const link = <Link to={item.to}
    aria-label={collapsed ? `${label}${unreadText ? ` ${unreadText}` : ""}` : undefined}
    aria-current={match ? "page" : undefined}
    className={cn(
      "group relative flex h-9 touch:min-h-11 items-center gap-3 rounded-md px-[9px] text-[13px] font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "hover:bg-raised hover:text-foreground",
      match ? "bg-raised text-foreground before:absolute before:-left-[10px] before:top-2 before:bottom-2 before:w-[2px] before:bg-accent-data" : "text-muted-foreground",
      collapsed && "justify-center px-0",
    )}>
    <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
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

function NavGroup({ label, items, collapsed, unread }: {
  label: string; items: NavEntry[]; collapsed: boolean; unread: number;
}) {
  return <div className="mt-2 border-t border-border pt-2">
    {!collapsed && <div className="px-[9px] pb-1 text-xs text-muted-foreground">{label}</div>}
    {items.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed}
      unread={item.to === "/goals" ? unread : undefined} />)}
  </div>;
}

export default function Sidebar({ collapsed, onToggle, isProUser }: {
  collapsed: boolean; onToggle: () => void; isProUser: boolean;
}) {
  const { t } = useTranslation();
  const unread = useAlertBadge();
  return <aside style={{ width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)" }}
    className="fixed inset-y-0 left-0 z-20 flex flex-col overflow-hidden border-r bg-background transition-[width] duration-300 ease-in-out">
    <div className="flex h-14 shrink-0 items-center gap-2 px-[10px]">
      <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent-data text-background dark:text-background">
        <BarChartIcon className="h-[18px] w-[18px]" />
      </span>
      {!collapsed && <span className="truncate text-[15px] font-bold">{t("app.brand")}</span>}
      {isProUser && !collapsed && <span className="rounded-pill bg-accent-data/15 px-2 text-xs text-foreground dark:text-accent-data">{t("app.proBadge")}</span>}
    </div>
    <TooltipProvider delayDuration={220}><nav aria-label={t("nav.main", "Main navigation")} className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-[10px] touch:px-[5px] pb-2">
      <NavItem item={overview} collapsed={collapsed} />
      <NavGroup label={t("nav.analyze", "Analyze")} items={analyze} collapsed={collapsed} unread={unread} />
      <NavGroup label={t("nav.manage", "Manage")} items={isProUser ? manage : manage.slice(0, -1)} collapsed={collapsed} unread={unread} />
      <div className="mt-auto border-t border-border pt-2"><NavItem item={settings} collapsed={collapsed} /></div>
    </nav></TooltipProvider>
    <div className="border-t px-[10px] touch:px-[5px] py-2">
      <button type="button" aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
        aria-expanded={!collapsed} onClick={onToggle}
        className="flex h-9 touch:min-h-11 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
      </button>
    </div>
  </aside>;
}
