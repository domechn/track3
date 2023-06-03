import { invoke } from '@tauri-apps/api'
import { getDatabase } from './database'
import { GlobalConfig } from './datafetch/types'
import { ConfigurationModel } from './types'
import yaml from 'yaml'

const prefix = "!ent:"
const fixId = "1"

export async function getConfiguration(): Promise<ConfigurationModel | undefined> {
	const db = await getDatabase()
	const configurations = await db.select<ConfigurationModel[]>(`SELECT * FROM configuration where id = ${fixId}`)
	if (configurations.length === 0) {
		return undefined
	}

	const cfg = configurations[0].data

	// legacy logic
	if (!cfg.startsWith(prefix)) {
		return configurations[0]
	}

	// decrypt data
	return invoke<string>("decrypt", { data: cfg }).then((res) => {
		return {
			...configurations[0],
			data: res,
		}

	}).catch((err) => {
		if (err.includes("not ent")) {
			return configurations[0]
		}
		throw err
	})
}

export async function saveConfiguration(cfg: GlobalConfig) {
	// validate data is yaml
	const data = yaml.stringify(cfg)

	const db = await getDatabase()
	// encrypt data
	const encrypted = await invoke<string>("encrypt", { data })

	await db.execute(`INSERT OR REPLACE INTO configuration (id, data) VALUES (${fixId}, ?)`, [encrypted])
}

export async function getQuerySize(): Promise<number> {
	const cfg = await getConfiguration()
	if (!cfg) {
		return 10
	}

	const data = yaml.parse(cfg.data)
	return data.configs.querySize || 10
}