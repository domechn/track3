import { cn } from "@/lib/utils";
import { Link, useMatch, useResolvedPath } from "react-router-dom";
import {
  DashboardIcon,
  BarChartIcon,
  BackpackIcon,
  MixIcon,
  ClockIcon,
  GearIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";

const navItems = [
  { to: "/overview", label: "Overview", icon: DashboardIcon },
  { to: "/summary", label: "Summary", icon: BarChartIcon },
  { to: "/wallets", label: "Wallets", icon: BackpackIcon },
  { to: "/comparison", label: "Comparison", icon: MixIcon },
  { to: "/history", label: "History", icon: ClockIcon },
  { to: "/settings", label: "Settings", icon: GearIcon },
];

function NavItem({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: false });

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200",
        "hover:bg-accent/60",
        match
          ? "bg-accent/80 text-accent-foreground"
          : "text-muted-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <span className="overflow-hidden whitespace-nowrap text-ellipsis">
          {label}
        </span>
      )}
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
  const sidebarWidth = collapsed ? 52 : 200;

  return (
    <aside
      style={{ width: sidebarWidth }}
      className="fixed top-0 left-0 bottom-0 z-20 flex flex-col glass-intense border-r transition-[width] duration-300 ease-in-out"
    >
      <div className="flex items-center gap-2 px-3 h-12 border-b border-[var(--glass-border)] overflow-hidden">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">Track3</span>
            {isProUser && (
              <span className="text-xs font-semibold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                PRO
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

      <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="p-2 border-t border-[var(--glass-border)]">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full rounded-lg py-2 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
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
