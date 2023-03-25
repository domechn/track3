import * as fs from 'fs/promises'
import _, { random, size } from 'lodash'
import { ChartCallback, ChartJSNodeCanvas } from 'chartjs-node-canvas'
import { ChartConfiguration, Chart } from 'chart.js'
import ChartDataLabels, { Context } from 'chartjs-plugin-datalabels'
import ColorDiff from 'color-diff'

interface Datum {
	label: string
	value: number
}

function generateRandomColor(): { R: number; G: number; B: number } {
	let r = random(0, 255)
	let g = random(0, 255)
	let b = random(0, 255)
	// Check the color's brightness
	let brightness = Math.sqrt(0.299 * r ** 2 + 0.587 * g ** 2 + 0.114 * b ** 2)
	// Limit the brightness range
	if (brightness < 130) {
		brightness = random(130, 255)
	}
	// Check for clashing colors
	if (r > 200 && g > 200 && b > 200) {
		r = random(0, 200)
		g = random(0, 200)
		b = random(0, 200)
	}
	return {
		R: r,
		G: g,
		B: b
	}
}

function generateRandomColors(size: number): { R: number; G: number; B: number }[] {
	let colors = []
	let lastColor: { R: number; G: number; B: number } | null = null
	for (let i = 0; i < size; i++) {
		let color
		do {
			color = generateRandomColor()
		} while (lastColor && ColorDiff.diff(ColorDiff.rgb_to_lab(lastColor), ColorDiff.rgb_to_lab(color)) < 20)
		colors.push(color)
		lastColor = color
	}
	return colors
}


export async function drawDoughnut(data: Datum[], width: number, height: number, savePath: string, title?: string) {
	let newData = []
	// only keep top 10
	if (data.length > 10) {
		newData = _(data).sortBy('value').reverse().take(10).value()
		newData.push({
			label: 'Others',
			value: _(data).sumBy('value') - _(newData).sumBy('value')
		})
	} else {
		newData = data
	}
	const bgColor = _(generateRandomColors(_(newData).size())).map(color => `rgba(${color.R}, ${color.G}, ${color.B}, 1)`).value()

	const totalValue = _(newData).sumBy('value')
	const isSmall = height < 300
	const labelFontSize = isSmall ? height / 25 :undefined
	const labelBoxSize = isSmall ? height / 10 : undefined
	const dataLabelFontSize = isSmall ? height / 35 : undefined

	Chart.register(ChartDataLabels)
	const configuration: ChartConfiguration = {
		type: 'doughnut',
		data: {
			labels: _(newData).map('label').value(),
			datasets: [{
				// label: '# of Votes',
				data: _(newData).map('value').value(),
				backgroundColor: bgColor,
				borderColor: bgColor,
				borderWidth: 1
			}],
		},
		options: {
			plugins: {
				title: {
					display: !!title,
					text: title
				},
				legend: {
					labels: {
						boxWidth: labelBoxSize,
						font: {
							size: labelFontSize,
						}
					}
				},
				datalabels: {
					// anchor:'end',
					color: 'white',
					font: {
						weight: 'bold',
						size: dataLabelFontSize,
					},
					display: 'auto',
					// offset: 20,
					formatter: function (value: number, context: Context) {
						const label = context.chart.data.labels![context.dataIndex] as string
						return label + ":" + Math.round((value / totalValue) * 10000) / 100 + '%'
					}
				}
			}
		},
		plugins: [{
			id: 'background-color',
			beforeDraw: (chart) => {
				const ctx = chart.ctx
				ctx.save()
				ctx.fillStyle = 'white'
				ctx.fillRect(0, 0, width, height)
				ctx.restore()
			}
		}]
	}
	type NewType = ChartCallback

	const chartCallback: NewType = (ChartJS) => {
		ChartJS.defaults.responsive = true
		ChartJS.defaults.maintainAspectRatio = false
	}
	const chartJSNodeCanvas = new ChartJSNodeCanvas({ type: 'svg', width, height, chartCallback, plugins: { modern: ['chartjs-plugin-datalabels'] } })
	// For some unknown reason canvas requires use of the sync API's to use SVG's or PDF's. This libraries which support these are
	const buffer = chartJSNodeCanvas.renderToBufferSync(configuration)
	await fs.writeFile(savePath, buffer, 'base64')
}
