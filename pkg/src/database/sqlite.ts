import _ from 'lodash'
import { Database as SqliteDatabase } from 'sqlite3'
import fs from 'fs'
import {  CoinModel, CoinQueryDetail, Database, GlobalConfig } from '../types'
import { dirname } from 'path'
import bluebird from 'bluebird'

type AssetModel = {
	id: number
	createdAt: string
	top01: string
	amount01: number
	value01: number
	top02: string
	amount02: number
	value02: number
	top03: string
	amount03: number
	value03: number
	top04: string
	amount04: number
	value04: number
	top05: string
	amount05: number
	value05: number
	top06: string
	amount06: number
	value06: number
	top07: string
	amount07: number
	value07: number
	top08: string
	amount08: number
	value08: number
	top09: string
	amount09: number
	value09: number
	top10: string
	amount10: number
	value10: number
	topOthers: string
	amountOthers: string
	valueOthers: number
	total: number
}

export class SqliteStore implements Database {
	private path: string

	private db: SqliteDatabase

	constructor(path: string) {
		this.path = path

		// check if db file exists
		if (!fs.existsSync(this.path)) {
			fs.mkdirSync(dirname(this.path), { recursive: true })
			console.log("db file not exists, creating...")
			fs.closeSync(fs.openSync(this.path, 'w'))
		}

		this.db = new SqliteDatabase(this.path)
	}

	private getIndex(i: number): string {
		return i > 9 ? `${i}` : `0${i}`
	}

	private getDBModel(models: CoinModel[]): AssetModel {
		const top10 = _(models).sortBy(m => m.value).reverse().take(10).value()
		const others = _(models).sortBy(m => m.value).reverse().drop(10).value()

		const top10Props = _(top10).map((t, i) => ({
			[`top${this.getIndex(i + 1)}`]: t.symbol,
			[`amount${this.getIndex(i + 1)}`]: t.amount,
			[`value${this.getIndex(i + 1)}`]: t.value,
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

	async initDatabase(): Promise<void> {
		console.log("initing database")

		// init tables
		const createAssetSql = `CREATE TABLE IF NOT EXISTS assets (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
				top01 TEXT,
				amount01 REAL,
				value01 REAL,
				top02 TEXT,
				amount02 REAL,
				value02 REAL,
				top03 TEXT,
				amount03 REAL,
				value03 REAL,
				top04 TEXT,
				amount04 REAL,
				value04 REAL,
				top05 TEXT,
				amount05 REAL,
				value05 REAL,
				top06 TEXT,
				amount06 REAL,
				value06 REAL,
				top07 TEXT,
				amount07 REAL,
				value07 REAL,
				top08 TEXT,
				amount08 REAL,
				value08 REAL,
				top09 TEXT,
				amount09 REAL,
				value09 REAL,
				top10 TEXT,
				amount10 REAL,
				value10 REAL,
				topOthers TEXT,
				amountOthers TEXT,
				valueOthers REAL,
				total REAL
			);
		`

		const createConfigurationSql = `CREATE TABLE IF NOT EXISTS "configuration" (
				id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
				data TEXT NOT NULL
			);
		`

		await bluebird.map([createAssetSql, createConfigurationSql], async sql => new Promise((resolve, reject) => {
			this.db.run(sql, (err) => {
				if (err) {
					reject(err)
				} else {
					resolve(1)
				}
			})
		}))
	}

	async loadConfiguration(): Promise<GlobalConfig > {
		return new Promise((resolve, reject) => {
			this.db.get('SELECT * FROM configuration WHERE id = 1', (err, row: { id: string, data: string }[]) => {
				if (err) {
					reject(err)
				} else {
					if (!row) {
						reject(new Error("no configuration found"))
					} else {
						resolve(JSON.parse(row[0].data))
					}
				}
			})
		})
	}


	async saveToDatabase(models: CoinModel[]): Promise<void> {
		const dbModel = this.getDBModel(models)
		const insertSql = `INSERT INTO assets (${Object.keys(dbModel).join(',')}) VALUES (${Object.keys(dbModel).map(() => '?').join(',')})`

		return new Promise((resolve, reject) => {
			this.db.run(insertSql, Object.values(dbModel), (err) => {
				if (err) {
					reject(err)
				} else {
					resolve()
				}
			})
		})
	}

	async queryDatabase(recordSize?: number, dateSort?: 'desc' | 'asc' | undefined): Promise<CoinQueryDetail[][]> {
		const querySql = `SELECT * FROM assets ORDER BY createdAt ${dateSort || 'desc'} LIMIT ${recordSize || 10}`

		return new Promise((resolve, reject) =>
			this.db.all(querySql, (err, rows: AssetModel[]) => {
				if (err) {
					reject(err)
				} else {
					resolve(rows.map(row => {
						const date = new Date(row.createdAt)
						const key = "top"
						const top10 = _(row).pickBy((v, k) => k.startsWith(key)).map((v, k) => ({
							symbol: v,
							amount: _(row).get(`amount${k.slice(key.length)}`) as unknown as number,
							value: _(row).get(`value${k.slice(key.length)}`) as unknown as number,
						})).value()
						const others = {
							symbol: row.topOthers,
							amount: row.amountOthers,
							value: row.valueOthers,
						}

						return _([...top10, others]).map(m => ({
							model: m,
							date
						})).value() as CoinQueryDetail[]

					}))
				}
			})
		)
	}

	async close(): Promise<void> {
		this.db.close()
	}
}
