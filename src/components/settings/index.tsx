import {
  Outlet,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";
import {
  GearIcon,
  SunIcon,
  ArchiveIcon,
  InfoCircledIcon,
  RocketIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { getConfiguration } from "@/middlelayers/configuration";
import AssistantSettings from "./assistant";
import { defaultSettingsRoutes, SettingsMenu } from "./settings-menu";

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

const App = () => {
  const { t } = useTranslation();
  const lo = useLocation();
  const section = new URLSearchParams(lo.search).get("section");
  const redirectPath = lo.pathname === "/settings" ? "/settings/configuration" : lo.pathname;
  const defaultRoute = defaultSettingsRoutes[redirectPath];
  const active = lo.pathname === "/settings/configuration" ? (section === "currency" ? "currency" : "sources")
    : lo.pathname === "/settings/appearance" ? (section === "language" ? "language" : "appearance")
    : lo.pathname === "/settings/data" ? (section === "blacklist" ? "blacklist" : section === "security" ? "security" : "backup")
    : lo.pathname === "/settings/assistant" ? "ai"
    : lo.pathname === "/settings/sync" ? "sync"
    : lo.pathname === "/settings/systemInfo" ? (section === "about" ? "about" : "pro") : "sources";
  const titleKey = {
    sources: "settings.phase6.sources", blacklist: "settings.phase6.blacklist",
    currency: "settings.phase6.currency", appearance: "settings.phase6.appearance",
    language: "settings.phase6.language", pro: "settings.phase6.pro",
    ai: "settings.phase6.ai", backup: "settings.phase6.backup",
    security: "settings.phase6.security", sync: "settings.phase6.sync",
    about: "settings.phase6.about",
  }[active];
  const [sourceCounts, setSourceCounts] = useState<{ exchanges: number; wallets: number; brokers: number; custom: number }>();
  const [blacklistCount, setBlacklistCount] = useState<number>();
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false);
  useEffect(() => {
    const update = (event: Event) => setSourceEditorOpen(!!(event as CustomEvent<boolean>).detail);
    window.addEventListener("t3-source-editor-state", update);
    return () => window.removeEventListener("t3-source-editor-state", update);
  }, []);
  useEffect(() => {
    const update = (event: Event) => setBlacklistCount(Number((event as CustomEvent<number>).detail));
    window.addEventListener("t3-blacklist-count", update);
    return () => window.removeEventListener("t3-blacklist-count", update);
  }, []);
  useEffect(() => {
    if (active !== "sources") return;
    void getConfiguration().then((config) => {
      if (!config) return;
      setSourceCounts({
        exchanges: config.exchanges.length,
        wallets: ["btc", "erc20", "sol", "doge", "trc20", "ton", "sui"]
          .reduce((sum, chain) => sum + ((config as unknown as Record<string, { addresses?: unknown[] }>)[chain]?.addresses?.length ?? 0), 0),
        brokers: config.stockConfig?.brokers.length ?? 0,
        custom: config.others.length,
      });
    }).catch(() => {});
  }, [active]);
  const subtitle = active === "sources" && sourceEditorOpen
    ? t("fidelity.settings.subtitle.sourcesAdd")
    : active === "sources" && sourceCounts
    ? sourceCounts.exchanges === 0
      ? t("fidelity.settings.subtitle.sourcesEmpty")
      : t("fidelity.settings.subtitle.sources")
      .replace("{exchanges}", String(sourceCounts.exchanges))
      .replace("{wallets}", String(sourceCounts.wallets))
      .replace("{brokers}", String(sourceCounts.brokers))
      .replace("{custom}", String(sourceCounts.custom))
    : active === "blacklist" && blacklistCount !== undefined
    ? t(blacklistCount ? "fidelity.settings.subtitle.blacklistCount" : "fidelity.settings.subtitle.blacklistEmpty")
      .replace("{count}", String(blacklistCount))
    : t(["pro", "ai", "backup", "security", "sync", "about"].includes(active)
      ? `fidelity.settingsB.subtitle.${active}` : `fidelity.settings.subtitle.${active}`);

  if (!section && defaultRoute) {
    const params = new URLSearchParams(lo.search);
    params.set("section", new URLSearchParams(defaultRoute.split("?")[1]).get("section")!);
    return <Navigate to={`${redirectPath}?${params}`} replace />;
  }

  return (
    <div className="t3-settings" data-design-section={active}>
      <h1 className="sr-only">{t("settings.title")}</h1>
      <p className="t3-settings-crumb">{t("settings.title")}</p>
      <div className="t3-settings-design-header">
        <div><h2>{t(titleKey)}</h2>
        <p>{active === "sources"
          ? subtitle.split(/(\d+\s(?:exchanges|wallets|broker|个交易所|个钱包|个券商))/g)
            .map((part, index) => /^\d+\s(?:exchanges|wallets|broker|个交易所|个钱包|个券商)$/.test(part)
              ? <strong key={index}>{part}</strong> : part)
          : active === "blacklist" && blacklistCount
          ? subtitle.split(/(\d+ hidden|已隐藏 \d+ 个)/g).map((part, index) =>
            /^(?:\d+ hidden|已隐藏 \d+ 个)$/.test(part) ? <strong key={index}>{part}</strong> : part)
          : subtitle}</p></div>
      </div>
      <div className="t3-settings-layout" data-active-tab={settingsTabs.find((tab) => tab.href === lo.pathname)?.titleKey}>
        <SettingsMenu pathname={lo.pathname} search={lo.search} />
        <div className="t3-settings-content">
        <Outlet context={section} />
        </div>
      </div>
    </div>
  );
};

export default App;
