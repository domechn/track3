import * as api from '@tauri-apps/api'
import { getClientIDConfiguration } from '../middlelayers/configuration'
import { trackEvent } from '@aptabase/tauri'

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