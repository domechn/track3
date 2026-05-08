import { Chart } from "chart.js";

// delay: ms
export async function resizeChartWithDelay(chartNameKey: string, delay = 100) {
  await new Promise((resolve) => setTimeout(resolve, delay));
  return resizeChart(chartNameKey);
}

export function resizeChart(chartNameKey: string) {
  for (const id in Chart.instances) {
    const text = Chart.instances[id].options.plugins?.title?.text as
      | string
      | undefined;
    if (text?.startsWith(chartNameKey)) {
      Chart.instances[id].resize();
      break;
    }
  }
}
