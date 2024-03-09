import _ from 'lodash'
import { diff, rgb_to_lab } from 'color-diff'
import { QuoteColor } from '@/middlelayers/types'

const niceColors = [
	"rgba(122, 51, 255, 1)",
	"rgba(250, 215, 90, 1)",
	"rgba(51, 204, 255, 1)",
	"rgba(240, 114, 91, 1)",
	"rgba(39, 121, 242, 1)",
	"rgba(242, 97, 168, 1)",
	"rgba(137, 226, 145, 1)",
	"rgba(255, 215, 56, 1)",
	"rgba(0, 114, 178, 1)",
	"rgba(122, 175, 8, 1)",
	"rgba(79, 163, 252, 1)",
]

function generateRandomColor(): { R: number; G: number; B: number } {
	let r = _.random(0, 255)
	let g = _.random(0, 255)
	let b = _.random(0, 255)
	// Check the color's brightness
	let brightness = Math.sqrt(0.299 * r ** 2 + 0.587 * g ** 2 + 0.114 * b ** 2)
	// Limit the brightness range
	if (brightness < 130) {
		brightness = _.random(130, 255)
	}
	// Check for clashing colors
	if (r > 200 && g > 200 && b > 200) {
		r = _.random(0, 200)
		g = _.random(0, 200)
		b = _.random(0, 200)
	}
	return {
		R: r,
		G: g,
		B: b
	}
}

export function generateRandomColors(size: number): { R: number; G: number; B: number }[] {
	// pick colors from niceColors first
	if (size <= niceColors.length) {
		return niceColors.slice(0, size).map((color) => {
			const [r, g, b] = color.slice("rgba(".length, -1).split(",").map((v) => parseInt(v.trim()))
			return {
				R: r,
				G: g,
				B: b
			}
		})
	}

	let colors = niceColors.map((color) => {
		const [r, g, b] = color.slice("rgba(".length, -1).split(",").map((v) => parseInt(v.trim()))
		return {
			R: r,
			G: g,
			B: b
		}
	})
	let lastColor: { R: number; G: number; B: number } | null = colors[colors.length - 1]
	for (let i = 0; i < size - niceColors.length; i++) {
		let color
		do {
			color = generateRandomColor()
		} while (lastColor && diff(rgb_to_lab(lastColor), rgb_to_lab(color)) < 20)
		colors.push(color)
		lastColor = color
	}
	return colors
}

export function positiveNegativeColor(val: number, quoteColor: QuoteColor = 'green-up-red-down') {
	if (val === 0) {
		return "gray"
	} else if (val > 0) {
		return quoteColor === 'green-up-red-down' ? "green" : "red"
	} else {
		return quoteColor === 'green-up-red-down' ? "red" : "green"
	}
}
