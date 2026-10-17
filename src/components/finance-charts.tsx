import "chart.js/auto";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { useTranslation } from "@/i18n";
import { costBasisVisuals, goalVisuals, rebalanceVisuals } from "./finance-visuals";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import type { RebalanceResult } from "@/middlelayers/rebalance";
import type { AlertRule, AlertSnapshot } from "@/middlelayers/alerts";
import type { QuoteColor } from "@/middlelayers/types";
import type { Chart as ChartJS } from "chart.js";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { useTheme } from "./common/theme";

const palette = ["#6366f1", "#06b6d4", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899", "#94a3b8"];
const tone = (positive: boolean, quoteColor: QuoteColor) =>
  (positive === (quoteColor === "green-up-red-down")) ? "#10b981" : "#f43f5e";
function useChartOptions() {
  const { theme } = useTheme();
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const text = dark ? "#cbd5e1" : "#475569";
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false, labels: { color: text } }, datalabels: { display: false } },
    scales: {
      x: { ticks: { color: text }, grid: { color: dark ? "#ffffff1a" : "#00000012" } },
      y: { ticks: { color: text }, grid: { color: dark ? "#ffffff1a" : "#00000012" } },
    },
  };
}

function ChartPanel({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: boolean }) {
  const { t } = useTranslation();
  return <Card className="min-w-0">
    <CardHeader className="px-4 pb-1 pt-3"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
    <CardContent className="px-4 pb-4">
      {empty ? <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">{t("finance.noChartData")}</p>
        : <div className="relative h-44">{children}</div>}
    </CardContent>
  </Card>;
}

export function FinanceChartSkeleton() {
  const { t } = useTranslation();
  return <div role="status" className="space-y-3">
    <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    <div className="grid gap-3 lg:grid-cols-2">
      {[0, 1].map((index) => <Card key={index} aria-hidden="true">
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
          <Skeleton className="h-36 w-full motion-reduce:animate-none" />
        </CardContent>
      </Card>)}
    </div>
  </div>;
}

export function CostCharts({ report, quoteColor }: { report: CostBasisReport; quoteColor: QuoteColor }) {
  const { t } = useTranslation();
  const chartOptions = useChartOptions();
  const visual = costBasisVisuals(report, 8, t("finance.other"));
  return <>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { key: "cost.gainLoss", value: report.totals.gainLoss, rate: visual.rates.realized, rateKey: "finance.realizedReturn" },
        { key: "cost.shortTerm", value: report.totals.shortTerm, rate: visual.rates.shortTerm, rateKey: "finance.realizedShare" },
        { key: "cost.longTerm", value: report.totals.longTerm, rate: visual.rates.longTerm, rateKey: "finance.realizedShare" },
        { key: "finance.unrealizedPnl", value: visual.unrealized, rate: visual.rates.unrealized, rateKey: "finance.openReturn" },
      ].map(({ key, value, rate, rateKey }) => <Card key={key} className="min-w-0">
        <CardContent className="space-y-1 p-3">
          <p className="text-xs text-muted-foreground">{t(key)}</p>
          <p className="truncate text-lg font-semibold tabular-nums" style={{ color: value === 0 ? undefined : tone(value > 0, quoteColor) }}>
            {value > 0 ? "+" : ""}{value.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">{rate === null ? "—" : `${rate > 0 ? "+" : ""}${rate.toFixed(1)}%`} {t(rateKey)}</p>
        </CardContent>
      </Card>)}
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartPanel title={t("finance.realizedByAsset")} empty={!visual.gains.length}>
        <Bar aria-label={visual.gains.map((row) => `${row.label}: ${row.value.toFixed(2)} USD`).join("; ")}
          role="img" data={{ labels: visual.gains.map((row) => row.label), datasets: [{
            data: visual.gains.map((row) => row.value),
            backgroundColor: visual.gains.map((row) => tone(row.value >= 0, quoteColor)),
            borderRadius: 3,
          }] }} options={{ ...chartOptions, indexAxis: "y" as const }} />
      </ChartPanel>
      <ChartPanel title={t("finance.cumulativeGains")} empty={!visual.cumulative.length}>
        <Line aria-label={visual.cumulative.map((row) => `${row.date}: ${row.value.toFixed(2)} USD`).join("; ")}
          role="img" data={{ labels: visual.cumulative.map((row) => row.date), datasets: [{
            data: visual.cumulative.map((row) => row.value), borderColor: tone(true, quoteColor),
            backgroundColor: `${tone(true, quoteColor)}20`, fill: true, tension: 0.2, pointRadius: 2,
          }] }} options={chartOptions} plugins={[{
            id: "tax-year-markers",
            afterDraw(chart: ChartJS<"line">) {
              const { ctx, chartArea, scales } = chart;
              if (!chartArea) return;
              ctx.save();
              ctx.strokeStyle = "#94a3b8";
              ctx.fillStyle = "#64748b";
              ctx.font = "10px sans-serif";
              ctx.setLineDash([3, 3]);
              for (const marker of visual.taxYears) {
                const x = scales.x.getPixelForValue(marker.index);
                ctx.beginPath();
                ctx.moveTo(x, chartArea.top);
                ctx.lineTo(x, chartArea.bottom);
                ctx.stroke();
                ctx.fillText(marker.year, Math.min(x + 4, chartArea.right - 28), chartArea.top + 12);
              }
              ctx.restore();
            },
          }]} />
      </ChartPanel>
      <ChartPanel title={t("finance.costComposition")} empty={!visual.composition.length}>
        <div className="flex h-full min-w-0 items-center gap-3">
          <div className="relative h-full min-w-0 flex-1">
            <Doughnut aria-label={visual.composition.map((row) => `${row.label}: ${row.value.toFixed(2)} USD`).join("; ")}
              role="img" data={{ labels: visual.composition.map((row) => row.label), datasets: [{
                data: visual.composition.map((row) => row.value),
                backgroundColor: visual.composition.map((_, index) => palette[index % palette.length]),
                borderWidth: 0,
              }] }} options={{
                responsive: chartOptions.responsive, maintainAspectRatio: chartOptions.maintainAspectRatio,
                plugins: chartOptions.plugins, cutout: "72%",
              }} />
          </div>
          <ul className="max-h-full w-28 shrink-0 space-y-1 overflow-y-auto text-xs">
            {visual.composition.map((row, index) => <li key={row.label} className="flex items-center gap-1.5">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
              <span className="min-w-0 truncate" title={row.label}>{row.label}</span>
            </li>)}
          </ul>
        </div>
      </ChartPanel>
    </div>
  </>;
}

export function GoalChart({ rules, snapshots, portfolioValues = [] }: {
  rules: AlertRule[]; snapshots: AlertSnapshot[]; portfolioValues?: Array<{ date: string; value: number }>;
}) {
  const { t } = useTranslation();
  const chartOptions = useChartOptions();
  const visual = goalVisuals(rules, snapshots);
  const values = portfolioValues.length ? portfolioValues : visual.values;
  return <ChartPanel title={t("finance.portfolioAndGoals")} empty={!values.length}>
    <Line role="img" aria-label={values.map((row) => `${row.date}: ${row.value.toFixed(2)}`).join("; ")}
      data={{ labels: values.map((row) => row.date), datasets: [
        { label: t("finance.portfolioValue"), data: values.map((row) => row.value), borderColor: palette[0], backgroundColor: "#6366f120", fill: true, tension: 0.2, pointRadius: 1 },
        ...visual.goals.filter((goal) => goal.kind === "total_value_target").map((goal) => ({
          label: t("finance.goalThreshold"), data: values.map(() => goal.target),
          borderColor: palette[2], borderDash: [5, 4], pointRadius: 0,
        })),
      ] }} options={chartOptions} />
  </ChartPanel>;
}

export function RebalanceCharts({ result, quoteColor, tolerancePercent }: {
  result: RebalanceResult; quoteColor: QuoteColor; tolerancePercent: number;
}) {
  const { t } = useTranslation();
  const chartOptions = useChartOptions();
  const visual = rebalanceVisuals(result);
  return <div className="grid gap-3 lg:grid-cols-2">
    <ChartPanel title={t("finance.currentVsTarget")} empty={!visual.labels.length}>
      <Bar role="img" aria-label={visual.labels.map((label, index) => `${label}: ${visual.current[index].toFixed(1)}% ${t("rebalance.current")}, ${visual.target[index].toFixed(1)}% ${t("rebalance.target")}`).join("; ")}
        data={{ labels: visual.labels, datasets: [
          { label: t("rebalance.current"), data: visual.current, backgroundColor: palette[0] },
          { label: t("rebalance.target"), data: visual.target, backgroundColor: palette[1] },
        ] }} options={{ ...chartOptions, indexAxis: "y" as const, plugins: { ...chartOptions.plugins, legend: { display: true } } }} />
    </ChartPanel>
    <ChartPanel title={t("rebalance.deviations")} empty={!visual.labels.length}>
      <Bar role="img" aria-label={`${visual.labels.map((label, index) => `${label}: ${visual.deviations[index].toFixed(1)} ${t("rebalance.percentagePoints")}`).join("; ")}; ${t("finance.toleranceBand")} ±${tolerancePercent}%`}
        data={{ labels: visual.labels, datasets: [{
          data: visual.deviations,
          backgroundColor: visual.deviations.map((value) => tone(value >= 0, quoteColor)),
        }] }} options={{ ...chartOptions, indexAxis: "y" as const }}
        plugins={[{
          id: "tolerance-band",
          beforeDatasetsDraw(chart: ChartJS<"bar">) {
            if (tolerancePercent <= 0) return;
            const { ctx, chartArea, scales } = chart;
            if (!chartArea) return;
            const left = Math.max(chartArea.left, scales.x.getPixelForValue(-tolerancePercent));
            const right = Math.min(chartArea.right, scales.x.getPixelForValue(tolerancePercent));
            if (right <= left) return;
            ctx.save();
            ctx.fillStyle = "#94a3b830";
            ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
            ctx.restore();
          },
        }]} />
    </ChartPanel>
  </div>;
}
