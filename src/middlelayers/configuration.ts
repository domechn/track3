import { invoke } from '@tauri-apps/api'
import { getDatabase } from './database'
import { GlobalConfig } from './datafetch/types'
import { CloudSyncConfiguration, ConfigurationModel, CurrencyRateDetail } from './types'
import yaml from 'yaml'
import { getCurrencyRate, getDefaultCurrencyRate } from './currency'

const prefix = "!ent:"
const fixId = "1"
const cloudSyncFixId = "2"
const clientInfoFixId = "998"

export async function getConfiguration(): Promise<GlobalConfig | undefined> {
	const model = await getConfigurationById(fixId)
	if (!model) {
		return
	}

	const data = yaml.parse(model.data)
	return data
}

export async function saveConfiguration(cfg: GlobalConfig) {
	// validate data is yaml
	const data = yaml.stringify(cfg)

	await saveConfigurationById(fixId, data)
}

// used for import data
export async function saveRawConfiguration(data: string) {
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

export async function exportConfigurationString(): Promise<string | undefined> {
	const model = await getConfigurationModelById(fixId)
	return model?.data
}

async function getConfigurationById(id: string): Promise<ConfigurationModel | undefined> {
	const model = await getConfigurationModelById(id)
	if (!model) {
		return
	}

	const cfg = model.data

	// legacy logic
	if (!cfg.startsWith(prefix)) {
		return model
	}

	// decrypt data
	return invoke<string>("decrypt", { data: cfg }).then((res) => {
		return {
			...model,
			data: res,
		}

	}).catch((err) => {
		if (err.includes("not ent")) {
			return model
		}
		throw err
	})
}

export async function getQuerySize(): Promise<number> {
	const cfg = await getConfiguration()
	if (!cfg) {
		return 10
	}

	return cfg.configs.querySize || 10
}

export async function getCurrentPreferCurrency(): Promise<CurrencyRateDetail> {
	const cfg = await getConfiguration()
	if (!cfg) {
		return getDefaultCurrencyRate()
	}

	const pc: string = cfg.configs.preferCurrency
	if (!pc) {
		return getDefaultCurrencyRate()
	}

	return getCurrencyRate(pc)
}

export async function getClientIDConfiguration(): Promise<string | undefined> {
	const model = await getConfigurationById(clientInfoFixId)
	return model?.data
}

async function getConfigurationModelById(id: string): Promise<ConfigurationModel | undefined> {
	const db = await getDatabase()
	const configurations = await db.select<ConfigurationModel[]>(`SELECT * FROM configuration where id = ${id}`)
	if (configurations.length === 0) {
		return undefined
	}

	return configurations[0]
}
