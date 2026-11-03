import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArchiveIcon, BarChartIcon, ChatBubbleIcon, ChevronRightIcon,
  EyeNoneIcon, GlobeIcon, InfoCircledIcon,
  LockClosedIcon, RocketIcon, SunIcon, TokensIcon, UpdateIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { getVersion } from "@/utils/app";

const sections = [
  { group: "data", items: [
    { key: "sources", title: "settings.phase6.sources", href: "/settings/configuration?section=sources", icon: TokensIcon },
    { key: "blacklist", title: "settings.phase6.blacklist", href: "/settings/data?section=blacklist", icon: EyeNoneIcon },
  ] },
  { group: "preferences", items: [
    { key: "currency", title: "settings.phase6.currency", href: "/settings/configuration?section=currency", icon: BarChartIcon },
    { key: "appearance", title: "settings.phase6.appearance", href: "/settings/appearance?section=theme", icon: SunIcon },
    { key: "language", title: "settings.phase6.language", href: "/settings/appearance?section=language", icon: GlobeIcon },
  ] },
  { group: "account", items: [
    { key: "pro", title: "settings.phase6.pro", href: "/settings/systemInfo?section=pro", icon: RocketIcon },
    { key: "ai", title: "settings.phase6.ai", href: "/settings/assistant", icon: ChatBubbleIcon },
  ] },
  { group: "security", items: [
    { key: "backup", title: "settings.phase6.backup", href: "/settings/data?section=backup", icon: ArchiveIcon },
    { key: "security", title: "settings.phase6.security", href: "/settings/data?section=security", icon: LockClosedIcon },
    { key: "sync", title: "settings.phase6.sync", href: "/settings/sync", icon: UpdateIcon },
  ] },
  { group: "", items: [
    { key: "about", title: "settings.phase6.about", href: "/settings/systemInfo?section=about", icon: InfoCircledIcon },
  ] },
] as const;

const defaultSections: Record<string, string> = {
  "/settings/configuration": "sources",
  "/settings/data": "backup",
  "/settings/appearance": "appearance",
  "/settings/systemInfo": "pro",
};

const designIconPaths: Record<string, ReactNode> = {
  sources: <><ellipse cx="9" cy="4.5" rx="5.5" ry="2" /><path d="M3.5 4.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M3.5 9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" /></>,
  blacklist: <><path d="M1.5 9S4.5 4 9 4s7.5 5 7.5 5-3 5-7.5 5S1.5 9 1.5 9z" /><circle cx="9" cy="9" r="2" /></>,
  currency: <path d="M9 2.5v13M12 5.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 1.8 3 2.2 3 1 3 2.3-1.3 2-3 2-3-.8-3-2" />,
  appearance: <><path d="M9 2.5a6.5 6.5 0 1 0 0 13c1.2 0 1.5-1 1-2s0-2 1.5-2h1.5A2.5 2.5 0 0 0 15.5 9 6.5 6.5 0 0 0 9 2.5z" /><circle cx="6" cy="8" r=".8" /><circle cx="9" cy="5.8" r=".8" /><circle cx="12" cy="8" r=".8" /></>,
  language: <path d="M2.5 4h8M6.5 2.5V4M4 4c.5 3 2.5 5.5 5 7M9 4c-.5 3-2.5 5.5-5 7M10 15l3-7 3 7M11 13h4" />,
  pro: <path d="M9 2l1.8 4.7L15.5 8.5l-4.7 1.8L9 15l-1.8-4.7L2.5 8.5l4.7-1.8z" />,
  ai: <path d="M3 4h12v8H8l-3.5 3v-3H3z" />,
  backup: <path d="M9 3v8M5.5 8L9 11.5 12.5 8M3.5 14.5h11" />,
  security: <path d="M9 2.5l5.5 2v4.5c0 3-2.3 5-5.5 6.5C5.8 14 3.5 12 3.5 9V4.5z" />,
  sync: <path d="M5 14a3.5 3.5 0 0 1-.5-7A4.5 4.5 0 0 1 13 6.5 3.8 3.8 0 0 1 13 14z" />,
  about: <><circle cx="9" cy="9" r="6.5" /><path d="M9 8v4M9 5.8v.2" /></>,
};

export function SettingsMenu({ pathname, search, values }: { pathname: string; search: string; values?: Record<string, string> }) {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");
  useEffect(() => {
    void getVersion().then(setVersion).catch(() => {});
  }, []);

  return <nav aria-label={t("settings.sectionsAriaLabel")} className="t3-settings-menu">
    {sections.map((group) => <div className="t3-settings-menu-group" key={group.group || "about"}>
      {group.group && <p className="t3-settings-menu-heading">{t(`settings.phase6.group.${group.group}`)}</p>}
      <div className="t3-settings-menu-links">
        {group.items.map((item) => {
          const href = item.href;
          const active = `${pathname}${search}` === href || (!search && defaultSections[pathname] === item.key);
          const Icon = item.icon;
          return <Link key={item.key} to={href} aria-label={values?.[item.key] ? t(item.title) : undefined}
            aria-describedby={values?.[item.key] ? `settings-menu-value-${item.key}` : undefined}
            aria-current={active ? "page" : undefined} className="t3-settings-menu-link mobile-list-row">
            <Icon aria-hidden="true" className="t3-settings-menu-icon" />
            <svg className="t3-settings-menu-design-icon" aria-hidden="true" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{designIconPaths[item.key]}</svg>
            <span className="mobile-list-label">{t(item.title)}</span>
            {values?.[item.key] && <span id={`settings-menu-value-${item.key}`} className="t3-settings-menu-value mobile-list-value">{values[item.key]}</span>}
            {item.key === "about" && version && <>{" "}<span className="t3-settings-menu-value mobile-list-value">{version}</span></>}
            <ChevronRightIcon aria-hidden="true" className="t3-settings-menu-chevron" />
          </Link>;
        })}
      </div>
    </div>)}
  </nav>;
}
