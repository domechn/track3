import { useEffect, useMemo, useState } from "react";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import type { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { positiveNegativeTextClass } from "@/utils/color";
import { Card } from "./ui/card";
import { deriveSourceChanges } from "./wallet-snapshot-matrix";

type MatrixData = {
  baselineAt: string;
  changes: ReturnType<typeof deriveSourceChanges>;
  identities: Record<string, string>;
};

export default function WalletSourceChanges({ currency, dateRange, quoteColor, selectedSource }: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  selectedSource: string | null;
}) {
  const { t, locale } = useTranslation();
  const version = useDataChangedVersion();
  const [data, setData] = useState<MatrixData | null>(null);
  const [ready, setReady] = useState(false);
  const endTime = dateRange.end.getTime();

  useEffect(() => {
    let active = true;
    setReady(false);
    const load = async () => {
      const beginning = new Date(0);
      const latest = (await queryHistoricalPage({ start: beginning, end: new Date(endTime) }, 1, 0)).rows[0];
      if (!latest) return null;
      const thirtyDaysEarlier = new Date(new Date(latest.createdAt).getTime() - 30 * 86_400_000);
      const baseline = (await queryHistoricalPage({ start: beginning, end: thirtyDaysEarlier }, 1, 0)).rows[0];
      if (!baseline) return null;
      const assets = await ASSET_HANDLER.listAssetsByUUIDs([baseline.id, latest.id]);
      const wallets = [...new Set(assets.map((asset) => asset.wallet).filter((wallet): wallet is string => !!wallet))];
      const aliases: Record<string, { wallet: string; alias: string; type: string } | undefined> =
        await new WalletAnalyzer(async () => []).listWalletAliases(wallets).catch(() => ({}));
      const identities = Object.fromEntries(wallets.map((wallet) => [wallet, aliases[wallet]?.wallet ?? wallet]));
      const labels = Object.fromEntries(wallets.map((wallet) => {
        const alias = aliases[wallet];
        return [wallet, alias?.alias ?? alias?.wallet ?? wallet];
      }));
      return {
        baselineAt: baseline.createdAt,
        changes: deriveSourceChanges(
          assets.filter((asset) => asset.uuid === baseline.id),
          assets.filter((asset) => asset.uuid === latest.id),
          labels,
        ),
        identities,
      };
    };
    void load().then((result) => {
      if (active) setData(result);
    }).catch(() => {
      if (active) setData(null);
    }).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [endTime, version]);

  const sourceId = selectedSource
    ? Object.keys(data?.identities ?? {}).find((id) => id === selectedSource || data?.identities[id] === selectedSource)
    : null;
  const sources = useMemo(() =>
    data?.changes.sources.filter((source) => !selectedSource || source.id === sourceId) ?? [],
  [data, selectedSource, sourceId]);
  const assets = useMemo(() =>
    data?.changes.assets
      .filter((asset) => sources.some((source) => asset.values[source.id]))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 10) ?? [],
  [data, sources]);
  const money = (value: number) => `${value < 0 ? "−" : value > 0 ? "+" : ""}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(value)))}`;
  const tone = (value: number) => positiveNegativeTextClass(value, quoteColor, 500);
  const baselineLabel = data ? t("wallets.changeSince").replace("{date}", new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(data.baselineAt))) : "";

  return <div className="wallet-source-changes">
    <Card className="wallet-source-change-card">
      <div className="wallet-source-change-heading">
        <h2>{t("wallets.thirtyDaySourceChanges")}</h2>
        {baselineLabel && <span>{baselineLabel}</span>}
      </div>
      {!ready ? <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        : !data ? <p className="text-muted-foreground text-sm">{t("wallets.changeUnavailable")}</p>
        : <div className="wallet-source-change-list">
          {sources.map((source) => <div key={source.id}>
            <strong>{source.label}</strong>
            <span>{currency.symbol}{prettyNumberToLocaleString(currencyWrapper(currency)(source.value))}</span>
            <span className={tone(source.change)}>{money(source.change)}</span>
            <span className={tone(source.change)}>{source.percentage === null ? "—" : `${source.percentage > 0 ? "+" : ""}${source.percentage.toFixed(2)}%`}</span>
          </div>)}
        </div>}
    </Card>
    {ready && data && assets.length > 0 && <Card className="wallet-asset-change-card">
      <div className="wallet-source-change-heading"><h2>{t("wallets.assetChangesBySource")}</h2><span>{baselineLabel}</span></div>
      <div className="wallet-asset-change-mobile">
        {assets.map((asset) => {
          const value = selectedSource && sourceId ? asset.values[sourceId] ?? 0 : asset.total;
          return <div key={asset.key}><strong>{asset.symbol}</strong><span className={tone(value)}>{money(value)}</span></div>;
        })}
      </div>
      <div className="wallet-asset-change-scroll" tabIndex={0} aria-label={t("wallets.assetChangesBySource")}>
        <table>
          <thead><tr><th>{t("cost.asset")}</th>{sources.map((source) => <th key={source.id}>{source.label}</th>)}<th>{t("wallets.allSources")}</th></tr></thead>
          <tbody>{assets.map((asset) => <tr key={asset.key}>
            <th>{asset.symbol}</th>
            {sources.map((source) => {
              const value = asset.values[source.id];
              return <td key={source.id} className={value === undefined ? "" : tone(value)}>{value === undefined ? "—" : money(value)}</td>;
            })}
            <td className={tone(asset.total)}>{money(asset.total)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </Card>}
  </div>;
}
