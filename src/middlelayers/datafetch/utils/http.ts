import { HttpVerb, getClient, Body } from '@tauri-apps/api/http'
import _ from 'lodash'

export function getCurrentUA() {
	const userAgent = window.navigator.userAgent
	return userAgent
}

export async function sendHttpRequest<T>(method: HttpVerb, url: string, timeout = 5000, headers = {}, json = {}): Promise<T> {
	const client = await getClient()
	const hs: { [k: string]: string } = {
		...headers,
		"user-agent": getCurrentUA(),
	}
	if (!_(json).isEmpty()) {
		hs["content-type"] = "application/json"
	}
	const resp = await client.request<T>({
		method,
		url,
		timeout,
		headers: hs,
		body: Body.json(json),
	})
	if (resp.status > 299) {
		throw new Error(`Request failed with status ${resp.status}`)
	}
	return resp.data
}
