import { invoke } from "@tauri-apps/api/core"
import { getDatabase } from './database'
import { GlobalConfig } from './datafetch/types'
import { ConfigurationModel, CurrencyRateDetail } from './types'
import yaml from 'yaml'
import { CURRENCY_RATE_HANDLER } from './entities/currency'
import { ASSET_HANDLER } from './entities/assets'
import _ from 'lodash'
import { DateRange } from 'react-day-picker'
import { Theme } from '@/components/common/theme'

// todo: update to dedicated domain
export const PRO_API_ENDPOINT = 'https://track3-pro-api.domc.me'

const prefix = "!ent:"
const generalFixId = "1"

const exchangesConfigId = "10"
const walletsConfigId = "11"
const generalConfigId = "12"

const walletKeys = ['btc', 'erc20', 'sol', 'doge', 'trc20', 'ton', 'sui'] as const

const autoBackupId = "3"
const lastAutoBackupAtId = "4"
const lastAutoImportAtId = "5"
const querySizeId = "6"
const preferCurrencyId = "7"
const quoteColorId = "8"
const clientInfoFixId = "998"
const licenseFixId = "997"
const stableCoinsId = "996"

export const themeLocalStorageKey = "track3-ui-theme"

export async function getConfiguration(): Promise<GlobalConfig | undefined> {
	const [exchangesModel, walletsModel, generalModel] = await Promise.all([
		getConfigurationById(exchangesConfigId),
		getConfigurationById(walletsConfigId),
		getConfigurationModelById(generalConfigId),
	])

	// new-format exists: merge and return
	if (exchangesModel || walletsModel || generalModel) {
		const exchanges = exchangesModel ? yaml.parse(exchangesModel.data) : { exchanges: [] }
		const wallets = walletsModel ? yaml.parse(walletsModel.data) : {}
		const general = generalModel ? yaml.parse(generalModel.data) : { configs: { groupUSD: false }, others: [] }

		return {
			...exchanges,
			...wallets,
			...general,
		} as GlobalConfig
	}

	// fallback: legacy id=1
	const legacyModel = await getConfigurationById(generalFixId)
	if (!legacyModel) {
		return
	}

	const cfg = yaml.parse(legacyModel.data) as GlobalConfig
	await migrateConfigurationToSplit(cfg)
	return cfg
}

export async function saveConfiguration(cfg: GlobalConfig) {
	const exchangesData = yaml.stringify({ exchanges: cfg.exchanges })
	const walletsData = yaml.stringify(_.pick(cfg, walletKeys))
	const generalData = yaml.stringify({ configs: cfg.configs, others: cfg.others })

	await Promise.all([
		saveConfigurationById(exchangesConfigId, exchangesData),
		saveConfigurationById(walletsConfigId, walletsData),
		saveConfigurationById(generalConfigId, generalData, false),
	])
}

// used for import data
export async function importRawConfiguration(data: string) {
	let raw = data
	if (raw.startsWith(prefix)) {
		raw = await invoke<string>("decrypt", { data: raw })
	}
	const cfg = yaml.parse(raw) as GlobalConfig
	await saveConfiguration(cfg)
	await deleteConfigurationById(generalFixId)
}

async function migrateConfigurationToSplit(cfg: GlobalConfig) {
	await saveConfiguration(cfg)
	await deleteConfigurationById(generalFixId)
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
	const cfg = await getConfiguration()
	if (!cfg) {
		return
	}
	const data = yaml.stringify(cfg)
	return invoke<string>("encrypt", { data })
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

export async function getInitialQueryDateRange(): Promise<{
	size: number,
	dr: DateRange
}> {
	const size = await queryQuerySize()

	const days = await ASSET_HANDLER.getHasDataCreatedAtDates(size)
	const from = _(days).min()
	const to = _(days).max()

	return {
		size,
		dr: {
			from,
			to,
		}
	}
}

export async function queryQuerySize(): Promise<number> {
	const model = await getConfigurationById(querySizeId)
	return model?.data ? parseInt(model.data) : 10
}

export async function saveQuerySize(size: number) {
	await saveConfigurationById(querySizeId, size.toString(), false)
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

export async function queryPreferCurrency(): Promise<CurrencyRateDetail> {
	const model = await getConfigurationById(preferCurrencyId)
	const pc = model?.data

	if (!pc) {
		return CURRENCY_RATE_HANDLER.getDefaultCurrencyRate()
	}

	return CURRENCY_RATE_HANDLER.getCurrencyRateByCurrency(pc)
}

export async function savePreferCurrency(currency: string) {
	await saveConfigurationById(preferCurrencyId, currency, false)
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

export async function getStableCoins(): Promise<string[]> {
	const model = await getConfigurationById(stableCoinsId)
	return model?.data ? model.data.split(',') : []
}

export async function saveStableCoins(stableCoins: string[]) {
	return saveConfigurationById(stableCoinsId, stableCoins.join(','), false)
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
export async function getLastAutoImportAt(): Promise<Date> {
	const model = await getConfigurationById(lastAutoImportAtId)
	return model?.data ? new Date(model.data) : new Date("1970-01-01T00:00:00.000Z")
}

// if d is undefined, use latest time
export async function saveLastAutoImportAt(d?: Date) {
	return saveConfigurationById(lastAutoImportAtId, d ? d.toISOString() : new Date().toISOString(), false)
}

export async function saveQuoteColor(qc: 'green-up-red-down' | 'red-up-green-down') {
	const val = qc === 'green-up-red-down' ? 0 : 1

	return saveConfigurationById(quoteColorId, val.toString(), false)
}

export async function getQuoteColor(): Promise<'green-up-red-down' | 'red-up-green-down'> {
	const model = await getConfigurationById(quoteColorId)
	const val = model?.data ? parseInt(model.data) : 0

	return val === 0 ? 'green-up-red-down' : 'red-up-green-down'
}

export function saveTheme(theme: Theme) {
	localStorage.setItem(themeLocalStorageKey, theme)
}
