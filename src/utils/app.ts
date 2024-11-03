import * as api from '@tauri-apps/api'
import { getClientIDConfiguration } from '../middlelayers/configuration'
// import { trackEvent } from '@aptabase/tauri'
import { exists } from '@tauri-apps/plugin-fs'
import { convertFileSrc } from "@tauri-apps/api/core"
import { relaunch } from "@tauri-apps/plugin-process"

export async function getVersion() {
	return api.app.getVersion()
}

export async function getClientID() {
	return getClientIDConfiguration()
}


export async function trackEventWithClientID(event: string, props?: { [k: string]: string | number }) {
	const cid = await getClientID()
	try {
		// await trackEvent(event, {
		// 	clientID: cid || "unknown",
		// 	...(props ?? {})
		// })
	} catch (e) {
		console.error("track event failed", e)
	}
}

export async function getImageApiPath(cacheDir: string, symbol: string) {
	const filePath = `${cacheDir}/assets/coins/${symbol.toLowerCase()}.png`

	// check if file exists
	return exists(filePath).then((res) => {
		if (!res) {
			// return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${symbol.toLowerCase()}.png`
			return ""
		}
		return convertFileSrc(filePath)
	})
}

export function reloadApp() {
	return relaunch()
}
