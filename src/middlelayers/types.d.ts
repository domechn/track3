export type AssetModel = {
	id: number
	uuid: string
	createdAt: string
	symbol: string
	amount: number
	value: number
	price: number
}

export type ConfigurationModel = {
	id: number
	data: string
}


export type TopCoinsRankData = {
	timestamps: number[]
	coins: {
		coin: string
		lineColor: string
		rankData: {
			rank: number
			timestamp: number
		}[]
	}[]
}

export type TopCoinsPercentageChangeData = {
	timestamps: number[]
	coins: {
		coin: string
		lineColor: string
		percentageData: {
			// coin values percentage
			value: number
			// coin price percentage
			price: number
			timestamp: number
		}[]
	}[]
}

export type TotalValueData = {
	totalValue: number
	changePercentage: number
}

export type AssetChangeData = {
	timestamps: number[]
	data: number[]
}

export type LatestAssetsPercentageData = {
	coin: string
	percentage: number
	chartColor: string
}[]

export type CoinsAmountAndValueChangeData = {
	coin: string
	lineColor: string
	amounts: number[]
	values: number[]
	timestamps: number[]
}[]

export type HistoricalData = {
	id: string
	createdAt: string

	assets: AssetModel[]

	total: number
}

export type CoinData = {
	symbol: string
	amount: number
	value: number
	price: number
}
