import _ from 'lodash'
import yaml from 'yaml'
import { generateRandomColors } from '../utils/color'
import { getDatabase, saveCoinsToDatabase } from './database'
import { AssetChangeData, AssetModel, CoinData, CoinsAmountAndValueChangeData, HistoricalData, LatestAssetsPercentageData, TopCoinsPercentageChangeData, TopCoinsRankData, TotalValueData } from './types'

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
	let sql = `SELECT * FROM assets ORDER BY createdAt DESC`
	if (size > 0) {
		sql += ` LIMIT ${size}`
	}
	const assets = await db.select<AssetModel[]>(sql)
	return assets
}

async function queryAssetById(id: number): Promise<AssetModel> {
	const db = await getDatabase()
	const [asset] = await db.select<AssetModel[]>(`SELECT * FROM assets WHERE id = ?`, [id])
	if (!asset) {
		throw new Error(`asset with id ${id} not found`)
	}
	return asset
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
		totalValue: latest.total || 0,
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

export async function queryTopCoinsPercentageChangeData(size = 10): Promise<TopCoinsPercentageChangeData> {
	const assets = await queryAssets(size) || []

	const reservedAssets = _(assets).reverse().value()

	const getPercentageData = (symbol: string): {
		timestamp: number,
		value: number,
		price: number,
	}[] => {
		// get first data that contains the symbol
		const firstData = _(reservedAssets).find(asset => Object.values(asset).includes(symbol))!
		// get value of the symbol in firstData
		const [firstKey, _firstValue] = Object.entries(firstData).find(([key, value]) => value === symbol)!
		const firstIdxStr = firstKey.slice("top".length)
		const firstCoinValue = _(firstData).get("value" + firstIdxStr) as number
		const firstCoinAmount = _(firstData).get("amount" + firstIdxStr) as number
		const firstCoinPrice = firstCoinAmount === 0 ? 0 : firstCoinValue / firstCoinAmount

		return _(reservedAssets).filter(asset => Object.values(asset).includes(symbol))
			.map(asset => {
				const [key, value] = Object.entries(asset).find(([key, value]) => value === symbol)!
				const idxStr = key.slice("top".length)
				const coinValue = _(asset).get("value" + idxStr) as number
				const coinAmount = _(asset).get("amount" + idxStr) as number
				const coinPrice = coinAmount === 0 ? 0 : coinValue / coinAmount

				return {
					timestamp: new Date(asset.createdAt).getTime(),
					value: (coinValue - firstCoinValue) / firstCoinValue * 100 || 10 ** -21, // avoid divide by zero
					price: (coinPrice - firstCoinPrice) / firstCoinPrice * 100 || 10 ** -21, // avoid divide by zero
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
			percentageData: getPercentageData(coin),
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
	const backgroundColors = generateRandomColors(11) // top 10 and others

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
		chartColor: `rgba(${backgroundColors[idx].R}, ${backgroundColors[idx].G}, ${backgroundColors[idx].B}, 1)`
	})).value()
}

export async function queryCoinsAmountChange(size = 10): Promise<CoinsAmountAndValueChangeData> {
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
		value: number,
		timestamp: number
	}[] => {
		return _(reservedAssets).filter(asset => !!_(asset).values().find(v => v === symbol)).map(asset => {
			const [key, value] = Object.entries(asset).find(([key, value]) => value === symbol)!
			const idxStr = key.slice("top".length)
			return {
				amount: _(asset).get(`amount${idxStr}`) as unknown as number,
				value: _(asset).get(`value${idxStr}`) as unknown as number,
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
			values: _(aat).map('value').reverse().take(size).reverse().value(),
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

export async function queryCoinDataById(id: number): Promise<CoinData[]> {
	const model = await queryAssetById(id)

	const res: CoinData[] = []
	_(model).forEach((v, k) => {
		if (!v) {
			return
		}
		if (k.startsWith("top")) {
			const idxStr = k.slice("top".length)
			const amountRaw = _(model).get(`amount${idxStr}`)
			const valueRaw = _(model).get(`value${idxStr}`)

			const amount = _(amountRaw).isNumber() ? amountRaw as unknown as number : 0
			const value = _(valueRaw).isNumber() ? valueRaw as unknown as number : 0
			const price = amount === 0 ? 0 : value / amount
			res.push({
				symbol: v as string,
				amount: amount,
				value: value,
				price,
			})
		}
	})
	return res
}