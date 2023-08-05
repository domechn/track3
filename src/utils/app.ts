import * as api from '@tauri-apps/api'
import { getClientIDConfiguration } from '../middlelayers/configuration'

export async function getVersion() {
	return api.app.getVersion()
}

export async function getClientID() {
	return getClientIDConfiguration()
}
