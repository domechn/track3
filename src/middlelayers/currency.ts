import _ from 'lodash'
import { getDatabase } from './database'
import { ExchangeRate } from './datafetch/currencies'

const CURRENCY_RATES_TABLE = "currency_rates"

export async function updateAllCurrencyRates() {
	const q = new ExchangeRate()

	const rates = await q.listAllCurrencyRates()

	const d = await getDatabase()

	const sqls: {
		sql: string
		params: any[]
	}[] = []

	const updatedAt = new Date().toISOString()

	// insert into currency_rates if currency not exists else update it
	for (const r of rates) {
		const { currency, rate } = r
		const sql = `INSERT OR IGNORE INTO ${CURRENCY_RATES_TABLE} (currency, rate, updatedAt) VALUES (?, ?, ?); UPDATE ${CURRENCY_RATES_TABLE} SET rate = ?, updatedAt = ? WHERE currency = ?`
		sqls.push({
			sql,
			params: [currency, rate, updatedAt, rate, updatedAt, currency]
		})
	}
	
	await d.execute(_(sqls).map(s => s.sql).join(";"), _(sqls).flatMap(s => s.params).value())
}
