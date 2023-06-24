export type Coin = {
	symbol: string
	amount: number
}

export interface Analyzer {
	getAnalyzeName(): string
	loadPortfolio(): Promise<Coin[]>
}

export type GlobalConfig = CexConfig & TokenConfig & {
	configs: {
		groupUSD: boolean
		querySize: number
	}
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

export type CoinModel = Coin & {
	value: number
}

export type CoinQueryDetail = {
	model: CoinModel
	date: Date
}

export type CurrencyRate = {
	currency: string
	// rate to usd
	// 1 usd = rate symbol
	rate: number
}