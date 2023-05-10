import _ from 'lodash'
import yaml from 'yaml'
import { generateRandomColors } from '../utils/color'
import { getDatabase, saveCoinsToDatabase } from './database'
import { AssetChangeData, AssetModel, CoinsAmountChangeData, HistoricalData, LatestAssetsPercentageData, TopCoinsRankData, TotalValueData } from './types'

import { loadPortfolios, queryCoinPrices } from './data'
import { getConfiguration } from './configuration'
import { calculateTotalValue } from './datafetch/utils/coins'
import { CexConfig, Coin, TokenConfig } from './datafetch/types'

const STABLE_COIN = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "PAX"]

export async function refreshAllData() {
	const coins = await queryCoinsData()
	await saveCoinsToDatabase(coins)
}

async function queryCoinsData(): Promise<(Coin & {
	price: number,
	usdValue: number,
})[]> {
	const configModel = await getConfiguration()
	if (!configModel) {
		throw new Error("no configuration found,\n please add configuration first")
	}
	const config = yaml.parse(configModel.data) as CexConfig & TokenConfig
	const assets = await loadPortfolios(config)
	const priceMap = await queryCoinPrices(_(assets).map("symbol").push("USDT").uniq().value())

	let lastAssets = assets
	const groupUSD: boolean = _(config).get(['configs', 'groupUSD']) || false
	console.error("groupUSD", groupUSD, config);
	
	if (groupUSD) {
		const usdValue = _(assets).filter(c => STABLE_COIN.includes(c.symbol)).map(c => c.amount).sum()
		lastAssets = _(assets).remove(c => !STABLE_COIN.includes(c.symbol)).value()
		lastAssets.push({
			symbol: "USDT",
			amount: usdValue,
		})
	}
	const totals = calculateTotalValue(lastAssets, priceMap)
	return totals
}

async function queryAssets(size = 1): Promise<AssetModel[]> {
	const db = await getDatabase()
	const assets = await db.select<AssetModel[]>(`SELECT * FROM assets ORDER BY createdAt DESC LIMIT ${size}`)
	return assets
}

async function deleteAsset(id: number): Promise<void> {
	const db = await getDatabase()
	await db.execute(`DELETE FROM assets WHERE id = ?`, [id])
}

export async function queryTotalValue(): Promise<TotalValueData> {
	const results = await queryAssets(2)

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

export async function queryTopCoinsRank(size = 10): Promise<TopCoinsRankData> {

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
	return _(assets).map(asset => _(asset).pickBy((k, v) => v.startsWith("top")).values().value() as string[]).flatten().compact().uniq().filter(c => c.toLowerCase() !== "others").value()
}

export async function queryAssetChange(size = 10): Promise<AssetChangeData> {

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
	if (assets.length === 0) {
		return []
	}

	const latest = assets[0]

	const total = latest.total
	const res: { coin: string, percentage: number }[] = []
	_(latest).forEach((v, k) => {
		// skip null value
		if (!v) {
			return
		}
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

export async function queryCoinsAmountChange(size = 10): Promise<CoinsAmountChangeData> {
	const querySize = size * 2

	const assets = await queryAssets(querySize) || []
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
			amounts: _(aat).map('amount').reverse().take(size).reverse().value(),
			timestamps: _(aat).map('timestamp').reverse().take(size).reverse().value(),
		}
	}).value()
}

export async function queryHistoricalData(size = 30): Promise<HistoricalData[]> {
	return queryAssets(size)
}

export async function deleteHistoricalDataById(id: number): Promise<void> {
	return deleteAsset(id)
}
