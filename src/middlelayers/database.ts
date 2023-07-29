import _ from "lodash"
import Database from "tauri-plugin-sql-api"
import { v4 as uuidv4 } from 'uuid'
import { Coin, CoinModel, WalletCoin } from './datafetch/types'
import { AssetModel } from './types'
import { ASSETS_TABLE_NAME } from './charts'
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
export async function saveCoinsToDatabase(coins: (WalletCoin & {
	price: number,
	usdValue: number,
})[]) {
	const db = await getDatabase()

	return saveToDatabase(db, _(coins).map(t => ({
		wallet: t.wallet,
		symbol: t.symbol,
		amount: t.amount,
		value: t.usdValue,
	})).filter(v => v.value > 1).value())
}

// will auto skip models whose amount is 0
async function saveToDatabase(db: Database, models: CoinModel[]): Promise<void> {
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
	if (dbModels.length === 0) {
		return
	}

	const first = dbModels[0]
	const keys = Object.keys(first)
	const valuesArrayStr = new Array(dbModels.length).fill(`(${keys.map(() => '?').join(',')})`).join(',')
	const insertSql = `INSERT INTO ${ASSETS_TABLE_NAME} (${keys.join(',')}) VALUES ${valuesArrayStr}`
	const values = _(dbModels).map(m => _(keys).map(k => _(m).get(k)).value()).flatten().value()
	await db.execute(insertSql, values)
}
