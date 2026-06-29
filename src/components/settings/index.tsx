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
  RocketIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import AssistantSettings from "./assistant";

const settingsTabs = [
  {
    titleKey: "settings.tab.configuration",
    href: "/settings/configuration",
    icon: GearIcon,
  },
  {
    titleKey: "settings.tab.appearance",
    href: "/settings/appearance",
    icon: SunIcon,
  },
  {
    titleKey: "settings.tab.data",
    href: "/settings/data",
    icon: ArchiveIcon,
  },
  {
    titleKey: "settings.tab.system",
    href: "/settings/systemInfo",
    icon: InfoCircledIcon,
  },
  {
    titleKey: "settings.tab.assistant",
    href: "/settings/assistant",
    icon: RocketIcon,
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
      aria-current={match ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
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
  const { t } = useTranslation();
  const lo = useLocation();

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{t("settings.title")}</h1>
      <nav
        aria-label={t("settings.sectionsAriaLabel")}
        className="flex flex-wrap items-center gap-1 glass rounded-xl px-2 py-1.5"
      >
        {settingsTabs.map((tab) => (
          <TabLink
            key={tab.href}
            to={tab.href}
            title={t(tab.titleKey)}
            icon={tab.icon}
          />
        ))}
      </nav>
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
