import { invoke } from '@tauri-apps/api'
import { getDatabase } from './database'
import { GlobalConfig } from './datafetch/types'
import { CloudSyncConfiguration, ConfigurationModel, CurrencyRateDetail } from './types'
import yaml from 'yaml'
import { getCurrencyRate, getDefaultCurrencyRate } from './currency'

const prefix = "!ent:"
const fixId = "1"
const cloudSyncFixId = "2"

export async function getConfiguration(): Promise<ConfigurationModel | undefined> {
	return getConfigurationById(fixId)
}

export async function saveConfiguration(cfg: GlobalConfig) {
	// validate data is yaml
	const data = yaml.stringify(cfg)

	await saveConfigurationById(fixId, data)
}

export async function getCloudSyncConfiguration(): Promise<ConfigurationModel | undefined> {
	return getConfigurationById(cloudSyncFixId)
}

export async function saveCloudSyncConfiguration(cfg: CloudSyncConfiguration) {
	const data = yaml.stringify(cfg)

	await saveConfigurationById(cloudSyncFixId, data)
}

async function saveConfigurationById(id: string, cfg: string) {
	const db = await getDatabase()
	// encrypt data
	const encrypted = await invoke<string>("encrypt", { data: cfg })

	await db.execute(`INSERT OR REPLACE INTO configuration (id, data) VALUES (${id}, ?)`, [encrypted])
}

async function getConfigurationById(id: string): Promise<ConfigurationModel | undefined> {
	const db = await getDatabase()
	const configurations = await db.select<ConfigurationModel[]>(`SELECT * FROM configuration where id = ${id}`)
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

export async function getQuerySize(): Promise<number> {
	const cfg = await getConfiguration()
	if (!cfg) {
		return 10
	}

	const data = yaml.parse(cfg.data)
	return data.configs.querySize || 10
}

export async function getCurrentPreferCurrency() : Promise<CurrencyRateDetail> {
	const model = await getConfiguration()
	if (!model) {
		return getDefaultCurrencyRate()
	}

	const pc: string = yaml.parse(model.data).configs.preferCurrency 
	if (!pc) {
		return getDefaultCurrencyRate()
	}

	return getCurrencyRate(pc)
}
