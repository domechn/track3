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

export type ERC20Config = {
	erc20: {
		addresses: string[]
	}
}
