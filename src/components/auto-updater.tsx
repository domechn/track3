import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { reloadApp } from "@/utils/app";
import { useTranslation } from "@/i18n";

const App = () => {
  const { t } = useTranslation();
  const [readyVersion, setReadyVersion] = useState<string | null>(null);
  const [deferred, setDeferred] = useState(false);
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
    setReadyVersion(update.version ?? "");
  }

  return <><Dialog open={readyVersion !== null && !deferred} onOpenChange={(open) => { if (!open) setDeferred(true); }}>
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{t("settings.phase6.updateReadyTitle")}</DialogTitle>
        <DialogDescription>
          {t("settings.phase6.updateReadyDescription").replace("{version}", readyVersion || t("settings.phase6.updateReadyVersion"))}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setDeferred(true)}>{t("settings.phase6.updateLater")}</Button>
        <Button onClick={reloadApp}>{t("settings.phase6.updateRestart")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
    {readyVersion !== null && deferred && <Button className="fixed bottom-4 right-4 z-50 shadow-overlay" onClick={reloadApp}>
      {t("settings.phase6.updateRestart")}
    </Button>}
  </>;
};

export default App;
