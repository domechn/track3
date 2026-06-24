import Database from "@tauri-apps/plugin-sql"
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

	const filteredModes = models.map(m => Object.fromEntries(Object.entries(m).filter(([,v]) => v !== undefined)))

	const first = filteredModes[0]
	const keys = Object.keys(first)
	const valuesArrayStr = new Array(filteredModes.length).fill(`(${keys.map(() => '?').join(',')})`).join(',')
	const insertSql = `INSERT OR ${conflictResolver} INTO ${table} (${keys.join(',')}) VALUES ${valuesArrayStr} RETURNING *`
	
	const values = filteredModes.flatMap(m => keys.map(k => m[k]))
	
	const result = await db.select<T[]>(insertSql, values)
	return result
}

export async function selectFromDatabase<T extends object>(table: string, where: Partial<T>, limit = 0, orderBy?: {
	[k in keyof T]?: 'asc' | 'desc'
}, plainWhere?: string, plainWhereValues?: any[]): Promise<T[]> {
	const db = await getDatabase()

	// omit kv in where whose value is undefined
	const filteredWhere = Object.fromEntries(Object.entries(where).filter(([,v]) => v !== undefined))

	const whereStr = Object.keys(filteredWhere)
		.map((k) => `${k}=?`)
		.join(' AND ')
	const values = Object.values(filteredWhere)


	const limitStr = limit > 0 ? `LIMIT ${limit}` : ''
	const orderByEntries = orderBy ? Object.entries(orderBy).filter(([, v]) => v) : []
	const orderByStr = orderByEntries.length > 0
		? `ORDER BY ${orderByEntries.map(([k, v]) => `${k} ${v}`).join(',')}`
		: ''
	const sql = `SELECT * FROM ${table} WHERE 1=1 ${whereStr ? "AND " + whereStr : ''} ${plainWhere ? "AND " + plainWhere : ''} ${orderByStr} ${limitStr}`

	return db.select<T[]>(sql, [...values, ...(plainWhereValues ?? [])])
}

export async function selectFromDatabaseWithSql<T extends object>(sql: string, values: any[]): Promise<T[]> {
	const db = await getDatabase()
	return db.select<T[]>(sql, values)
}

export async function deleteFromDatabase<T extends object>(table: string, where: Partial<T>, allowFullDelete = false) {
	const db = await getDatabase()

	const filteredWhere = Object.fromEntries(Object.entries(where).filter(([,v]) => v !== undefined))
	const whereKeys = Object.keys(filteredWhere)
	if (!allowFullDelete && whereKeys.length === 0) {
		throw new Error("Delete without where is not allowed")
	}

	const whereStr = whereKeys.map((k) => `${k}=?`).join(' AND ')
	const values = Object.values(filteredWhere)


	const sql = `DELETE FROM ${table} WHERE ${whereStr}`

	return db.execute(sql, values)
}
