import _ from "lodash"
import Database from "tauri-plugin-sql-api"
import { Coin, CoinModel } from './datafetch/types'
import { AssetModel } from './types'

export const databaseName = "track3.db"

let dbInstance: Database

export async function getDatabase(): Promise<Database> {
	if (dbInstance) {
		return dbInstance
	}
	dbInstance = await Database.load(`sqlite:${databaseName}`)
	return dbInstance
}

export async function saveCoinsToDatabase(coins: (Coin & {
	price: number,
	usdValue: number,
})[]) {
	const db = await getDatabase()

	return saveToDatabase(db, _(coins).map(t => ({
		symbol: t.symbol,
		amount: t.amount,
		value: t.usdValue,
	})).value())
}

async function saveToDatabase(db: Database, models: CoinModel[]): Promise<void> {
	const getIndex = (i: number): string => {
		return i > 9 ? `${i}` : `0${i}`
	}
	const getDBModel = (models: CoinModel[]) => {
		const top10 = _(models).sortBy(m => m.value).reverse().take(10).value()
		const others = _(models).sortBy(m => m.value).reverse().drop(10).value()

		const top10Props = _(top10).map((t, i) => ({
			[`top${getIndex(i + 1)}`]: t.symbol,
			[`amount${getIndex(i + 1)}`]: t.amount,
			[`value${getIndex(i + 1)}`]: t.value,
		})).reduce((acc, cur) => _.merge(acc, cur), {})

		const othersProps = {
			topOthers: "Others",
			amountOthers: "N/A",
			valueOthers: _(others).sumBy(m => m.value),
		}

		return {
			...top10Props,
			...othersProps,
			total: _(models).sumBy(m => m.value),
		} as AssetModel
	}
	const dbModel = getDBModel(models)
	const insertSql = `INSERT INTO assets (${Object.keys(dbModel).join(',')}) VALUES (${Object.keys(dbModel).map(() => '?').join(',')})`
	await db.execute(insertSql, Object.values(dbModel))
}