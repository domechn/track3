import { useEffect, useState } from "react";
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
