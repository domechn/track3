import { HttpVerb, getClient } from '@tauri-apps/api/http'

export function getCurrentUA() {
	const userAgent = window.navigator.userAgent
	return userAgent
}

export async function sendHttpRequest<T>(method: HttpVerb, url: string, timeout = 5000, headers = {}) : Promise<T>{
	const client = await getClient()
	const resp = await client.request<T>({
		method,
		url,
		timeout,
		headers: {
			...headers,
			"user-agent": getCurrentUA(),
		},
	})
	if (resp.status > 299) {
		throw new Error(`Request failed with status ${resp.status}`)
	}
	return resp.data
}
