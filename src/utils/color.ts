import _, { random } from 'lodash'
import ColorDiff from 'color-diff'

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

export function generateRandomColors(size: number): { R: number; G: number; B: number }[] {
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
