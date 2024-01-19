import { Point, BubbleDataPoint } from 'chart.js'
import _ from 'lodash'
import { ChartJSOrUndefined } from 'react-chartjs-2/dist/types'

export function hideOtherLinesClickWrapper(legendSize: number, chart: ChartJSOrUndefined<"line", (number | [number, number] | Point | BubbleDataPoint | null)[], unknown> | null) {
	return (e: any, legendItem: { datasetIndex: number }, legend: any) => {
		const idx = legendItem.datasetIndex
		if (!chart) {
			return
		}
		const arc = chart.getDatasetMeta(idx)
		// always set arc shown if user clicks on it
		arc.hidden = false

		const maxLegend = legendSize

		const currentHidden = _(_.range(maxLegend))
			.filter((i) => i !== idx)
			.map((i) => chart.getDatasetMeta(i))
			.map((m) => m.hidden)
			.every((h) => !!h)

		for (let i = 0; i < maxLegend; i++) {
			const other = chart.getDatasetMeta(i)
			if (i !== idx) {
				other.hidden = !currentHidden
			}
		}
		chart.update()
	}
}

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
