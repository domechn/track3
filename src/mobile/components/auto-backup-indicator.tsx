import { useEffect, useState } from "react";
import { backupFolderPreparationEvent } from "@/middlelayers/ios-backup-folder";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/mobile/i18n";
import { isIOS } from "@/utils/platform";

export type AutoBackupStatus = "idle" | "running";

type AutoBackupIndicatorProps = {
  status: AutoBackupStatus;
};

// Subtle bottom-right indicator shown while the background auto backup /
// auto import is running. Intentionally low-key: a small pill with a
// pulsing dot and short label, with the longer description on hover.
export default function AutoBackupIndicator({
  status,
}: AutoBackupIndicatorProps) {
  const { t } = useTranslation();
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    const update = (event: Event) => setPreparing((event as CustomEvent<boolean>).detail);
    window.addEventListener(backupFolderPreparationEvent, update);
    return () => window.removeEventListener(backupFolderPreparationEvent, update);
  }, []);

  if (status !== "running" && !preparing) {
    return null;
  }

  if (isIOS()) {
    return <div role="status" aria-live="polite" className="ios-d3-auto-backup fixed inset-x-4 z-40 rounded-xl bg-card p-3 text-sm" style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}>
      <p className="font-medium">{t(preparing ? "data.folder.downloading" : "autoBackup.indicator.title")}</p>
      {!preparing && <p className="text-muted-foreground">{t("autoBackup.indicator.description")}</p>}
    </div>;
  }

  return (
    <div className="auto-backup-browser-indicator fixed bottom-4 right-4 z-50">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="status"
              aria-live="polite"
              aria-label={t("autoBackup.indicator.title")}
              className="flex items-center gap-2 rounded-full border border-border/40 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-md"
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60 motion-reduce:animate-none animate-pulse"
              />
              <span>{t("autoBackup.indicator.title")}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{t("autoBackup.indicator.description")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
