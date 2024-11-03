import { fetch } from '@tauri-apps/plugin-http'
import _ from 'lodash'

export function getCurrentUA() {
	const userAgent = window.navigator.userAgent
	return userAgent
}

export async function sendHttpRequest<T>(method: string, url: string, timeout = 5000, headers = {}, json = {}, formData = {}): Promise<T> {
	// const client = await getClient()
	const hs: { [k: string]: string } = {
		"user-agent": getCurrentUA(),
		...headers,
	}
	if (!_(json).isEmpty()) {
		hs["content-type"] = "application/json"
	}
	const payload: RequestInit = {
		method,
		headers: hs,
		connectTimeout: timeout,
	} as any
	if (!_(json).isEmpty()) {
		payload.body = JSON.stringify(json)
	}
	if (!_(formData).isEmpty()) {
		const fd = new URLSearchParams()
		_(formData).forEach((v, k) => {
			fd.append(k, v)
		})
		payload.body = fd
	}

	const resp = await fetch(url, payload)
	if (resp.status > 299) {
		throw new Error(`Request failed with status ${resp.status}, message: ${await resp.text()}`)
	}
	return resp.json()
}
