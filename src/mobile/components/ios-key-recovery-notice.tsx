import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useTranslation } from "@/mobile/i18n";
import { isIOS } from "@/utils/platform";

export default function IOSKeyRecoveryNotice() {
  const { t } = useTranslation();
  const [needsRecovery, setNeedsRecovery] = useState(false);

  useEffect(() => {
    if (!isIOS()) return;
    let active = true;
    void invoke<boolean>("ios_key_recovery_needed")
      .then((needed) => {
        if (active) setNeedsRecovery(needed);
      })
      .catch(() => console.warn("could not check iOS encryption key recovery"));
    return () => {
      active = false;
    };
  }, []);

  if (!needsRecovery) return null;
  return (
    <div role="alert" className="border-b border-destructive bg-destructive/10 px-4 py-3 text-sm">
      <p>{t("ios.keyRecovery.message")}</p>
      <a className="inline-flex min-h-11 items-center font-medium underline" href="#/settings/configuration">
        {t("ios.keyRecovery.openSettings")}
      </a>
    </div>
  );
}
