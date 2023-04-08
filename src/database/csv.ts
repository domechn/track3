import _ from 'lodash'
import { CoinModel, CoinQueryDetail, Database, DatabaseConfig } from '../types'
import { promises } from 'fs'
import { CSVRow, readCSV, writeCSV } from '../utils/csv'
import path from 'path'

interface DataStruct {
	date: Date
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

	toCSVRow(): CSVRow

	toCoinQueryDetail(): CoinQueryDetail[]
}

class DataStruct implements DataStruct {

	static fromCSVRow(row: CSVRow): DataStruct {

		const res = new DataStruct()
		res.date = new Date(row.date)
		for (let i = 1; i <= 10; i++) {
			const idxStr = i < 10 ? `0${i}` : i.toString()
			const topKey = `top${idxStr}`
			const amountKey = `amount${idxStr}`
			const valueKey = `value${idxStr}`

			_.set(res, topKey, row[topKey])
			_.set(res, amountKey, parseFloat(row[amountKey]))
			_.set(res, valueKey, parseFloat(row[valueKey]))
		}

		res.topOthers = row.topOthers
		res.amountOthers = row.amountOthers
		res.valueOthers = parseFloat(row.valueOthers)

		res.total = parseFloat(row.total)

		return res
	}

	toCSVRow(): CSVRow {
		return _(this).mapValues((v) => {
			if (_.isDate(v)) {
				return v.toISOString().slice(0, 10)
			}
			if (_.isNumber(v)) {
				return v.toFixed(2)
			}
			if (_.isString(v)) {
				return v
			}
			return
		}).pickBy(val => !_.isNil(val) && !_.isEmpty(val)).value() as CSVRow
	}

	toCoinQueryDetail(): CoinQueryDetail[] {
		const result: CoinQueryDetail[] = []
		// add top 10 coins
		for (let i = 1; i <= 10; i++) {
			const idxStr = i < 10 ? `0${i}` : i.toString()
			const topKey = `top${idxStr}`
			const amountKey = `amount${idxStr}`
			const valueKey = `value${idxStr}`
			const top = _.get(this, topKey) as string
			const amount = _.get(this, amountKey)
			const value = _.get(this, valueKey)
			if (!top || !amount || !value) {
				continue
			}
			result.push({
				model: {
					symbol: top,
					amount: parseFloat(amount),
					value: parseFloat(value),
				},
				date: this.date,
			})
		}
		// add others
		result.push({
			model: {
				symbol: this.topOthers,
				amount: 0,
				value: this.valueOthers,
			},
			date: this.date,
		})

		return result
	}
}

export class CSVStore implements Database {
	private readonly config: Pick<DatabaseConfig, 'csv'>

	private readonly outputPath: string

	constructor(config: Pick<DatabaseConfig, 'csv'>) {
		this.config = config

		this.outputPath = path.join(this.config.csv?.outputDir ?? "csv/histories", "assets-statics.csv")
	}

	private transformToDataStruct(models: CoinModel[]): DataStruct {
		const top10 = _(models).sortBy(m => m.value).reverse().take(10).value()
		const others = _(models).sortBy(m => m.value).reverse().drop(10).value()
		const totalValue = _(models).sumBy(m => m.value)
		const data = new DataStruct()
		data.date = new Date()
		data.topOthers = "Others"
		data.amountOthers = "N/A"
		data.valueOthers = _(others).sumBy(m => m.value)
		data.total = totalValue

		_(top10).forEach((m, idx) => {
			const idxPlus1 = idx + 1
			let idxStr = idxPlus1.toString()
			if (idxPlus1 < 10) {
				idxStr = `0${idxStr}`
			}

			const topKey: string = `top${idxStr}`
			const amountKey: string = `amount${idxStr}`
			const valueKey: string = `value${idxStr}`
			_.set(data, topKey, m.symbol)
			_.set(data, amountKey, m.amount)
			_.set(data, valueKey, m.value)
		})

		return data
	}

	private async initCSCDirectory(): Promise<void> {
		if (await promises.access(this.outputPath).then(() => true).catch(() => false)) {
			return
		}
		await promises.mkdir(path.dirname(this.outputPath), { recursive: true })

		await promises.writeFile(this.outputPath, '')
	}

	async saveToDatabase(models: CoinModel[]): Promise<void> {
		await this.initCSCDirectory()

		const exists = await readCSV(this.outputPath)

		const newData = [...exists, this.transformToDataStruct(models).toCSVRow()]

		await writeCSV(this.outputPath, _(newData).value())
	}

	async queryDatabase(recordSize = 30, dateSort = 'desc'): Promise<CoinQueryDetail[][]> {
		const data = await readCSV(this.outputPath)

		const dataQueryFunc = _(data).map(d => DataStruct.fromCSVRow(d)).orderBy(d => d.date)
		if (dateSort === 'desc') {
			dataQueryFunc.reverse()
		}

		const result = dataQueryFunc.reverse().take(recordSize).map(d => d.toCoinQueryDetail()).value()
		return result
	}
}