import { memo, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/mobile/components/ui/dialog";
import { ReloadIcon, StarIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/mobile/i18n";
import { prettyPriceNumberToLocaleString } from "@/utils/currency";
import type { QuickLookDialogProps } from "@/components/configuration/types";
import { isIOS } from "@/utils/platform";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { LicenseCenter, type ProUsage } from "@/middlelayers/license";

const QuickLookDialog = memo(function QuickLookDialog({
  open,
  onOpenChange,
  title,
  loading,
  data,
  fidelityLayout = false,
  onRefresh,
}: QuickLookDialogProps & { fidelityLayout?: boolean; onRefresh?: () => void }) {
  const { t } = useTranslation();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [refreshedAt, setRefreshedAt] = useState<string>();
  const [usage, setUsage] = useState<ProUsage>();
  useEffect(() => {
    if (!open || !fidelityLayout) return;
    let live = true;
    void ASSET_HANDLER.listAssets(1).then((snapshots) => {
      if (!live) return;
      const assets = snapshots.flat();
      setPrices(Object.fromEntries(assets.map((asset) => [asset.symbol, asset.price])));
      setRefreshedAt(assets[0]?.createdAt);
    }).catch(() => {});
    try {
      void LicenseCenter.getInstance().getUsage().then((next) => {
        if (live) setUsage(next);
      }).catch(() => {});
    } catch {
      // A quick look remains usable when license usage is unavailable.
    }
    return () => { live = false; };
  }, [open, fidelityLayout]);
  const rows = useMemo(() => data.map((asset) => {
    const price = prices[asset.symbol];
    return { ...asset, price, value: price === undefined ? undefined : Math.round(asset.amount * price * 100) / 100 };
  }).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), [data, prices]);
  const fmt = (value: number, digits = 2) => value.toLocaleString("en-US", {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
  const money = (value: number) => `$${fmt(value)}`;
  const quota = usage ? {
    used: usage.usage.erc20.used + usage.usage.tron.used,
    limit: usage.usage.erc20.limit + usage.usage.tron.limit,
  } : undefined;
  if (isIOS() && fidelityLayout) {
    const time = refreshedAt ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
      .format(new Date(refreshedAt)) : "—";
    return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fidelity-quicklook-dialog">
        <div className="fidelity-quicklook-handle" aria-hidden="true" />
        <DialogHeader className="fidelity-quicklook-head">
          <span className="fidelity-quicklook-code">{title === "Binance" ? "BN" : title.slice(0, 2).toUpperCase()}</span>
          <div><DialogTitle>{title}</DialogTitle>
            <DialogDescription>{t("fidelity.settings.quicklook.refreshed").replace("{time}", time)}</DialogDescription></div>
        </DialogHeader>
        <div className="fidelity-quicklook-body">
          {loading ? <div role="status" className="fidelity-quicklook-loading">{t("common.loading")}</div>
            : rows.length === 0 ? <p>{t("config.noAssets")}</p>
              : <table><thead><tr>
                <th>{t("fidelity.settings.quicklook.asset")}</th>
                <th>{t("config.balanceAmount")}</th>
                <th>{t("fidelity.settings.quicklook.price")}</th>
                <th>{t("fidelity.settings.quicklook.value")}</th>
              </tr></thead><tbody>
                {rows.map((row) => <tr key={row.symbol}>
                  <td>{row.symbol}</td>
                  <td>{fmt(row.amount, Number.isInteger(row.amount) ? 0 : row.symbol === "BNB" ? 4 : row.symbol === "BTC" ? 1 : 2)}</td>
                  <td>{row.price === undefined ? "—" : money(row.price)}</td>
                  <td>{row.value === undefined ? "—" : money(row.value)}</td>
                </tr>)}
                <tr className="is-total"><td colSpan={3}>{t("fidelity.settings.quicklook.total")}</td>
                  <td>{money(rows.reduce((sum, row) => sum + (row.value ?? 0), 0))}</td></tr>
              </tbody></table>}
          {quota && <div className="fidelity-quicklook-quota"><StarIcon aria-hidden="true" /><p>
            <strong>{t("fidelity.settings.quicklook.quota")}</strong>
            {t("fidelity.settings.quicklook.quotaHint")
              .replace("{used}", String(quota.used)).replace("{limit}", String(quota.limit))}
          </p></div>}
        </div>
        <footer className="fidelity-quicklook-foot">
          <button type="button" onClick={() => onOpenChange(false)}>{t("common.close")}</button>
          <button type="button" className="is-primary" onClick={onRefresh} disabled={!onRefresh}>
            <ReloadIcon aria-hidden="true" />{t("fidelity.settings.quicklook.refresh").replace("{source}", title)}</button>
        </footer>
      </DialogContent>
    </Dialog>;
  }

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
