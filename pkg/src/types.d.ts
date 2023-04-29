export type Coin = {
	symbol: string
	amount: number
}

export interface Analyzer {
	loadPortfolio(): Promise<Coin[]>
}

export interface Database {
	saveToDatabase(models: CoinModel[]): Promise<void>

	queryDatabase(recordSize = 30, dateSort?: 'desc' | 'asc'): Promise<CoinQueryDetail[][]>
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
	notion?: {
		token: string
		databaseId: string
	}
}

export type CoinModel = Coin & {
	value: number
}

export type CoinQueryDetail = {
	model: CoinModel
	date: Date
}
