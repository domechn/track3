import { HttpVerb, getClient, Body, HttpOptions } from '@tauri-apps/api/http'
import _ from 'lodash'

export function getCurrentUA() {
	const userAgent = window.navigator.userAgent
	return userAgent
}

export async function sendHttpRequest<T>(method: HttpVerb, url: string, timeout = 5000, headers = {}, json = {}): Promise<T> {
	const client = await getClient()
	const hs: { [k: string]: string } = {
		"user-agent": getCurrentUA(),
		...headers,
	}
	if (!_(json).isEmpty()) {
		hs["content-type"] = "application/json"
	}
	const payload = {
		method,
		url,
		timeout,
		headers: hs,
	} as HttpOptions
	if (!_(json).isEmpty()) {
		payload.body = Body.json(json)
	}
	const resp = await client.request<T>(payload)

	if (resp.status > 299) {
		throw new Error(`Request failed with status ${resp.status}, message: ${JSON.stringify(resp.data)}`)
	}
	return resp.data
}
