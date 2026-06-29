import { Bar, Doughnut, Line, Radar } from "react-chartjs-2";
import type { ChartSpec } from "@/middlelayers/types";

const chartOptions = {
  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    legend: { display: true, position: "bottom" as const },
    datalabels: { display: false },
  },
};

function buildData(spec: ChartSpec) {
  return {
    labels: spec.labels,
    datasets: spec.datasets,
  };
}

export default function InlineChart({ spec }: { spec: ChartSpec }) {
  const data = buildData(spec);
  const options = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: spec.title
        ? { display: true, text: spec.title, font: { size: 13 } }
        : { display: false },
    },
  };

  return (
    <div className="my-3 rounded-lg border border-[var(--glass-border)] bg-card/50 p-3 sm:p-4">
      {spec.title ? (
        <div className="mb-2 text-sm font-medium leading-snug text-foreground">
          {spec.title}
        </div>
      ) : null}
      <div className="h-[240px] w-full sm:h-[280px] lg:h-[320px]">
        {spec.type === "bar" && <Bar options={options as any} data={data} />}
        {spec.type === "line" && (
          <Line options={options as any} data={data} />
        )}
        {spec.type === "doughnut" && (
          <Doughnut options={options as any} data={data} />
        )}
        {spec.type === "radar" && (
          <Radar options={options as any} data={data} />
        )}
      </div>
      {spec.caption && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{spec.caption}</p>
      )}
    </div>
  );
}
