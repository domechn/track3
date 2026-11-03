import { memo, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/mobile/components/ui/dialog";
import { LinkBreak2Icon } from "@radix-ui/react-icons";
import { useTranslation } from "@/mobile/i18n";
import { getWalletLogo } from "@/lib/utils";
import type { AttachModalProps } from "@/components/configuration/types";
import { isIOS } from "@/utils/platform";

const AttachModal = memo(function AttachModal({
  open,
  onOpenChange,
  currentAttachTo,
  cexOptions,
  walletOptions,
  onSelect,
  fidelityLayout = false,
  assetName = "",
  pausedValues = [],
}: AttachModalProps & { fidelityLayout?: boolean; assetName?: string; pausedValues?: string[] }) {
  const { t } = useTranslation();

  // Encode the current attachTo for comparison with option values
  const currentEncoded = currentAttachTo
    ? `${currentAttachTo.kind}:${currentAttachTo.type}:${currentAttachTo.identity}`
    : "";
  const [selected, setSelected] = useState(currentEncoded);
  useEffect(() => {
    if (open) setSelected(currentEncoded);
  }, [open, currentEncoded]);

  const selectOption = (encoded: string) => {
    onSelect(encoded);
  };
  if (isIOS() && fidelityLayout) {
    const title = t("fidelity.settings.sources.attachTitle").replace("{asset}", assetName);
    const options = [
      { value: "", label: t("fidelity.settings.sources.standalone"), detail: t("fidelity.settings.sources.notAttached") },
      ...cexOptions.map((option) => ({ value: option.value, label: option.label, detail: pausedValues.includes(option.value)
        ? t("fidelity.settings.sources.exchangePaused") : t("fidelity.settings.sources.exchange") })),
      ...walletOptions.map((option) => ({ value: option.value, label: option.label, detail: t("fidelity.settings.sources.wallet") })),
    ];
    return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fidelity-attach-dialog" aria-label={title}>
        <div className="fidelity-attach-handle" aria-hidden="true" />
        <DialogHeader className="fidelity-attach-header">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("fidelity.settings.sources.attachHint")}</DialogDescription>
        </DialogHeader>
        <div className="fidelity-attach-options" role="radiogroup" aria-label={title}>
          {options.map((option) => <button key={option.value} type="button" role="radio"
            aria-checked={selected === option.value} onClick={() => setSelected(option.value)}>
            <i className={selected === option.value ? "is-selected" : ""} />
            <strong>{option.label}</strong><span>{option.detail}</span>
          </button>)}
        </div>
        <footer><button type="button" onClick={() => onOpenChange(false)}>{t("common.cancel")}</button>
          <button type="button" className="is-primary" onClick={() => selectOption(selected)}>{t("fidelity.settings.sources.attach")}</button></footer>
      </DialogContent>
    </Dialog>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isIOS()
        ? "bottom-0 left-0 top-auto max-h-[75dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        : "sm:max-w-[380px]"}>
        <DialogHeader>
          <DialogTitle>{t("config.others.attachTo")}</DialogTitle>
          <DialogDescription>
            {t("config.others.attachToModalDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className={`${isIOS() ? "max-h-[30dvh]" : "max-h-[360px]"} overflow-y-auto space-y-1 py-2`}>
          {/* None / detach */}
          <button
            type="button"
            aria-pressed={!currentEncoded}
            className={
              "flex touch:min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (!currentEncoded
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted")
            }
            onClick={() => selectOption("")}
          >
            <LinkBreak2Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm">{t("config.others.attachToNone")}</span>
          </button>

          {/* Exchanges */}
          {cexOptions.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                {t("config.others.attachToGroupExchanges")}
              </div>
              {cexOptions.map((opt) => {
                const exType = opt.value.split(":")[1] ?? "";
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={currentEncoded === opt.value}
                    className={
                      "flex touch:min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                      (currentEncoded === opt.value
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted")
                    }
                    onClick={() => selectOption(opt.value)}
                  >
                    <img
                      className="w-[20px] h-[20px] rounded-full shrink-0"
                      src={getWalletLogo(exType)}
                      alt=""
                    />
                    <span className="text-sm truncate">{opt.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* Wallets */}
          {walletOptions.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                {t("config.others.attachToGroupWallets")}
              </div>
              {walletOptions.map((opt) => {
                const wType = opt.value.split(":")[1] ?? "";
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={currentEncoded === opt.value}
                    className={
                      "flex touch:min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                      (currentEncoded === opt.value
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted")
                    }
                    onClick={() => selectOption(opt.value)}
                  >
                    <img
                      className="w-[20px] h-[20px] rounded-full shrink-0"
                      src={getWalletLogo(wType)}
                      alt=""
                    />
                    <span className="text-sm truncate">{opt.label}</span>
                  </button>
                );
              })}
            </>
          )}

          {cexOptions.length === 0 && walletOptions.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("config.others.noAttachTargets")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export { AttachModal };
