export type AssetModel = {
	id: number
	createdAt: string
	top01: string
	amount01: number
	value01: number
	top02: string
	amount02: number
	value02: number
	top03: string
	amount03: number
	value03: number
	top04: string
	amount04: number
	value04: number
	top05: string
	amount05: number
	value05: number
	top06: string
	amount06: number
	value06: number
	top07: string
	amount07: number
	value07: number
	top08: string
	amount08: number
	value08: number
	top09: string
	amount09: number
	value09: number
	top10: string
	amount10: number
	value10: number
	topOthers: string
	amountOthers: string
	valueOthers: number
	total: number
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

export type CoinsAmountChangeData = {
	coin: string
	lineColor: string
	amounts: number[]
	timestamps: number[]
}[]
