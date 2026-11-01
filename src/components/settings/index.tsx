import {
  Outlet,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  GearIcon,
  SunIcon,
  ArchiveIcon,
  InfoCircledIcon,
  RocketIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import AssistantSettings from "./assistant";
import { SettingsMenu } from "./settings-menu";

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
