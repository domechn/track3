import { useEffect, useMemo, useState } from "react";
import type { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import type { AttributionDimension } from "@/middlelayers/charts-attribution";
import { groupAttribution } from "@/middlelayers/charts-attribution";
import { queryAttribution } from "@/middlelayers/charts-attribution-data";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useTranslation } from "@/i18n";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { positiveNegativeColor, positiveNegativeTextClass } from "@/utils/color";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type Data = Awaited<ReturnType<typeof queryAttribution>>;
const dimensions: AttributionDimension[] = ["coin", "source", "wallet", "assetType"];

export default function ProfitAttribution({ currency, dateRange, quoteColor }: { currency: CurrencyRateDetail; dateRange: TDateRange; quoteColor: QuoteColor }) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<{ rangeKey: string; result: Data } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dimension, setDimension] = useState<AttributionDimension>("coin");
  const dataChangedVersion = useDataChangedVersion();
  const rangeKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
  const data = loaded?.rangeKey === rangeKey ? loaded.result : null;

  useEffect(() => {
    let active = true;
    setStatus("loading");
    queryAttribution(dateRange).then((result) => {
      if (!active) return;
      setLoaded({ rangeKey, result });
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [rangeKey, dataChangedVersion]);

  const groups = useMemo(() => data ? groupAttribution(data.attribution.entries, dimension, data.aliases, t("profit.attribution.stock")) : [], [data, dimension, t]);
  const format = (value: number) => `${value > 0 ? "+" : value < 0 ? "-" : ""}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(value)))}`;
  const tone = (value: number) => positiveNegativeTextClass(value, quoteColor, 500);
  const barTone = (value: number) => positiveNegativeColor(value, quoteColor) === "green" ? "bg-emerald-500" : "bg-rose-500";
  const label = (key: string) => t(`profit.attribution.${key}`);
  const displayGroup = (group: { key: string; label: string }) =>
    (dimension === "source" || dimension === "wallet") && group.label === "unknown" ? t("common.unknown") : group.label;
  const error = <div role="alert" className="py-8 text-center text-sm text-muted-foreground">{label("error")}</div>;

  if (status === "loading" && !data) return <div role="status" aria-live="polite" className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (status === "error" && (!data || data.attribution.entries.length === 0)) return error;
  if (!data || data.attribution.entries.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{label("empty")}</p>;

  const totals = data.attribution.totals;
  const max = Math.max(...groups.map((group) => Math.abs(group.priceEffect)), 1);
  const contributors = groups.filter((group) => group.priceEffect > 0).sort((a, b) => b.priceEffect - a.priceEffect).slice(0, 5);
  const detractors = groups.filter((group) => group.priceEffect < 0).sort((a, b) => a.priceEffect - b.priceEffect).slice(0, 5);
  const bars = (items: typeof groups) => (
    items.length === 0 ? <p className="text-xs text-muted-foreground">{label("noMarketChange")}</p> :
    <ol className="space-y-2">
      {items.map((group) => (
        <li key={group.key} className="grid grid-cols-[minmax(5rem,1fr)_minmax(4rem,2fr)_auto] items-center gap-2 text-xs sm:text-sm">
          <span className="truncate font-medium" title={displayGroup(group)}>{displayGroup(group)}</span>
          <span className="h-2 rounded-full bg-muted" aria-hidden="true"><span className={`block h-full rounded-full ${barTone(group.priceEffect)}`} style={{ width: `${Math.abs(group.priceEffect) / max * 100}%` }} /></span>
          <span className={`min-w-[5.5rem] text-right tabular-nums ${tone(group.priceEffect)}`}>{format(group.priceEffect)}</span>
        </li>
      ))}
    </ol>
  );

  return <div className="space-y-4">
    {status === "error" && error}
    <p className="text-xs text-muted-foreground">{label("method")}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(["totalChange", "priceEffect", "flowEffect", "residual"] as const).map((key) => (
        <div key={key} className="min-w-0 rounded-md border border-border/50 bg-muted/20 p-2">
          <div className="text-xs text-muted-foreground">{label(key)}</div>
          <div className={`truncate text-sm font-semibold tabular-nums sm:text-base ${tone(totals[key])}`} title={format(totals[key])}>{format(totals[key])}</div>
        </div>
      ))}
    </div>
    <ButtonGroup value={dimension} onValueChange={(value) => setDimension(value as AttributionDimension)} aria-label={label("groupBy")} className="h-auto max-w-full flex-wrap justify-start gap-0.5">
      {dimensions.map((value) => <ButtonGroupItem key={value} value={value} className="touch:min-h-11 px-2 text-xs sm:px-3 sm:text-sm">{label(value)}</ButtonGroupItem>)}
    </ButtonGroup>
    <figure className="grid gap-4 sm:grid-cols-2" aria-label={label("chart")}>
      <section className="space-y-2"><h3 className="text-xs font-medium text-muted-foreground">{label("contributors")}</h3>{bars(contributors)}</section>
      <section className="space-y-2"><h3 className="text-xs font-medium text-muted-foreground">{label("detractors")}</h3>{bars(detractors)}</section>
    </figure>
    <div className="max-w-full overflow-x-auto rounded-md border border-border/50">
      <Table className="min-w-[580px] text-xs sm:text-sm">
        <caption className="sr-only">{label("table")}</caption>
        <TableHeader><TableRow>
          <TableHead>{label("group")}</TableHead>
          <TableHead className="text-right">{label("priceEffect")}</TableHead>
          <TableHead className="text-right">{label("flowEffect")}</TableHead>
          <TableHead className="text-right">{label("residual")}</TableHead>
          <TableHead className="text-right">{label("totalChange")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>{groups.map((group) => <TableRow key={group.key}>
          <TableCell className="max-w-[130px] truncate py-2 font-medium" title={displayGroup(group)}>{displayGroup(group)}</TableCell>
          {(["priceEffect", "flowEffect", "residual", "totalChange"] as const).map((key) => <TableCell key={key} className={`py-2 text-right tabular-nums ${tone(group[key])}`}>{format(group[key])}</TableCell>)}
        </TableRow>)}</TableBody>
      </Table>
    </div>
  </div>;
}
