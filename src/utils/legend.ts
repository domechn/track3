import { Point, BubbleDataPoint } from 'chart.js'
import _ from 'lodash'
import { ChartJSOrUndefined } from 'react-chartjs-2/dist/types'

export function legendOnClick(legendSize: number, chart: ChartJSOrUndefined<"line", (number | [number, number] | Point | BubbleDataPoint | null)[], unknown> | null) {
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
