import _ from "lodash"
import Database, { QueryResult } from "tauri-plugin-sql-api"
import { UniqueIndexConflictResolver } from './types'

export const databaseName = "track3.db"

type Sql = {
	sql: string
	values?: any[]
}

export interface DatabaseTransaction {

	select<T>(sql: string, values?: any[]): Promise<T>

	execute(sql: string, values?: any[]): Promise<QueryResult>

	commit(): Promise<QueryResult>

	rollback(): Promise<QueryResult>
}

let dbInstance: Database

export async function getDatabase(): Promise<Database> {
	if (dbInstance) {
		return dbInstance
	}
	dbInstance = await Database.load(`sqlite:${databaseName}`)
	return dbInstance
}

export async function beginTransaction(): Promise<DatabaseTransaction> {
	const db = await getDatabase()
	await db.execute("BEGIN TRANSACTION")

	let isCommitted = false

	const select = async <T>(sql: string, values?: any[]) => {
		if (isCommitted) {
			throw new Error("Transaction is already committed")
		}
		return db.select<T>(sql, values)
	}

	const execute = async (sql: string, values?: any[]) => {
		if (isCommitted) {
			throw new Error("Transaction is already committed")
		}
		return db.execute(sql, values)
	}

	const commit = async () => {
		if (isCommitted) {
			throw new Error("Transaction is already committed")
		}
		isCommitted = true
		return db.execute("COMMIT")
	}

	const rollback = async () => {
		if (isCommitted) {
			throw new Error("Transaction is already committed")
		}
		isCommitted = true
		return db.execute("ROLLBACK")
	}

	return {
		select,
		execute,
		commit,
		rollback,
	}

}

export async function saveModelsToDatabase<T extends object>(table: string, models: T[], conflictResolver: UniqueIndexConflictResolver = 'REPLACE', tx?: DatabaseTransaction) {
	const db = tx ?? await getDatabase()
	return saveToDatabase(db, table, models, conflictResolver)
}

async function saveToDatabase<T extends object>(db: Database | DatabaseTransaction, table: string, models: T[], conflictResolver: UniqueIndexConflictResolver) {
	if (models.length === 0) {
		return models
	}

	const filteredModes = _(models).map(m => _(m).omitBy(v => _(v).isUndefined()).value()).value()

	const first = filteredModes[0]
	const keys = Object.keys(first)
	const valuesArrayStr = new Array(filteredModes.length).fill(`(${keys.map(() => '?').join(',')})`).join(',')
	const insertSql = `INSERT OR ${conflictResolver} INTO ${table} (${keys.join(',')}) VALUES ${valuesArrayStr}`

	const values = _(filteredModes).map(m => _(keys).map(k => _(m).get(k)).value()).flatten().value()

	await db.execute(insertSql, values)
	return models
}


export async function selectFromDatabase<T extends object>(table: string, where: Partial<T>, limit = 0, orderBy?: {
	[k in keyof T]?: 'asc' | 'desc'
}, plainWhere?: string, plainWhereValues?: any[], tx?: DatabaseTransaction): Promise<T[]> {
	const db = tx ?? await getDatabase()

	// omit kv in where whose value is undefined
	const filteredWhere = _(where).omitBy(v => _(v).isUndefined()).value()

	const whereStr = _(filteredWhere).map((v, k) => `${k}=?`).join(' AND ')
	const values = _(filteredWhere).map(v => v).value()


	const limitStr = limit > 0 ? `LIMIT ${limit}` : ''
	const orderByStr = !_(orderBy).isEmpty() ? `ORDER BY ${_(orderBy).map((v, k) => `${k} ${v}`).join(',')}` : ''
	const sql = `SELECT * FROM ${table} WHERE 1=1 ${whereStr ? "AND " + whereStr : ''} ${plainWhere ? "AND " + plainWhere : ''} ${limitStr} ${orderByStr}`

	return db.select<T[]>(sql, [...values, ...(plainWhereValues ?? [])])
}

export async function selectFromDatabaseWithSql<T extends object>(sql: string, values: any[], tx?: DatabaseTransaction): Promise<T[]> {
	const db = tx ?? await getDatabase()
	return db.select<T[]>(sql, values)
}

export async function deleteFromDatabase<T extends object>(table: string, where: Partial<T>, allowFullDelete = false, tx?: DatabaseTransaction) {
	const db = tx ?? await getDatabase()

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
