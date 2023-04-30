import _ from 'lodash'
import { generateRandomColors } from '../utils/color'
import { getDatabase } from './database'
import { AssetChangeData, AssetModel, CoinsAmountChangeData, LatestAssetsPercentageData, TopCoinsRankData, TotalValueData } from './types'


async function queryAssets(size = 1): Promise<AssetModel[]> {
	const db = await getDatabase()
	const assets = await db.select<AssetModel[]>(`SELECT * FROM assets ORDER BY createdAt DESC LIMIT ${size}`)
	return assets
}

export async function queryTotalValue(): Promise<TotalValueData> {

	const results = await queryAssets()

	if (results.length === 0) {
		return {
			totalValue: 0,
			changePercentage: 0
		}
	}

	const latest = results[0]

	let changePercentage = 0
	if (results.length === 2) {
		const previous = results[1]

		const previousTotal = previous.total
		const latestTotal = latest.total

		changePercentage = (latestTotal - previousTotal) / previousTotal * 100
	}

	return {
		totalValue: latest.total,
		changePercentage
	}
}

export async function queryTopCoinsRank(): Promise<TopCoinsRankData> {

	const size = 10

	const assets = await queryAssets(size) || []

	const reservedAssets = _(assets).reverse().value()

	const getRankData = (symbol: string): {
		timestamp: number,
		rank: number
	}[] => {
		return _(reservedAssets).filter(asset => Object.values(asset).includes(symbol))
			.map(asset => {
				const [key, value] = Object.entries(asset).find(([key, value]) => value === symbol)!
				const idxStr = key.slice("top".length)
				return {
					timestamp: new Date(asset.createdAt).getTime(),
					rank: parseInt(idxStr, 10)
				}
			}).value()
	}


	const coins = getCoins(reservedAssets)
	const colors = generateRandomColors(coins.length)


	return {
		timestamps: _(reservedAssets).map(t => new Date(t.createdAt).getTime()).value(),
		coins: _(coins).map((coin, idx) => ({
			coin,
			lineColor: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
			rankData: getRankData(coin),
		})).value()
	}
}

function getCoins(assets: AssetModel[]): string[] {
	return _(assets).map(asset => _(asset).pickBy((k, v) => v.startsWith("top")).values().value() as string[]).flatten().uniq().filter(c => c.toLowerCase() !== "others").value()
}

export async function queryAssetChange(): Promise<AssetChangeData> {
	const size = 10

	const assets = await queryAssets(size) || []

	const reservedAssets = _(assets).reverse().value()

	return {
		timestamps: reservedAssets.map(t => new Date(t.createdAt).getTime()),
		data: reservedAssets.map(t => t.total)
	}
}

export async function queryLatestAssetsPercentage(): Promise<LatestAssetsPercentageData> {
	const size = 1
	const backgroundColors = [
		"rgba(122, 51, 255, 1)",
		"rgba(250, 215, 90, 1)",
		"rgba(51, 204, 255, 1)",
		"rgba(240, 114, 91, 1)",
		"rgba(39, 121, 242, 1)",
		"rgba(242, 97, 168, 1)",
		"rgba(137, 226, 145, 1)",
		"rgba(255, 215, 56, 1)",
		"rgba(0, 114, 178, 1)",
		"rgba(122, 175, 8, 1)",
		"rgba(79, 163, 252, 1)",
	]

	const assets = await queryAssets(size) || []
	if (!assets) {
		return []
	}

	const latest = assets[0]

	const total = latest.total
	const res: { coin: string, percentage: number }[] = []
	_(latest).forEach((v, k) => {
		if (k.startsWith("top")) {
			const idxStr = k.slice("top".length)
			res.push({
				coin: v as string,
				percentage: (_(latest).get(`value${idxStr}`) as unknown as number) / total * 100,
			})
		}
	})

	return _(res).map((v, idx) => ({
		...v,
		chartColor: backgroundColors[idx]
	})).value()
}

export async function queryCoinsAmountChange(): Promise<CoinsAmountChangeData> {
	const size = 30

	const assets = await queryAssets(size) || []
	if (!assets) {
		return []
	}

	const reservedAssets = _(assets).reverse().value()

	const coins = getCoins(reservedAssets)

	const colors = generateRandomColors(coins.length)

	const getAmountsAndTimestamps = (symbol: string): {
		amount: number,
		timestamp: number
	}[] => {
		return _(reservedAssets).filter(asset => !!_(asset).values().find(v => v === symbol)).map(asset => {
			const [key, value] = Object.entries(asset).find(([key, value]) => value === symbol)!
			const idxStr = key.slice("top".length)
			return {
				amount: _(asset).get(`amount${idxStr}`) as unknown as number,
				timestamp: new Date(asset.createdAt).getTime(),
			}
		}).value()
	}


	return _(coins).map((coin, idx) => {
		const aat = getAmountsAndTimestamps(coin)
		
		return {
			coin,
			lineColor: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
			amounts: _(aat).map('amount').value(),
			timestamps: _(aat).map('timestamp').value(),
		}
	}).value()
}
