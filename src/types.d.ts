export type CommandConfig = {
	width: number
	height: number
	output: string
	'show-value': boolean
	config: string
}

export type Coin = {
	symbol: string
	amount: number
}

export interface Analyzer {
	loadPortfolio(): Promise<Coin[]>
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
