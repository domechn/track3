import { cn } from "@/lib/utils";
import { Link, useLocation, useMatch, useResolvedPath } from "react-router-dom";
import { useTranslation } from "@/i18n";
import type { ReactNode } from "react";
import { useAlertBadge } from "../use-alert-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  "/settings": <><circle cx="9" cy="9" r="2.5" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" /></>,
};

function NavItem({ item, collapsed, unread }: { item: NavEntry; collapsed: boolean; unread?: number }) {
  const { t } = useTranslation();
  const label = t(item.labelKey);
  const resolved = useResolvedPath(item.to);
  const match = useMatch({ path: resolved.pathname, end: false });
  const unreadText = unread ? t("goals.unread").replace("{count}", String(unread)) : "";
  const link = <Link to={item.to}
    aria-label={collapsed ? `${label}${unreadText ? ` ${unreadText}` : ""}` : undefined}
    aria-current={match ? "page" : undefined}
    className={cn(
      "group relative flex h-9 touch:min-h-11 items-center gap-3 rounded-md px-[9px] text-[13px] font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "hover:bg-raised hover:text-foreground",
      match ? "bg-raised text-foreground before:absolute before:-left-[10px] before:top-2 before:bottom-2 before:w-[2px] before:bg-accent-data" : "text-muted-foreground",
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

function NavGroup({ label, items, collapsed, unread }: {
  label: string; items: NavEntry[]; collapsed: boolean; unread: number;
}) {
  return <div className="mt-2 border-t border-border pt-2 fidelity-records-rail-group">
    {!collapsed && <div className="px-[9px] pb-1 text-xs text-muted-foreground">{label}</div>}
    {items.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed}
      unread={item.to === "/goals" ? unread : undefined} />)}
  </div>;
}

export default function Sidebar({ collapsed, onToggle, isProUser, recordsToolsOpen = false }: {
  collapsed: boolean; onToggle: () => void; isProUser: boolean; recordsToolsOpen?: boolean;
}) {
  const { t } = useTranslation();
  const unread = useAlertBadge();
  const { pathname } = useLocation();
  const records = pathname === "/history" || pathname === "/cost-basis";
  return <aside style={{ width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)" }}
    className={cn("fixed inset-y-0 left-0 z-20 flex flex-col overflow-hidden border-r bg-background transition-[width] duration-300 ease-in-out",
      "fidelity-records-rail", collapsed && "fidelity-records-rail-collapsed")}>
    <div className="flex h-14 shrink-0 items-center gap-2 px-[10px]">
      <button type="button" aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
        aria-expanded={!collapsed} onClick={onToggle} className="flex h-11 w-11 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 28 28">
          <rect width="28" height="28" rx="7" fill="#4a8ad6" />
          <path d="M8 20v-6M14 20V8M20 20v-4.5" stroke="#0d0d0e" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      {!collapsed && <span className="truncate text-[15px] font-bold">{t("app.brand")}</span>}
      {isProUser && !collapsed && <span className="rounded-pill bg-accent-data/15 px-2 text-xs text-foreground dark:text-accent-data">{t("app.proBadge")}</span>}
    </div>
    <TooltipProvider delayDuration={220}><nav aria-label={t("nav.main", "Main navigation")} className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-[10px] touch:px-[5px] pb-2">
      <NavItem item={overview} collapsed={collapsed} />
      <NavGroup label={t("nav.analyze", "Analyze")} items={analyze} collapsed={collapsed} unread={unread} />
      <NavGroup label={t("nav.manage", "Manage")} items={isProUser ? manage : manage.slice(0, -1)} collapsed={collapsed} unread={unread} />
      <div className="mt-auto border-t border-border pt-2">{records
        ? <button type="button" aria-label={t("records.controls")} aria-haspopup="true"
          aria-expanded={recordsToolsOpen} aria-controls="t3-records-toolbar-panel"
          onClick={() => window.dispatchEvent(new Event("records-controls-toggle"))}
          className={cn("group relative flex h-9 w-full touch:min-h-11 items-center gap-3 rounded-md px-[9px] text-[13px] font-medium whitespace-nowrap text-muted-foreground hover:bg-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-0")}>
          <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {recordsIcons["/settings"]}
          </svg>
          {!collapsed && <span>{t("records.controls")}</span>}
        </button> : <NavItem item={settings} collapsed={collapsed} />}</div>
    </nav></TooltipProvider>
  </aside>;
}
