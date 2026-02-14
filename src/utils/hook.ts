import { useEffect, useRef, useState } from 'react'
import { cleanTotalProfitCache } from '@/middlelayers/charts'
import { Menu, MenuItem } from '@tauri-apps/api/menu'

export const APP_SOFT_REFRESH_EVENT = "track3:soft-refresh"

type WindowSizeState = {
	width: number | undefined
	height: number | undefined
}

const windowSizeListeners = new Set<(state: WindowSizeState) => void>()
let cachedWindowSize: WindowSizeState = {
	width: undefined,
	height: undefined,
}
let detachWindowListener: (() => void) | undefined
let rightClickMenuPromise: Promise<Menu> | null = null
let softRefreshLocked = false
let lastSoftRefreshAt = 0

function emitWindowSize(state: WindowSizeState) {
	if (
		cachedWindowSize.width === state.width &&
		cachedWindowSize.height === state.height
	) {
		return
	}
	cachedWindowSize = state
	windowSizeListeners.forEach((listener) => listener(state))
}

function ensureWindowSizeListener() {
	if (detachWindowListener || typeof window === "undefined") {
		return
	}

	let frame = 0
	const handleResize = () => {
		if (frame) {
			cancelAnimationFrame(frame)
		}
		frame = requestAnimationFrame(() => {
			emitWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			})
			frame = 0
		})
	}

	handleResize()
	window.addEventListener("resize", handleResize)
	detachWindowListener = () => {
		if (frame) {
			cancelAnimationFrame(frame)
		}
		window.removeEventListener("resize", handleResize)
		detachWindowListener = undefined
	}
}

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
	const [windowSize, setWindowSize] = useState<WindowSizeState>(cachedWindowSize)

	useEffect(() => {
		ensureWindowSizeListener()
		windowSizeListeners.add(setWindowSize)
		setWindowSize(cachedWindowSize)
		return () => {
			windowSizeListeners.delete(setWindowSize)
			if (windowSizeListeners.size === 0) {
				detachWindowListener?.()
			}
		}
	}, [])

	return windowSize
}

export function handleReloadClick() {
	const now = Date.now()
	if (softRefreshLocked || now - lastSoftRefreshAt < 1200) {
		return
	}
	softRefreshLocked = true
	lastSoftRefreshAt = now
	cleanTotalProfitCache()
	window.dispatchEvent(new Event(APP_SOFT_REFRESH_EVENT))
	setTimeout(() => {
		softRefreshLocked = false
	}, 1200)
}

async function getRightClickMenu() {
	if (!rightClickMenuPromise) {
		rightClickMenuPromise = (async () => {
			const reload = await MenuItem.new({
				text: "Reload",
				action: handleReloadClick
			})
			return Menu.new({
				items: [reload],
			})
		})()
	}
	return rightClickMenuPromise
}

export async function renderRightClickMenu(event: React.MouseEvent) {
	event.preventDefault()
	event.stopPropagation()
	const menu = await getRightClickMenu()
	menu.popup()
}
