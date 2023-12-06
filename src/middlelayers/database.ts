import _ from "lodash"
import Database from "tauri-plugin-sql-api"
import { v4 as uuidv4 } from 'uuid'
import { CoinModel } from './datafetch/types'
import { AssetPriceModel, AssetModel, WalletCoinUSD } from './types'
import { ASSETS_PRICE_TABLE_NAME, ASSETS_TABLE_NAME } from './charts'
import md5 from 'md5'

export const databaseName = "track3.db"

let dbInstance: Database

export async function getDatabase(): Promise<Database> {
	if (dbInstance) {
		return dbInstance
	}
	dbInstance = await Database.load(`sqlite:${databaseName}`)
	return dbInstance
}

// skip where value is less than 1
export async function saveCoinsToDatabase(coins: WalletCoinUSD[]) {
	const db = await getDatabase()

	return saveAssetsToDatabase(db, _(coins).map(t => ({
		wallet: t.wallet,
		symbol: t.symbol,
		amount: t.amount,
		value: t.usdValue,
	})).filter(v => v.value > 1).value())
}

// will auto skip models whose amount is 0
async function saveAssetsToDatabase(db: Database, models: CoinModel[]): Promise<AssetModel[]> {
	const now = new Date().toISOString()
	// generate uuid v4

	const uid = uuidv4()

	const getDBModel = (models: CoinModel[]) => {

		return _(models).filter(m => m.amount !== 0).map(m => ({
			createdAt: now,
			uuid: uid,
			symbol: m.symbol,
			amount: m.amount,
			value: m.value,
			price: m.value / m.amount,
			// md5 of wallet
			wallet: md5(m.wallet),
		} as AssetModel)).value()

	}
	const dbModels = getDBModel(models)

	return saveToDatabase(db, ASSETS_TABLE_NAME, dbModels)
}

export async function saveModelsToDatabase<T extends object>(table: string, models: T[]) {
	const db = await getDatabase()
	return saveToDatabase(db, table, models)
}

async function saveToDatabase<T extends object>(db: Database, table: string, models: T[]) {
	if (models.length === 0) {
		return models
	}

	const first = models[0]
	const keys = Object.keys(first)
	const valuesArrayStr = new Array(models.length).fill(`(${keys.map(() => '?').join(',')})`).join(',')
	const insertSql = `INSERT INTO ${table} (${keys.join(',')}) VALUES ${valuesArrayStr}`
	const values = _(models).map(m => _(keys).map(k => _(m).get(k)).value()).flatten().value()
	await db.execute(insertSql, values)
	return models
}
