import _ from "lodash"
import Database from "tauri-plugin-sql-api"
import { UniqueIndexConflictResolver } from './types'

export const databaseName = "track3.db"

let dbInstance: Database

export async function getDatabase(): Promise<Database> {
	if (dbInstance) {
		return dbInstance
	}
	dbInstance = await Database.load(`sqlite:${databaseName}`)
	return dbInstance
}

export async function saveModelsToDatabase<T extends object>(table: string, models: T[], conflictResolver: UniqueIndexConflictResolver = 'REPLACE') {
	const db = await getDatabase()
	return saveToDatabase(db, table, models, conflictResolver)
}

async function saveToDatabase<T extends object>(db: Database, table: string, models: T[], conflictResolver: UniqueIndexConflictResolver) {
	if (models.length === 0) {
		return models
	}

	const filteredModes = _(models).map(m => _(m).omitBy(v => _(v).isUndefined()).value()).value()

	const first = filteredModes[0]
	const keys = Object.keys(first)
	const valuesArrayStr = new Array(filteredModes.length).fill(`(${keys.map(() => '?').join(',')})`).join(',')
	const insertSql = `INSERT OR ${conflictResolver} INTO ${table} (${keys.join(',')}) VALUES ${valuesArrayStr}`
	const values = _(filteredModes).map(m => _(keys).map(k => _(m).get(k)).value()).flatten().value()
	console.log(insertSql);
	
	await db.execute(insertSql, values)
	return models
}

export async function selectFromDatabase<T extends object>(table: string, where: Partial<T>, limit = 0, orderBy?: {
	[k in keyof T]?: 'asc' | 'desc'
}, plainWhere?: string, plainWhereValues?: any[]): Promise<T[]> {
	const db = await getDatabase()

	// omit kv in where whose value is undefined
	const filteredWhere = _(where).omitBy(v => _(v).isUndefined()).value()

	const whereStr = _(filteredWhere).map((v, k) => `${k}=?`).join(' AND ')
	const values = _(filteredWhere).map(v => v).value()


	const limitStr = limit > 0 ? `LIMIT ${limit}` : ''
	const orderByStr = !_(orderBy).isEmpty() ? `ORDER BY ${_(orderBy).map((v, k) => `${k} ${v}`).join(',')}` : ''
	const sql = `SELECT * FROM ${table} WHERE 1=1 ${whereStr ? "AND " + whereStr : ''} ${plainWhere ? "AND " + plainWhere : ''} ${limitStr} ${orderByStr}`

	return db.select<T[]>(sql, [...values, ...(plainWhereValues ?? [])])
}

export async function selectFromDatabaseWithSql<T extends object>(sql: string, values: any[]): Promise<T[]> {
	const db = await getDatabase()
	return db.select<T[]>(sql, values)
}

export async function deleteFromDatabase<T extends object>(table: string, where: Partial<T>, allowFullDelete = false) {
	const db = await getDatabase()

	const filteredWhere = _(where).omitBy(v => _(v).isUndefined()).value()
	const whereKeys = _(filteredWhere).keys().value()
	if (!allowFullDelete && whereKeys.length === 0) {
		throw new Error("Delete without where is not allowed")
	}

	const whereStr = _(whereKeys).map(k => `${k}=?`).join(' AND ')
	const values = _(filteredWhere).map(v => v).value()


	const sql = `DELETE FROM ${table} WHERE ${whereStr}`

	return db.execute(sql, values)
}
