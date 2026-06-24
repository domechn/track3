import { ChartJSOrUndefined } from 'react-chartjs-2/dist/types'

export function offsetHoveredItemWrapper(chart: ChartJSOrUndefined<"pie", string[], unknown> | ChartJSOrUndefined<"doughnut", number[], unknown> | null) {
	return (e: any, legendItem: { index: number }, legend: any) => {
		const idx = legendItem.index
		if (!chart) {
			return
		}

		// set offset
		chart.setActiveElements([
			{
				datasetIndex: 0,
				index: idx,
			}
		])

		// set tooltip
		const tooltip = chart.tooltip
		if (!tooltip) {
			chart.update()
			return
		}
		const chartArea = chart.chartArea
		tooltip.setActiveElements([
			{
				datasetIndex: 0,
				index: idx,
			}
		], {
			x: (chartArea.left + chartArea.right) / 2,
			y: (chartArea.top + chartArea.bottom) / 2,
		})
		chart.update()
	}
}
