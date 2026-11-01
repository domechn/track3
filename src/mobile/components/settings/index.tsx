import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  UpdateIcon,
  GlobeIcon,
  LockClosedIcon,
  TokensIcon,
  EyeNoneIcon,
  FileTextIcon,
  BarChartIcon,
  ChatBubbleIcon,
} from "@radix-ui/react-icons";
import { LOCALE_LABELS, useTranslation } from "@/mobile/i18n";
import { isIOS } from "@/utils/platform";
import { SplitView, useHaptics, useSizeClass } from "@/mobile/components/mobile";
import { getCachedPreferCurrency } from "@/middlelayers/configuration";
import { useTheme } from "@/mobile/components/common/theme";
import AssistantSettings from "@/mobile/components/settings/assistant";
import { SettingsMenu } from "@/components/settings/settings-menu";

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
    titleKey: "settings.tab.assistant",
    href: "/settings/assistant",
    icon: RocketIcon,
  },
  {
    titleKey: "settings.tab.sync",
    href: "/settings/sync",
    icon: UpdateIcon,
  },
  {
    titleKey: "settings.tab.system",
    href: "/settings/systemInfo",
    icon: InfoCircledIcon,
  },
];

const mobileSettings = [
  { key: "settings.mobile.sources", href: "/settings/configuration?section=sources", icon: TokensIcon, group: "portfolio" },
  { key: "settings.mobile.currency", href: "/settings/configuration?section=currency", icon: BarChartIcon, group: "portfolio" },
  { key: "settings.tab.appearance", href: "/settings/appearance?section=theme", icon: SunIcon, group: "preferences" },
  { key: "settings.mobile.language", href: "/settings/appearance?section=language", icon: GlobeIcon, group: "preferences" },
  { key: "settings.mobile.blacklist", href: "/settings/data?section=blacklist", icon: EyeNoneIcon, group: "preferences" },
  { key: "settings.mobile.pro", href: "/settings/systemInfo?section=pro", icon: RocketIcon, group: "preferences" },
  { key: "settings.mobile.ai", href: "/settings/assistant", icon: ChatBubbleIcon, group: "preferences" },
  { key: "settings.mobile.security", href: "/settings/data?section=security", icon: LockClosedIcon, group: "privacy" },
  { key: "settings.mobile.backup", href: "/settings/data?section=backup", icon: ArchiveIcon, group: "privacy" },
  { key: "settings.mobile.sync", href: "/settings/sync", icon: UpdateIcon, group: "privacy" },
  { key: "settings.mobile.about", href: "/settings/systemInfo?section=about", icon: FileTextIcon, group: "privacy" },
] as const;

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
        "flex touch:min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
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
  const { t, locale } = useTranslation();
  const { theme } = useTheme();
  const haptic = useHaptics();
  const isWide = useSizeClass().width === "wide";
  const lo = useLocation();
  const [topBar, setTopBar] = useState<HTMLElement | null>(null);
  useEffect(() => setTopBar(document.getElementById("app-top-bar")), []);
  if (isIOS()) {
    const isHub = lo.pathname === "/settings";
    const selectedHref = mobileSettings.find((item) =>
      item.href === `${lo.pathname}${lo.search}`)?.href ??
      mobileSettings.find((item) => item.href.split("?")[0] === lo.pathname)?.href;
    const title = mobileSettings.find((item) => item.href === selectedHref)?.key;
    return (
      <div className="ios-d3-settings mx-auto w-full min-w-0 pb-6">
        {topBar && createPortal(
          <span className="ios-d3-pushed-title">{t(title ?? "settings.title")}</span>,
          topBar)}
        <SplitView selected={!isHub} masterLabel={t("settings.sectionsAriaLabel")}
          detailLabel={t(title ?? "settings.title")}
          master={isHub || isWide ? <>
            <h1 className="ios-large-title mb-5 pt-2">{t("settings.title")}</h1>
            <div onClickCapture={() => haptic("selection")}>
              <SettingsMenu pathname={lo.pathname} search={lo.search} values={{
                currency: getCachedPreferCurrency() ?? "USD",
                language: LOCALE_LABELS[locale],
                appearance: theme === "system" ? t("settings.mobile.system") : t(`appearance.theme.${theme}`),
              }} />
            </div>
          </> : null}
          detail={isHub ? <p className="analytics-empty">{t("settings.selectDetail")}</p> : <>
            <header className="space-y-3 pt-1">
              <h1 className="ios-large-title mb-5">{t(title ?? "settings.title")}</h1>
            </header>
            <div className="ios-d3-settings-page"><Outlet context={new URLSearchParams(lo.search).get("section")} /></div>
          </>} />
      </div>
    );
  }

  return (
    <div className="t3-settings">
      <h1 className="sr-only">{t("settings.title")}</h1>
      <p className="t3-settings-crumb">{t("settings.title")}</p>
      <div className="t3-settings-layout" data-active-tab={settingsTabs.find((tab) => tab.href === lo.pathname)?.titleKey}>
        <SettingsMenu pathname={lo.pathname} search={lo.search} />
        <div className="t3-settings-content">
        <Outlet context={new URLSearchParams(lo.search).get("section")} />
        {lo.pathname === "/settings" && (
          <Navigate to="/settings/configuration" />
        )}
        </div>
      </div>
    </div>
  );
};

export default App;
