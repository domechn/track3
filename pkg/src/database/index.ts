import _ from 'lodash'
import bluebird from 'bluebird'
import { Coin, Database, DatabaseConfig } from '../types'
import { NotionStore } from './notion'

export async function saveToDatabases(config: DatabaseConfig, data: (Coin & { price: number, usdValue: number })[]) {
	const databases = getDatabases(config)
	return bluebird.map(databases, async db => saveToDatabase(db, data))
}

async function saveToDatabase(db: Database, coins: (Coin & { usdValue: number })[]) {
	await db.saveToDatabase(_(coins).map(t => ({
		symbol: t.symbol,
		amount: t.amount,
		value: t.usdValue,
	})).value())
}

function getDatabases(config: DatabaseConfig): Database[] {
	const databases = []
	if (config?.notion && config?.notion?.databaseId) {
		databases.push(new NotionStore(config))
	}
	return databases
}

export function getOneDatabase(config: DatabaseConfig): Database | undefined {
	const dbs = getDatabases(config)
	if (dbs.length > 0) {
		return dbs[0]
	}
}
