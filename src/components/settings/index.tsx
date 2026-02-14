import { cn } from "@/lib/utils";
import {
  Outlet,
  Navigate,
  useLocation,
  Link,
  useMatch,
  useResolvedPath,
} from "react-router-dom";
import {
  GearIcon,
  SunIcon,
  ArchiveIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons";

const settingsTabs = [
  {
    title: "Configuration",
    href: "/settings/configuration",
    icon: GearIcon,
  },
  {
    title: "Appearance",
    href: "/settings/appearance",
    icon: SunIcon,
  },
  {
    title: "Data",
    href: "/settings/data",
    icon: ArchiveIcon,
  },
  {
    title: "System",
    href: "/settings/systemInfo",
    icon: InfoCircledIcon,
  },
];

function TabLink({
  to,
  title,
  icon: Icon,
}: {
  to: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: true });

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        match
          ? "bg-accent/80 text-accent-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {title}
    </Link>
  );
}

const App = () => {
  const lo = useLocation();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1 glass rounded-xl px-2 py-1.5">
        {settingsTabs.map((tab) => (
          <TabLink key={tab.href} to={tab.href} title={tab.title} icon={tab.icon} />
        ))}
      </div>
      <div className="w-full">
        <Outlet />
        {lo.pathname === "/settings" && (
          <Navigate to="/settings/configuration" />
        )}
      </div>
    </div>
  );
};

export default App;
