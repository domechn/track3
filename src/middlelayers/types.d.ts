export type UniqueIndexConflictResolver = 'IGNORE' | 'REPLACE'

// assets_v2 table
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

// type when exporting assets to json or cloud database
export type ExportAssetModel = AssetModel & { costPrice?: number }
// AddProgressFunc: progress is a number between 0 and 100, how many percent of the progress is added
export type AddProgressFunc = (progress: number) => void

// asset_prices table
// to record the cost price or sell price of each coins, can be updated by users
export type AssetPriceModel = {
	id: number
	uuid: string
	// id in assets_v2 table
	assetID: number
	symbol: string
	// when value > 0, it means cost price
	// when value < 0, it means sell price
	price: number

	// createdAt in assets_v2 table
	assetCreatedAt: string
	updatedAt: string
}

export type CloudAssetModel = {
	id: string

	owner: CloudUser

	uuid: string

	// json stringify from ExportAssetModel[]
	records: string

	createdAt: number
}

export type AssetAction = {
	// id in assets_v2 table
	assetID: number
	uuid: string
	symbol: string
	wallet?: string
	amount: number
	price: number
	changedAt: string
}

export type Asset = {
	symbol: string
	amount: number
	value: number
	price: number
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

export type PNLData = {
	data: {
		totalValue: number
		timestamp: number
	}[]

	todayPNL?: {
		value: number
		timestamp: number
	}
	sevenTPnl?: {
		value: number
		timestamp: number
	}
	thirtyPNL?: {
		value: number
		timestamp: number
	}
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
	amount: number
	value: number
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
	amounts: number[]
	values: number[]
	timestamps: number[]
}

export type HistoricalData = {
	id: string
	createdAt: string
	// costPrice only exists when exporting historical data
	assets: ExportAssetModel[]

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
	updatedAt: string
}

export type CurrencyRateDetail = {
	currency: string
	rate: number
	alias: string
	symbol: string
}

export type WalletCoinUSD = Pick<WalletCoin, "amount" | "symbol" | "wallet"> & {
	// price in usd
	price: number,
	usdValue: number,
}
