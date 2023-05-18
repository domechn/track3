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

	const cfgData = cfg.substring(prefix.length)

	const data = cfgData.split(",").map((v) => parseInt(v))
	
	// decrypt data
	return invoke("decrypt", { data }).then((res) => {
		const plainData = new TextDecoder("utf-8").decode(Uint8Array.from(res as number[]))
		return {
			...configurations[0],
			data: plainData,
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
	const byteData = [].slice.call(new TextEncoder().encode(data))
	const encryptedBytes = await invoke("encrypt", { data: byteData }) as number[]

	await db.execute(`INSERT OR REPLACE INTO configuration (id, data) VALUES (${fixId}, ?)`, [prefix + encryptedBytes.join(",")])
}
