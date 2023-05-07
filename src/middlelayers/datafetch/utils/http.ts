import { HttpVerb, getClient } from '@tauri-apps/api/http'

export function getCurrentUA() {
	const userAgent = window.navigator.userAgent
	console.log(userAgent)

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
		}
	})
	return resp.data
}
