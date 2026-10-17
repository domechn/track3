import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LinkBreak2Icon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { getWalletLogo } from "@/lib/utils";
import type { AttachModalProps } from "./types";

const AttachModal = memo(function AttachModal({
  open,
  onOpenChange,
  currentAttachTo,
  cexOptions,
  walletOptions,
  onSelect,
}: AttachModalProps) {
  const { t } = useTranslation();

  // Encode the current attachTo for comparison with option values
  const currentEncoded = currentAttachTo
    ? `${currentAttachTo.kind}:${currentAttachTo.type}:${currentAttachTo.identity}`
    : "";

  const selectOption = (encoded: string) => {
    onSelect(encoded);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{t("config.others.attachTo")}</DialogTitle>
          <DialogDescription>
            {t("config.others.attachToModalDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[360px] overflow-y-auto space-y-1 py-2">
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
