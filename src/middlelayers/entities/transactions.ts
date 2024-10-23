import _ from 'lodash'
import { TransactionModel, UniqueIndexConflictResolver } from '../types'
import { deleteFromDatabase, saveModelsToDatabase, selectFromDatabase, selectFromDatabaseWithSql } from '../database'


export interface TransactionHandlerImpl {
	importTransactions(models: TransactionModel[], conflictResolver: UniqueIndexConflictResolver): Promise<TransactionModel[]>
}

class TransactionHandler implements TransactionHandlerImpl {
	private readonly transactionTableName = "transactions"

	async createOrUpdate(model: TransactionModel): Promise<void> {
		await saveModelsToDatabase(this.transactionTableName, [{
			...model,
			updatedAt: new Date().toISOString()
		}])
	}

	async getTransactionByID(id: number): Promise<TransactionModel> {
		const results = await selectFromDatabase<TransactionModel>(this.transactionTableName, { id })
		if (results.length === 0) {
			throw new Error(`Transaction with id ${id} not found`)
		}
		return results[0]
	}

	async listTransactions(symbol?: string): Promise<TransactionModel[]> {
		return selectFromDatabase<TransactionModel>(this.transactionTableName, { symbol })
	}

	async listTransactionsByUUIDs(uuids: string[]): Promise<TransactionModel[]> {
		if (uuids.length === 0) {
			return []
		}
		return selectFromDatabase<TransactionModel>(this.transactionTableName, {}, 0, {}, `uuid in (${uuids.map(() => '?').join(',')})`, uuids)
	}

	async listTransactionsByAssetID(assetID: number): Promise<TransactionModel[]> {
		return selectFromDatabase<TransactionModel>(this.transactionTableName, { assetID })
	}

	async listTransactionsByDateRange(start: Date, end: Date, symbol?: string): Promise<TransactionModel[][]> {
		return this.queryTransactionsByDateRange(start, end, symbol)
	}

	async deleteTransactionsByUUID(uuid: string) {
		await deleteFromDatabase(this.transactionTableName, { uuid })
	}

	async deleteTransactionsByAssetID(assetID: number) {
		await deleteFromDatabase(this.transactionTableName, { assetID })
	}

	private async queryTransactionsByDateRange(start?: Date, end?: Date, symbol?: string): Promise<TransactionModel[][]> {
		const symbolSql = symbol ? ` AND symbol = '${symbol}'` : ""
		const lteCreatedSql = end ? ` AND txnCreatedAt <= '${end.toISOString()}'` : ""
		const gteCreatedSql = start ? ` AND txnCreatedAt >= '${start.toISOString()}'` : ""
		const sql = `SELECT * FROM ${this.transactionTableName} WHERE 1 = 1 ${symbolSql} ${gteCreatedSql} ${lteCreatedSql} ORDER BY txnCreatedAt DESC;`

		const assets = await selectFromDatabaseWithSql<TransactionModel>(sql, [])
		return _(assets).groupBy("uuid").values().value()
	}

	async saveTransactions(models: TransactionModel[]) {
		return this.saveTransactionsInternal(models, "REPLACE")
	}

	async importTransactions(models: TransactionModel[], conflictResolver: UniqueIndexConflictResolver): Promise<TransactionModel[]> {
		return this.saveTransactionsInternal(models, conflictResolver)
	}

	private async saveTransactionsInternal(models: TransactionModel[], conflictResolver: UniqueIndexConflictResolver): Promise<TransactionModel[]> {
		// split models to chunks to avoid too large sql
		const chunkSize = 1000
		const chunks = _.chunk(models, chunkSize)
		const res = []

		for (const chunk of chunks) {
			const resModels = await saveModelsToDatabase<TransactionModel>(this.transactionTableName, chunk, conflictResolver)

			res.push(...resModels)
		}
		return res
	}

}

export const TRANSACTION_HANDLER = new TransactionHandler()
