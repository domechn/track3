import { useEffect, useRef, useState } from 'react'
import { cleanTotalProfitCache } from '@/middlelayers/charts'
import { Menu, MenuItem } from '@tauri-apps/api/menu'

export const useBeforeRender = (callback: () => unknown, deps: any) => {
	const [isRun, setIsRun] = useState(false)

	if (!isRun) {
		callback()
		setIsRun(true)
	}

	useEffect(() => () => setIsRun(false), deps)
}

export const useComponentWillMount = (cb: () => unknown) => {
	const willMount = useRef(true)

	if (willMount.current) cb()

	willMount.current = false
}

export const useWindowSize = () => {
	// Initialize state with undefined width/height so server and client renders match
	// Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
	const [windowSize, setWindowSize] = useState({
		width: undefined,
		height: undefined,
	} as {
		width: number | undefined
		height: number | undefined
	})
	useEffect(() => {
		// Handler to call on window resize
		function handleResize() {
			// Set window width/height to state
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			})
		}
		// Add event listener
		window.addEventListener("resize", handleResize)
		// Call handler right away so state gets updated with initial window size
		handleResize()
		// Remove event listener on cleanup
		return () => window.removeEventListener("resize", handleResize)
	}, []) // Empty array ensures that effect is only run on mount
	return windowSize
}

export function handleReloadClick() {
	cleanTotalProfitCache()
	location.reload()
}

export async function renderRightClickMenu(event: React.MouseEvent) {
	event.preventDefault()
	const reload = await MenuItem.new({
		text: "Reload",
		action: handleReloadClick
	})
	const menu = await Menu.new({
		items: [reload],
	})
	menu.popup()
}
