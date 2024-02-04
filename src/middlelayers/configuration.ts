import { invoke } from '@tauri-apps/api'
import { getDatabase } from './database'
import { GlobalConfig } from './datafetch/types'
import { ConfigurationModel, CurrencyRateDetail } from './types'
import yaml from 'yaml'
import { CURRENCY_RATE_HANDLER } from './entities/currency'
import { ASSET_HANDLER } from './entities/assets'
import _ from 'lodash'
import { DateRange } from 'react-day-picker'

// todo: update to dedicated domain
export const PRO_API_ENDPOINT = 'https://track3-pro-api.domc.me'

const prefix = "!ent:"
const fixId = "1"
// deprecated: cloud sync function has been removed
const cloudSyncFixId = "2"

const autoBackupId = "3"
const lastAutoBackupAtId = "4"
const lastAutoImportAtId = "5"
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

export async function getInitialQueryDateRange(): Promise<DateRange> {
	const cfg = await getConfiguration()
	let size = 10
	if (cfg?.configs.querySize) {
		size = cfg.configs.querySize
	}

	const days = await ASSET_HANDLER.getHasDataCreatedAtDates(size)
	const from = _(days).min()
	const to = _(days).max()

	return {
		from,
		to,
	}

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

// license
export async function saveLicense(license: string) {
	return saveConfigurationById(licenseFixId, license)
}

// license
export async function cleanLicense() {
	return deleteConfigurationById(licenseFixId)
}

// auto backup
export async function getAutoBackupDirectory(): Promise<string | undefined> {
	return getConfigurationModelById(autoBackupId).then(m => m?.data)
}

// auto backup
export async function saveAutoBackupDirectory(d: string) {
	return saveConfigurationById(autoBackupId, d, false)
}

// auto backup
export async function cleanAutoBackupDirectory() {
	return deleteConfigurationById(autoBackupId)
}

// if user has pro license, return license string
export async function getLicenseIfIsPro(): Promise<string | undefined> {
	const model = await getConfigurationById(licenseFixId)
	return model?.data
}

// get last auto backup time, if never backup, return 1970-01-01
export async function getLastAutoBackupAt(): Promise<Date> {
	const model = await getConfigurationById(lastAutoBackupAtId)
	return model?.data ? new Date(model.data) : new Date("1970-01-01T00:00:00.000Z")
}

// if d is undefined, use latest time
export async function saveLastAutoBackupAt(d?: Date) {
	return saveConfigurationById(lastAutoBackupAtId, d ? d.toISOString() : new Date().toISOString(), false)
}

// get last auto import time, if never backup, return 1970-01-01
export async function getAutoImportAt(): Promise<Date> {
	const model = await getConfigurationById(lastAutoImportAtId)
	return model?.data ? new Date(model.data) : new Date("1970-01-01T00:00:00.000Z")
}

// if d is undefined, use latest time
export async function saveAutoImportAt(d?: Date) {
	return saveConfigurationById(lastAutoImportAtId, d ? d.toISOString() : new Date().toISOString(), false)
}
