import * as api from '@tauri-apps/api'
import { getClientIDConfiguration } from '../middlelayers/configuration'
import { trackEvent } from '@aptabase/tauri'
import { appCacheDir } from "@tauri-apps/api/path"
import { convertFileSrc } from "@tauri-apps/api/tauri"

export async function getVersion() {
	return api.app.getVersion()
}

export async function getClientID() {
	return getClientIDConfiguration()
}


export async function trackEventWithClientID(event: string, props?: { [k: string]: string | number }) {
	const cid = await getClientID()
	try {
		await trackEvent(event, {
			clientID: cid || "unknown",
			...(props ?? {})
		})
	} catch (e) {
		console.error("track event failed", e)
	}
}

export function getImageApiPath(cacheDir: string, symbol: string) {
	const filePath = `${cacheDir}assets/coins/${symbol.toLowerCase()}.png`
	return convertFileSrc(filePath)
}
