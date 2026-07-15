import { invoke } from "@tauri-apps/api/core"
import Database from "@tauri-apps/plugin-sql"
import { UniqueIndexConflictResolver } from './types'

export const databaseName = "track3.db"

export type WriteDatabase = Pick<Database, "execute" | "select">

/** Write queue that serializes all renderer database mutations to prevent
 * concurrent SQLite transaction conflicts. Each write in
 * @tauri-apps/plugin-sql is wrapped in an internal BEGIN/COMMIT;
 * parallel writes on the same connection cause "cannot rollback" errors. */
let dbPromise: Promise<Database> | undefined
let writeQueue: Promise<void> = Promise.resolve()

export function getDatabase(): Promise<Database> {
	dbPromise ??= invoke<string>("get_database_url")
		.then((url) => Database.load(url))
		.catch((error) => {
			dbPromise = undefined
			throw error
		})
	return dbPromise
}

export async function getLatestCommittedRefreshCreatedAt(
	database?: Pick<Database, "select">,
): Promise<string | undefined> {
	const db = database ?? await getDatabase()
	const columns = await db.select<Array<{name: string}>>(
		"SELECT name FROM pragma_table_info('refresh_operations')",
		[],
	)
	if (!columns.some(({name}) => name === "created_at")) {
		return undefined
	}

	const [latest] = await db.select<Array<{createdAt: string | null}>>(
		"SELECT MAX(created_at) AS createdAt FROM refresh_operations",
		[],
	)
	return latest?.createdAt ?? undefined
}

export function executeWriteWork<T>(
	operation: (db: WriteDatabase) => Promise<T>,
): Promise<T> {
	const result = writeQueue.then(async () => operation(await getDatabase()))
	writeQueue = result.then(() => undefined, () => undefined)
	return result
}

export function enqueueWrite<T>(
	operation: (db: WriteDatabase) => Promise<T>,
): Promise<T> {
	return executeWriteWork(operation)
}

/**
 * Serialized database write. Only one renderer mutation is in-flight on the
 * shared connection at a time.
 */
export function executeWrite(sql: string, values?: unknown[]): Promise<{rowsAffected: number}> {
	return enqueueWrite((db) => db.execute(sql, values))
}

export function saveModelsToDatabase<T extends object>(table: TableName, models: T[], conflictResolver: UniqueIndexConflictResolver = 'REPLACE') {
	return executeWriteWork((db) => saveModelsInWriteWork(db, table, models, conflictResolver))
}

export async function saveModelsInWriteWork<T extends object>(
	db: WriteDatabase,
	table: TableName,
	models: T[],
	conflictResolver: UniqueIndexConflictResolver,
) {
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

export type TableName = "assets_v2" | "transactions" | "currency_rates" | "chat_sessions" | "configuration" | "asset_prices";

/** Reject plainWhere strings that contain quote patterns usable for SQL injection. */
function assertSafePlainWhere(plainWhere: string): void {
	if (/[';]/.test(plainWhere)) {
		throw new Error(`Unsafe plainWhere clause rejected: contains quote or semicolon characters`);
	}
}

export async function selectFromDatabase<T extends object>(table: TableName, where: Partial<T>, limit = 0, orderBy?: {
	[k in keyof T]?: 'asc' | 'desc'
}, plainWhere?: string, plainWhereValues?: ReadonlyArray<unknown>): Promise<T[]> {
	const db = await getDatabase()

	if (plainWhere) {
		assertSafePlainWhere(plainWhere);
	}

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

export async function selectFromDatabaseWithSql<T extends object>(sql: string, values: ReadonlyArray<unknown>): Promise<T[]> {
	const db = await getDatabase()
	return db.select<T[]>(sql, values as unknown[])
}

export async function deleteFromDatabase<T extends object>(table: TableName, where: Partial<T>, allowFullDelete = false) {
	const filteredWhere = Object.fromEntries(Object.entries(where).filter(([,v]) => v !== undefined))
	const whereKeys = Object.keys(filteredWhere)
	if (!allowFullDelete && whereKeys.length === 0) {
		throw new Error("Delete without where is not allowed")
	}

	const whereStr = whereKeys.map((k) => `${k}=?`).join(' AND ')
	const values = Object.values(filteredWhere)


	const sql = `DELETE FROM ${table} WHERE ${whereStr}`

	return enqueueWrite<{rowsAffected: number}>((db) => db.execute(sql, values))
}
