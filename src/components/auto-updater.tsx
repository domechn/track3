import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { reloadApp } from "@/utils/app";
import { useTranslation } from "@/i18n";

const maxInt = 2147483647;

const App = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  useEffect(() => {
    void autoInstallLatestVersion().catch(() => {
      console.warn("Automatic update check failed");
    });
  }, []);

  async function autoInstallLatestVersion() {
    const update = await check();
    if (!update?.available) {
      return false;
    }
    await update.downloadAndInstall();
    toast({
      title: t("autoUpdater.title"),
      duration: maxInt,
      action: (
        <ToastAction
          altText={t("autoUpdater.reload")}
          onClick={reloadApp}
          className="bg-primary text-primary-foreground shadow hover:bg-primary/90"
        >
          {t("autoUpdater.reload")}
        </ToastAction>
      ),
    });
  }

  return <></>;
};

export default App;
