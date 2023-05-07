export type Coin = {
	symbol: string
	amount: number
}

export interface Analyzer {
	loadPortfolio(): Promise<Coin[]>
}

export interface Database {

	initDatabase(): Promise<void>

	loadConfiguration(): Promise<GlobalConfig>

	saveToDatabase(models: CoinModel[]): Promise<void>

	queryDatabase(recordSize = 30, dateSort?: 'desc' | 'asc'): Promise<CoinQueryDetail[][]>

	close(): Promise<void>
}

export type GlobalConfig = CexConfig & TokenConfig & {
	database: DatabaseConfig
}

export type CexConfig = {
	exchanges: {
		name: string, initParams: {
			apiKey: string
			secret: string
			password?: string
		}
	}[]
}

type Addresses = {
	addresses?: string[]
}

export type TokenConfig = {
	erc20: Addresses
	btc: Addresses
	sol: Addresses
	doge: Addresses
	others: {
		symbol: string
		amount: number
	}[]
}

export type DatabaseConfig = {
	sqlite3: {
		path: string
	}
}

export type CoinModel = Coin & {
	value: number
}

export type CoinQueryDetail = {
	model: CoinModel
	date: Date
}
