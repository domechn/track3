import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/mobile/components/ui/dialog";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/mobile/i18n";
import { resolveAssetLogoSrc } from "@/utils/assets";
import { prettyPriceNumberToLocaleString } from "@/utils/currency";
import type { QuickLookDialogProps } from "@/components/configuration/types";
import { isIOS } from "@/utils/platform";

const QuickLookDialog = memo(function QuickLookDialog({
  open,
  onOpenChange,
  title,
  loading,
  data,
  logoMap,
}: QuickLookDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isIOS()
        ? "bottom-0 left-0 top-auto max-h-[80dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        : "sm:max-w-[425px]"}>
        <DialogHeader>
          <DialogTitle>{t("config.quickLookTitle").replace("{source}", title)}</DialogTitle>
          <DialogDescription>
            {t("config.currentAssetBalances")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div role="status" className="flex items-center justify-center py-8">
              <ReloadIcon aria-hidden="true" className="h-6 w-6 animate-spin" />
              <span className="sr-only">{t("common.loading")}</span>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t("config.noAssets")}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 text-sm font-medium text-muted-foreground px-2">
                <span>{t("config.balanceSymbol")}</span>
                <span className="text-right">{t("config.balanceAmount")}</span>
              </div>
              {data.map((item, idx) => (
                <div
                  key={item.symbol + idx}
                  className="grid grid-cols-2 text-sm px-2 py-1.5 rounded hover:bg-muted items-center"
                >
                  <div className="flex items-center">
                    <img
                      className="inline-block w-[20px] h-[20px] mr-2 rounded-full"
                      src={resolveAssetLogoSrc(item, logoMap[item.symbol])}
                      alt={item.symbol}
                    />
                    <span className="font-medium">{item.symbol}</span>
                  </div>
                  <span className="text-right">
                    {prettyPriceNumberToLocaleString(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

export { QuickLookDialog };
