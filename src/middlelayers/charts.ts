import _ from 'lodash'
import { generateRandomColors } from '../utils/color'
import { getDatabase, saveCoinsToDatabase } from './database'
import { AssetChangeData, AssetModel, CoinData, CoinsAmountAndValueChangeData, HistoricalData, LatestAssetsPercentageData, WalletAssetsPercentageData, TopCoinsPercentageChangeData, TopCoinsRankData, TotalValueData } from './types'

import { loadPortfolios, queryCoinPrices } from './data'
import { getConfiguration } from './configuration'
import { calculateTotalValue } from './datafetch/utils/coins'
import { WalletCoin } from './datafetch/types'
import { timestampToDate } from '../utils/date'
import { listWalletAliases } from './wallet'

const STABLE_COIN = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "PAX"]

export const ASSETS_TABLE_NAME = "assets_v2"

export async function refreshAllData() {
	const coins = await queryCoinsData()
	await saveCoinsToDatabase(coins)
}

async function queryCoinsData(): Promise<(WalletCoin & {
	price: number,
	usdValue: number,
})[]> {
	const config = await getConfiguration()
	if (!config) {
		throw new Error("no configuration found,\n please add configuration first")
	}
	const assets = await loadPortfolios(config)
	const priceMap = await queryCoinPrices(_(assets).map("symbol").push("USDT").uniq().value())

	let lastAssets = _.clone(assets)
	const groupUSD: boolean = _(config).get(['configs', 'groupUSD']) || false

	if (groupUSD) {
		_(assets).groupBy('wallet').forEach((coins, wallet) => {
			const usdAmount = _(coins).filter(c => STABLE_COIN.includes(c.symbol)).map(c => c.amount).sum()
			const removedUSDCoins = _(coins).filter(c => !STABLE_COIN.includes(c.symbol)).value()
			lastAssets = _(lastAssets).filter(a => a.wallet !== wallet).concat(removedUSDCoins).value()
			if (usdAmount > 0) {
				lastAssets.push({
					symbol: "USDT",
					amount: usdAmount,
					wallet,
				})
			}
		})
	}
	const totals = calculateTotalValue(lastAssets, priceMap)
	return totals
}

async function queryAssets(size = 1): Promise<AssetModel[][]> {
	const db = await getDatabase()
	// select top size timestamp
	let tsSql = `SELECT distinct(createdAt) FROM ${ASSETS_TABLE_NAME} ORDER BY createdAt DESC`
	if (size > 0) {
		tsSql += ` LIMIT ${size}`
	}

	const tsList = await db.select<{ createdAt: string }[]>(tsSql)
	const earliestTs = _(tsList).last()?.createdAt || new Date().toISOString()

	// select assets which createdAt >= earliestTs

	let sql = `SELECT * FROM ${ASSETS_TABLE_NAME} WHERE createdAt >= '${earliestTs}' ORDER BY createdAt DESC`
	const assets = await db.select<AssetModel[]>(sql)
	return _(assets).groupBy("createdAt").values().value()
}

function groupAssetModelsListBySymbol(models: AssetModel[][]): AssetModel[][] {
	// sum by symbol
	const res: AssetModel[][] = []

	_(models).forEach(ms => res.push(groupAssetModelsBySymbol(ms)))
	return res
}

function groupAssetModelsBySymbol(models: AssetModel[]): AssetModel[] {
	return _(models).groupBy("symbol").values().map(assets => ({
		..._(assets).first()!,
		amount: _(assets).sumBy("amount"),
		value: _(assets).sumBy("value"),
	})).value()
}

export async function queryAssetsAfterCreatedAt(createdAt?: number): Promise<AssetModel[]> {
	const db = await getDatabase()
	const ts = createdAt ? new Date(createdAt).toISOString() : new Date(0).toISOString()
	const assets = await db.select<AssetModel[]>(`SELECT * FROM ${ASSETS_TABLE_NAME} WHERE createdAt >= ?`, [ts])
	return assets
}

async function queryAssetByUUID(id: string): Promise<AssetModel[]> {
	const db = await getDatabase()
	const assets = await db.select<AssetModel[]>(`SELECT * FROM ${ASSETS_TABLE_NAME} WHERE uuid = ?`, [id])
	if (!assets || assets.length === 0) {
		throw new Error(`asset with id ${id} not found`)
	}
	return assets
}

async function deleteAssetByUUID(uuid: string): Promise<void> {
	const db = await getDatabase()
	await db.execute(`DELETE FROM ${ASSETS_TABLE_NAME} WHERE uuid = ?`, [uuid])
}

export async function queryTotalValue(): Promise<TotalValueData> {
	const results = groupAssetModelsListBySymbol(await queryAssets(2))

	if (results.length === 0) {
		return {
			totalValue: 0,
			changePercentage: 0
		}
	}

	const latest = results[0]

	const latestTotal = _(latest).sumBy("value") || 0

	let changePercentage = 0

	if (results.length === 2) {
		const previous = results[1]

		const previousTotal = _(previous).sumBy("value")

		changePercentage = (latestTotal - previousTotal) / previousTotal * 100
	}

	return {
		totalValue: latestTotal,
		changePercentage
	}
}

export async function queryWalletAssetsPercentage(): Promise<WalletAssetsPercentageData> {
	const assets = (await queryAssets(1))[0]
	// check if there is wallet column
	const hasWallet = _(assets).find(a => !!a.wallet)
	if (!assets || !hasWallet) {
		return []
	}
	const walletAssets = _(assets).groupBy('wallet')
		.map((walletAssets, wallet) => {
			const total = _(walletAssets).sumBy("value")
			return {
				wallet,
				total,
			}
		}).value()
	const total = _(walletAssets).sumBy("total") || 0.0001
	const wallets = _(walletAssets).map('wallet').uniq().compact().value()
	const backgroundColors = generateRandomColors(wallets.length)
	const walletAliases = await listWalletAliases(wallets)

	return _(walletAssets).map((wa, idx) => ({
		wallet: wa.wallet,
		walletAlias: walletAliases[wa.wallet],
		chartColor: `rgba(${backgroundColors[idx].R}, ${backgroundColors[idx].G}, ${backgroundColors[idx].B}, 1)`,
		percentage: wa.total / total * 100,
		value: wa.total,
	})).sortBy("percentage").reverse().value()
}

export async function queryTopCoinsRank(size = 10): Promise<TopCoinsRankData> {

	const assets = groupAssetModelsListBySymbol(await queryAssets(size) || [])

	const reservedAssets = _(assets).reverse().value()

	const getRankData = (symbol: string): {
		timestamp: number,
		rank?: number
	}[] => {
		return _(reservedAssets).filter(assets => !!_(assets).find(a => a.symbol === symbol))
			.map(ass => ({
				timestamp: new Date(ass[0]?.createdAt).getTime(),
				rank: _(ass).sortBy("value").reverse().findIndex(a => a.symbol === symbol) + 1
			})).map(d => {
				if (d.rank > 10) {
					return {
						...d,
						rank: undefined,
					}
				}
				return d
			}).value()
	}


	const coins = getCoins(reservedAssets)
	const colors = generateRandomColors(coins.length)

	return {
		timestamps: _(reservedAssets).flatten().map(t => new Date(t.createdAt).getTime()).uniq().value(),
		coins: _(coins).map((coin, idx) => ({
			coin,
			lineColor: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
			rankData: getRankData(coin),
		})).value()
	}
}

export async function queryTopCoinsPercentageChangeData(size = 10): Promise<TopCoinsPercentageChangeData> {
	const assets = groupAssetModelsListBySymbol(await queryAssets(size) || [])

	const reservedAssets = _(assets).reverse().value()

	const getPercentageData = (symbol: string): {
		timestamp: number,
		value: number,
		price: number,
	}[] => {
		const coinDataList = _(reservedAssets).map(ass => _(ass).find(a => a.symbol === symbol)).compact()
			.value()

		if (coinDataList.length === 0) {
			return []
		}

		const { value: firstCoinValue, price: firstCoinPrice } = coinDataList[0]


		return _(coinDataList)
			.map(a => ({
				timestamp: new Date(a.createdAt).getTime(),
				value: (a.value - firstCoinValue) / firstCoinValue * 100,
				price: (a.price - firstCoinPrice) / firstCoinPrice * 100,
			}))
			.value()

	}


	const coins = getCoins(reservedAssets)
	const colors = generateRandomColors(coins.length)


	return {
		timestamps: _(reservedAssets).flatten().map(t => new Date(t.createdAt).getTime()).uniq().value(),
		coins: _(coins).map((coin, idx) => ({
			coin,
			lineColor: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
			percentageData: getPercentageData(coin),
		})).value()
	}
}

function getCoins(assets: AssetModel[][]): string[] {
	// only take top 10 coins in each item
	return _(assets).map(as => _(as).sortBy('value').reverse().take(10).value()).flatten().map(a => a.symbol).uniq().value()
}

export async function queryAssetChange(size = 10): Promise<AssetChangeData> {

	const assets = groupAssetModelsListBySymbol(await queryAssets(size) || [])

	const reservedAssets = _(assets).reverse().value()

	return {
		timestamps: _(reservedAssets).flatten().map(t => new Date(t.createdAt).getTime()).uniq().value(),
		data: _(reservedAssets).map(ass => _(ass).sumBy("value")).value(),
	}
}

export async function queryLatestAssetsPercentage(): Promise<LatestAssetsPercentageData> {
	const size = 1
	const backgroundColors = generateRandomColors(11) // top 10 and others

	const assets = groupAssetModelsListBySymbol(await queryAssets(size) || [])
	if (assets.length === 0) {
		return []
	}

	const latest = assets[0]

	const total = _(latest).sumBy("value") + 10 ** -21 // avoid total is 0
	const sortedLatest = _(latest).sortBy('value').reverse().value()
	const top10 = _(sortedLatest).take(10).value()
	const others = _(sortedLatest).drop(10).value()

	const res: { coin: string, percentage: number }[] = []

	_(top10).forEach(t => {
		res.push({
			coin: t.symbol,
			percentage: t.value / total * 100,
		})
	})

	if (others.length > 0) {
		res.push({
			coin: 'Others',
			percentage: _(others).sumBy('value') / total * 100,
		})
	}

	return _(res).sortBy('percentage').reverse().map((v, idx) => ({
		...v,
		chartColor: `rgba(${backgroundColors[idx].R}, ${backgroundColors[idx].G}, ${backgroundColors[idx].B}, 1)`
	})).value()
}

export async function queryCoinsAmountChange(size = 10): Promise<CoinsAmountAndValueChangeData> {
	const querySize = size * 2

	const assets = groupAssetModelsListBySymbol(await queryAssets(querySize) || [])
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
		return _(reservedAssets).map(ass => _(ass).find(a => a.symbol === symbol)).compact().map(asset => {
			return {
				amount: asset.amount,
				value: asset.value,
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
	const models = groupAssetModelsListBySymbol(await queryAssets(size))

	const assetsModelsToHistoricalData = (ams: AssetModel[]): HistoricalData => {
		return {
			id: _(ams).first()!.uuid,
			createdAt: _(ams).first()!.createdAt,
			assets: ams,
			total: _(ams).sumBy('value'),
		}
	}

	return _(models).map(m => assetsModelsToHistoricalData(m)).value()
}

export async function deleteHistoricalDataByUUID(uuid: string): Promise<void> {
	return deleteAssetByUUID(uuid)
}

export async function queryCoinDataById(id: string): Promise<CoinData[]> {
	const models = groupAssetModelsBySymbol(await queryAssetByUUID(id))

	const res: CoinData[] = _(models)
		.map(m => ({
			symbol: m.symbol,
			amount: m.amount,
			value: m.value,
			price: m.price
		})).value()
	return res
}

export async function queryAllDataDates(): Promise<{
	id: string
	date: string
}[]> {
	const assets = groupAssetModelsListBySymbol(await queryAssets(-1))

	return _(assets)
		.map(ass => _(ass).first())
		.compact()
		.map(as => ({
			id: as.uuid,
			date: timestampToDate(new Date(as.createdAt).getTime())
		}))
		.value()
}
