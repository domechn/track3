import { cn } from "@/lib/utils";
import { Link, useMatch, useResolvedPath } from "react-router-dom";
import {
  DashboardIcon,
  BarChartIcon,
  BackpackIcon,
  MixIcon,
  ActivityLogIcon,
  ClockIcon,
  LayersIcon,
  GearIcon,
  RocketIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BellIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { useAlertBadge } from "../use-alert-badge";

const navItems = [
  { to: "/overview", labelKey: "nav.overview", icon: DashboardIcon },
  { to: "/summary", labelKey: "nav.summary", icon: BarChartIcon },
  { to: "/wallets", labelKey: "nav.wallets", icon: BackpackIcon },
  { to: "/comparison", labelKey: "nav.comparison", icon: MixIcon },
  { to: "/rebalance", labelKey: "nav.rebalance", icon: ActivityLogIcon },
  { to: "/goals", labelKey: "nav.goals", icon: BellIcon },
  { to: "/history", labelKey: "nav.history", icon: ClockIcon },
  { to: "/cost-basis", labelKey: "nav.costBasis", icon: LayersIcon },
  { to: "/settings", labelKey: "nav.settings", icon: GearIcon },
];

function NavItem({
  to,
  label,
  icon: Icon,
  collapsed,
  unread,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  unread?: number;
}) {
  const { t } = useTranslation();
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: false });
  const unreadText = unread ? t("goals.unread").replace("{count}", String(unread)) : "";

  return (
    <Link
      to={to}
      aria-label={collapsed ? `${label}${unreadText ? ` ${unreadText}` : ""}` : undefined}
      title={collapsed ? label : undefined}
      aria-current={match ? "page" : undefined}
      className={cn(
        "group relative flex touch:min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "hover:bg-accent/60 hover:text-foreground",
        match ? "bg-accent/80 text-foreground" : "text-muted-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-200",
          match ? "opacity-100" : "opacity-0 group-hover:opacity-40",
        )}
      />
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          match
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {!collapsed && (
        <span className="overflow-hidden whitespace-nowrap text-ellipsis">
          {label}
        </span>
      )}
      {!!unread && <span aria-hidden="true" className={cn(
        "rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground",
        collapsed && "absolute -right-1 -top-1",
      )}>
        {unread > 99 ? "99+" : unread}
      </span>}
      {!!unread && <span className="sr-only">{collapsed ? "" : " "}{unreadText}</span>}
    </Link>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
  isProUser,
}: {
  collapsed: boolean;
  onToggle: () => void;
  isProUser: boolean;
}) {
  const { t } = useTranslation();
  const unread = useAlertBadge();
  const sidebarWidth = collapsed ? 52 : 200;
  // AI is Pro-only. Insert the entry right before Settings so it
  // visually groups with the other navigation targets. Non-Pro users
  // land on the upsell when they navigate to /ai directly.
  const items = isProUser
    ? [
        ...navItems.slice(0, navItems.length - 1),
        { to: "/assistant", labelKey: "nav.assistant", icon: RocketIcon },
        navItems[navItems.length - 1],
      ]
    : navItems;

  return (
    <aside
      style={{ width: sidebarWidth }}
      className="fixed top-0 left-0 bottom-0 z-20 flex flex-col glass-intense border-r transition-[width] duration-300 ease-in-out"
    >
      <div className="flex items-center gap-2 px-3 h-12 border-b border-[var(--glass-border)] overflow-hidden">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">
              {t("app.brand")}
            </span>
            {isProUser && (
              <span className="text-xs font-semibold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                {t("app.proBadge")}
              </span>
            )}
          </div>
        )}
        {collapsed && isProUser && (
          <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded mx-auto">
            P
          </span>
        )}
      </div>

      <nav className={cn("flex-1 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden", collapsed ? "p-2 touch:p-0.5" : "p-2")}>
        {items.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={t(item.labelKey)}
            icon={item.icon}
            collapsed={collapsed}
            unread={item.to === "/goals" ? unread : undefined}
          />
        ))}
      </nav>

      <div className={cn("border-t border-[var(--glass-border)]", collapsed ? "p-2 touch:p-0.5" : "p-2")}>
        <button
          type="button"
          aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
          onClick={onToggle}
          className="flex touch:min-h-11 items-center justify-center w-full rounded-lg py-2 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
