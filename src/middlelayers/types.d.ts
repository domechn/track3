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

export type TransactionType = 'buy' | 'sell' | 'deposit' | 'withdraw'

export type TransactionModel = {
	id: number
	// uuid is the same as uuid in assets_v2 table
	uuid: string
	assetID: number
	wallet: string
	symbol: string
	// amount always >= 0
	amount: number
	price: number
	txnType: TransactionType
	txnCreatedAt: string
	createdAt: string
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

export type Transaction = {
	id: number
	assetID: number
	uuid: string
	symbol: string
	wallet?: string
	amount: number
	price: number
	txnType: TransactionType
	txnCreatedAt: string
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

export type AssetsPercentageChangeData = {
	timestamp: number
	percentages: {
		symbol: string
		percentage: number
	}[]
}[]

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
}

export type MaxTotalValueData = {
	uuid: string
	date: Date
	totalValue: number
}

export type PNLChartData = {
	totalValue: number
	timestamp: number
}[]

export type TotalValuesData = PNLChartData

export type PNLTableDate = {
	latestTotalValue?: number
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
	amount: number
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
	assets: AssetModel[]
	transactions: TransactionModel[]

	total: number
}

export type RestoreHistoricalData = {
	assets: AssetModel[]
	transactions: TransactionModel[]
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

// DateRange type for track3
export type TDateRange = {
	start: Date
	end: Date
}

export type UserLicenseInfo = {
	isPro: boolean

	// must exists if isPro === true
	license?: string
}

export type QuoteColor = "green-up-red-down" | "red-up-green-down"
