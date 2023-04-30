import _ from 'lodash'
import bluebird from 'bluebird'
import { Coin, Database, DatabaseConfig } from '../types'
import { SqliteStore } from './sqlite'

export async function saveToDatabases(config: DatabaseConfig, data: (Coin & { price: number, usdValue: number })[]) {
	const databases = getDatabases(config)
	return bluebird.map(databases, async db => saveToDatabase(db, data))
}

async function saveToDatabase(db: Database, coins: (Coin & { usdValue: number })[]) {
	await db.initDatabase()
	await db.saveToDatabase(_(coins).map(t => ({
		symbol: t.symbol,
		amount: t.amount,
		value: t.usdValue,
	})).value())
}

export async function closeDatabases(config: DatabaseConfig) {
	const databases = getDatabases(config)
	return bluebird.map(databases, async db => db.close())
}

export function getDatabases(config: DatabaseConfig): Database[] {
	const databases = []
	databases.push(new SqliteStore(config.sqlite3.path))
	return databases
}

export function getOneDatabase(config: DatabaseConfig): Database {
	const dbs = getDatabases(config)
	return dbs[0]!
}
