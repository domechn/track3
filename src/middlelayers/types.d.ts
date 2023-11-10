export type AssetModel = {
	id: number
	uuid: string
	createdAt: string
	symbol: string
	amount: number
	value: number
	price: number
	wallet?: string
}

export type CloudAssetModel = {
	id: string

	owner: CloudUser

	uuid: string

	// json stringify from AssetModel[]
	records: string

	createdAt: number
}

export type CloudUser = {
	id: string
	publicKey: string
}

export type ConfigurationModel = {
	id: number
	data: string
}

export type CloudSyncConfiguration = {
	enableAutoSync: boolean
}


export type TopCoinsRankData = {
	timestamps: number[]
	coins: {
		coin: string
		lineColor: string
		rankData: {
			rank?: number
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
	prevTotalValue: number
}

export type AssetChangeData = {
	timestamps: number[]
	data: {
		usdValue: number
		btcPrice?: number
	}[]
}

export type LatestAssetsPercentageData = {
	coin: string
	percentage: number
	chartColor: string
}[]

// show usd value percentage of assets in each wallet
export type WalletAssetsPercentageData = {
	wallet: string
	walletType?: string
	walletAlias?: string
	percentage: number
	value: number
	chartColor: string
}[]

export type WalletAssetsChangeData = {
	wallet: string
	walletType?: string
	walletAlias?: string
	changePercentage: number
	changeValue: number
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

export type CurrencyRateModel = {
	id: number
	currency: string
	rate: number
	alias: string
	symbol: string
	priority: number
	updateAt: string
}

export type CurrencyRateDetail = {
	currency: string
	rate: number
	alias: string
	symbol: string
}
