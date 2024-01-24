import { invoke } from '@tauri-apps/api'
import { getDatabase } from './database'
import { GlobalConfig } from './datafetch/types'
import { CloudSyncConfiguration, ConfigurationModel, CurrencyRateDetail } from './types'
import yaml from 'yaml'
import { CURRENCY_RATE_HANDLER } from './entities/currency'

const prefix = "!ent:"
const fixId = "1"
const cloudSyncFixId = "2"
const clientInfoFixId = "998"
const licenseFixId = "997"

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
export async function importRawConfiguration(data: string) {
	await saveConfigurationById(fixId, data, false)
}

export async function getCloudSyncConfiguration(): Promise<ConfigurationModel | undefined> {
	return getConfigurationById(cloudSyncFixId)
}

export async function saveCloudSyncConfiguration(cfg: CloudSyncConfiguration) {
	const data = yaml.stringify(cfg)

	await saveConfigurationById(cloudSyncFixId, data)
}

async function saveConfigurationById(id: string, cfg: string, encrypt = true) {
	const db = await getDatabase()
	// encrypt data
	const saveStr = encrypt ? await invoke<string>("encrypt", { data: cfg }) : cfg

	await db.execute(`INSERT OR REPLACE INTO configuration (id, data) VALUES (${id}, ?)`, [saveStr])
}

async function deleteConfigurationById(id: string) {
	const db = await getDatabase()
	await db.execute(`DELETE FROM configuration WHERE id = ?`, [id])
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

export async function updateAllCurrencyRates() {
	return CURRENCY_RATE_HANDLER.updateAllCurrencyRates()
}

export async function listAllCurrencyRates() {
	return CURRENCY_RATE_HANDLER.listCurrencyRates()
}

export function getDefaultCurrencyRate() {
	return CURRENCY_RATE_HANDLER.getDefaultCurrencyRate()
}

export async function getCurrentPreferCurrency(): Promise<CurrencyRateDetail> {
	const cfg = await getConfiguration()
	if (!cfg) {
		return CURRENCY_RATE_HANDLER.getDefaultCurrencyRate()
	}

	const pc: string = cfg.configs.preferCurrency
	if (!pc) {
		return CURRENCY_RATE_HANDLER.getDefaultCurrencyRate()
	}

	return CURRENCY_RATE_HANDLER.getCurrencyRateByCurrency(pc)
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

export async function saveLicense(license: string) {
	return saveConfigurationById(licenseFixId, license)
}

export async function cleanLicense() {
	return deleteConfigurationById(licenseFixId)
}

// if user has pro license, return license string
export async function getLicenseIfIsPro(): Promise<string | undefined> {
	const model = await getConfigurationById(licenseFixId)
	return model?.data
}
