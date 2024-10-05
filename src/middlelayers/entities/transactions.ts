import _ from 'lodash'
import { TransactionModel } from '../types'
import { saveModelsToDatabase, selectFromDatabase, selectFromDatabaseWithSql } from '../database'

class TransactionHandler {
	private readonly transactionTableName = "transactions"

	async createOrUpdate(model: TransactionModel): Promise<void> {
		await saveModelsToDatabase(this.transactionTableName, [{
			...model,
			updatedAt: new Date().toISOString()
		}])
	}

	async listTransactions(symbol?: string): Promise<TransactionModel[]> {
		return selectFromDatabase<TransactionModel>(this.transactionTableName, { symbol })
	}

	async listTransactionsByDateRange(start: Date, end: Date): Promise<TransactionModel[][]> {
		return this.queryTransactionsByDateRange(start, end)
	}

	async deleteTransactionsByUUID(uuid: string) {
		await selectFromDatabase(this.transactionTableName, { uuid })
	}

	async deleteTransactionsByAssetID(assetID: number) {
		await selectFromDatabase(this.transactionTableName, { assetID })
	}

	private async queryTransactionsByDateRange(start?: Date, end?: Date, symbol?: string): Promise<TransactionModel[][]> {
		const symbolSql = symbol ? ` AND symbol = '${symbol}'` : ""
		const lteCreatedSql = end ? ` AND createdAt <= '${end.toISOString()}'` : ""
		const gteCreatedSql = start ? ` AND createdAt >= '${start.toISOString()}'` : ""
		const sql = `SELECT * FROM ${this.transactionTableName} WHERE 1 = 1 ${symbolSql} ${gteCreatedSql} ${lteCreatedSql} ORDER BY createdAt DESC;`
		const assets = await selectFromDatabaseWithSql<TransactionModel>(sql, [])
		return _(assets).groupBy("uuid").values().value()
	}
}

export const TRANSACTION_HANDLER = new TransactionHandler()
