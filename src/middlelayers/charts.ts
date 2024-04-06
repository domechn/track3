import _ from 'lodash'
import { generateRandomColors } from '../utils/color'
import { AddProgressFunc, Asset, AssetAction, AssetChangeData, AssetModel, AssetPriceModel, CoinsAmountAndValueChangeData, HistoricalData, LatestAssetsPercentageData, MaxTotalValueData, PNLChartData, PNLTableDate, RestoreHistoricalData, TDateRange, TopCoinsPercentageChangeData, TopCoinsRankData, TotalValueData, UserLicenseInfo, WalletCoinUSD } from './types'

import { loadPortfolios, queryCoinPrices } from './data'
import { getConfiguration } from './configuration'
import { calculateTotalValue } from './datafetch/utils/coins'
import { timeToDateStr } from '../utils/date'
import { WalletAnalyzer } from './wallet'
import { OthersAnalyzer } from './datafetch/coins/others'
import { ASSET_HANDLER } from './entities/assets'
import { ASSET_PRICE_HANDLER } from './entities/asset-prices'
import { Chart } from 'chart.js'
import md5 from 'md5'
import { isProVersion } from './license'
import { getLocalStorageCacheInstance, getMemoryCacheInstance } from './datafetch/utils/cache'
import { GlobalConfig, WalletCoin } from './datafetch/types'
import { CACHE_GROUP_KEYS } from './consts'

const STABLE_COIN = ["USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDD", "PYUSD", "USDP", "FRAX", "LUSD", "GUSD", "BUSD"]

export const WALLET_ANALYZER = new WalletAnalyzer((size) => ASSET_HANDLER.listAssets(size))

export async function refreshAllData(addProgress: AddProgressFunc) {
	// will add 90 percent in query coins data
	const coins = await queryCoinsData(addProgress)

	await ASSET_HANDLER.saveCoinsToDatabase(coins)
	addProgress(10)
}

// query the real-time price of the last queried asset
export async function queryRealTimeAssetsValue(): Promise<Asset[]> {
	const cache = getMemoryCacheInstance(CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY)
	// const cache = getLocalStorageCacheInstance(CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY)
	const cacheKey = "real-time-assets"
	const c = cache.getCache<Asset[]>(cacheKey)
	if (c) {
		return c
	}
	const size = 1
	const result = await ASSET_HANDLER.listSymbolGroupedAssets(size)
	if (result.length === 0) {
		return []
	}

	const assets = result[0]
	const config = await getConfiguration()
	if (!config) {
		throw new Error("no configuration found,\n please add configuration first")
	}
	// check if pro user
	const userProInfo = await isProVersion()
	const walletCoins = await queryCoinsDataByWalletCoins(_(assets).map(a => ({
		symbol: a.symbol,
		amount: a.amount,
		// wallet here dose not matter
		wallet: a.wallet ?? OthersAnalyzer.wallet
	})).value(), config, userProInfo)

	const assetRes = _(walletCoins).map(t => ({
		symbol: t.symbol,
		amount: t.amount,
		value: t.usdValue,
		price: t.price,
	})).value()

	// 15 min ttl
	cache.setCache(cacheKey, assetRes, 15 * 60)
	return assetRes
}

// return all asset actions by analyzing all asset models
export async function loadAllAssetActionsBySymbol(symbol: string): Promise<AssetAction[]> {
	const assets = await ASSET_HANDLER.listAssetsBySymbol(symbol)
	const updatedPrices = await ASSET_PRICE_HANDLER.listPricesBySymbol(symbol)
	const revAssets = _(assets).reverse().value()

	const actions = _.flatMap(revAssets, (as, i) => {
		const ass = generateAssetActions(as, updatedPrices, assets[i - 1])
		return ass
	})
	return actions
}

// listAllowedSymbols return all symbol names
// returns sort by latest value desc
export async function listAllowedSymbols(): Promise<string[]> {
	return ASSET_HANDLER.listSortedSymbolsByCurrentValue()
}

type TotalProfit = {
	// total profit
	total: number,
	// total profit percentage
	percentage: number,
	coins: {
		symbol: string,
		// coin profit
		value: number
		// coin profit percentage
		percentage: number
	}[]
}

// calculateTotalProfit gets all profit
export async function calculateTotalProfit(dateRange: TDateRange): Promise<TotalProfit> {
	const cache = getLocalStorageCacheInstance(CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY)
	const key = `${dateRange.start.getTime()}-${dateRange.end.getTime()}`
	const c = cache.getCache<TotalProfit>(key)
	if (c) {
		return c
	}
	const symbols = await ASSET_HANDLER.listAllSymbols()
	const allAssets = await ASSET_HANDLER.listAssetsByDateRange(dateRange.start, dateRange.end)
	const allUpdatedPrices = await ASSET_PRICE_HANDLER.listPrices()

	const symbolData = _(symbols).map(symbol => {
		const assets = _(allAssets).map(item => {
			const symbolAss = _(item).filter(i => i.symbol === symbol).value()
			return symbolAss.length === 0 ? undefined : symbolAss
		}).compact().value()
		if (assets.length === 0) {
			return
		}
		const updatedPrices = _(allUpdatedPrices).filter(a => a.symbol === symbol).value()

		const revAssets = _(assets).reverse().value()

		const actions = _.flatMap(revAssets, (as, i) => {
			const a = generateAssetActions(as, updatedPrices, assets[i - 1])
			return a
		})
		const latestAsset = assets[assets.length - 1]

		const latest = convertAssetModelsToAsset(symbol, latestAsset ? [latestAsset] : [])

		return {
			symbol,
			actions,
			latest
		}
	}).compact().value()

	const coins = _(symbolData).map(d => {
		if (!d.latest) {
			return
		}
		const realSpentValue = _(d.actions).sumBy((a) => a.amount * a.price)
		const value = d.latest.value - realSpentValue

		return {
			symbol: d.symbol,
			realSpentValue,
			value,
			percentage: realSpentValue === 0 ? 0 : value / realSpentValue * 100
		}
	}).compact().value()

	const total = _(coins).sumBy(c => c.value)
	const totalRealSpent = _(coins).sumBy(c => c.realSpentValue)

	const resp = {
		total,
		percentage: totalRealSpent === 0 ? 0 : total / totalRealSpent * 100,
		coins,
	}
	cache.setCache(key, resp)
	return resp
}

export async function updateAssetPrice(uuid: string, assetID: number, symbol: string, price: number, createdAt: string) {
	await ASSET_PRICE_HANDLER.createOrUpdate({
		uuid,
		assetID,
		symbol,
		price,
		assetCreatedAt: createdAt
	} as AssetPriceModel)
}

// return dates which has data
export async function getAvailableDates(): Promise<Date[]> {
	const dates = await ASSET_HANDLER.getHasDataCreatedAtDates()
	// return asc sort
	return _(dates).reverse().value()
}

function generateAssetActions(cur: AssetModel[], updatedPrices: AssetPriceModel[], pre?: AssetModel[]): AssetAction[] {
	const getGroupByKey = (p: {
		uuid: string
		id: number
	}) => `${p.uuid}-${p.id}`
	const up = _(updatedPrices).groupBy(p => getGroupByKey({
		uuid: p.uuid,
		id: p.assetID
	})).value()

	// only value changes > 1 or price is 0
	const isAmountChanged = (a: number, b: number, price: number) => {
		return price === 0 || a !== b // || Math.abs(a - b) * price > 1
	}

	const res: AssetAction[] = []

	_(cur).forEach(c => {

		const p = _(pre).find(p => p.symbol === c.symbol && p.wallet === c.wallet)
		const price = up[getGroupByKey(c)]?.[0]?.price ?? c.price

		if (!p) {
			res.push({
				assetID: c.id,
				uuid: c.uuid,
				changedAt: c.createdAt,
				symbol: c.symbol,
				amount: c.amount,
				price,
				wallet: c.wallet
			})
		} else if (isAmountChanged(p.amount, c.amount, price)) {
			res.push({
				assetID: c.id,
				uuid: c.uuid,
				changedAt: c.createdAt,
				symbol: c.symbol,
				amount: c.amount - p.amount,
				price,
				wallet: c.wallet
			})
		}
	})

	_(pre).forEach(p => {
		const c = _(cur).find(c => c.symbol === p.symbol && c.wallet === p.wallet)
		if (!c) {
			res.push({
				assetID: p.id,
				uuid: p.uuid,
				changedAt: p.createdAt,
				symbol: p.symbol,
				amount: -p.amount,
				price: up[getGroupByKey(p)]?.[0]?.price ?? p.price,
				wallet: p.wallet
			})
		}
	})

	// remove changes whose amount is 0
	return _(res).filter(r => r.amount !== 0).value()
}

async function queryCoinsDataByWalletCoins(assets: WalletCoin[], config: GlobalConfig, userProInfo: UserLicenseInfo, addProgress?: AddProgressFunc): Promise<WalletCoinUSD[]> {
	// always query btc and usdt price
	const priceMap = await queryCoinPrices(_(assets).filter(a => !a.price).map("symbol").push("USDT").push("BTC").uniq().compact().value(), userProInfo)
	if (addProgress) {
		addProgress(10)
	}

	let latestAssets = _.clone(assets)
	const groupUSD: boolean = _(config).get(['configs', 'groupUSD']) || false

	if (groupUSD) {
		_(assets).groupBy('wallet').forEach((coins, wallet) => {
			const usdAmount = _(coins).filter(c => STABLE_COIN.includes(c.symbol)).map(c => c.amount).sum()
			const removedUSDCoins = _(coins).filter(c => !STABLE_COIN.includes(c.symbol)).value()
			latestAssets = _(latestAssets).filter(a => a.wallet !== wallet).concat(removedUSDCoins).value()
			if (usdAmount > 0) {
				latestAssets.push({
					symbol: "USDT",
					amount: usdAmount,
					wallet,
				})
			}
		})
	}

	// add btc value if not exist
	const btcData = _(assets).find(c => c.symbol === "BTC")
	if (!btcData) {
		latestAssets.push({
			symbol: "BTC",
			amount: 0,
			wallet: OthersAnalyzer.wallet,
		})
	}
	const totals = calculateTotalValue(latestAssets, priceMap)

	// if item in totals exists in lastAssets and it's usdValue is less than 1, we think it has been sold out last time, so we do not need to save its data to database this time
	const filteredTotals = _(totals).filter(t => !_(t.wallet).startsWith("md5:")).filter(t => {
		if (t.usdValue > 1) {
			return true
		}
		// already handled in loadPortfolios
		if (t.amount === 0) {
			return true
		}
		const totalWallet = md5(t.wallet)
		const lastAsset = _(latestAssets).flatten().find(a => a.symbol === t.symbol && a.wallet === totalWallet)
		// not found in last asset, which means coin has already been removed before last record
		if (!lastAsset) {
			return false
		}
		// coin has been sold out in last time
		if (lastAsset.amount === 0) {
			return false
		}
		return true
	}).map(t => ({
		...t,
		// if usdValue < 1, means it has been sold out this time. update it to 0, because coin whose usdValue < 1 will be ignored before saving to database
		usdValue: t.usdValue > 1 ? t.usdValue : 0,
		amount: t.usdValue > 1 ? t.amount : 0,
	})).value()

	if (addProgress) {
		addProgress(5)
	}
	return filteredTotals
}

// query all assets and calculate their value in USD
async function queryCoinsData(addProgress: AddProgressFunc): Promise<WalletCoinUSD[]> {
	addProgress(1)
	const config = await getConfiguration()
	if (!config) {
		throw new Error("no configuration found,\n please add configuration first")
	}
	addProgress(2)
	// check if pro user
	const userProInfo = await isProVersion()
	addProgress(2)
	// will add 70 percent in load portfolios
	const assets = await loadPortfolios(config, addProgress, userProInfo)

	return queryCoinsDataByWalletCoins(assets, config, userProInfo, addProgress)
}

export async function queryAssetMaxAmountBySymbol(symbol: string): Promise<number> {
	return ASSET_HANDLER.getMaxAmountBySymbol(symbol)
}

// return all asset prices for all symbols
export function queryAllAssetPrices(): Promise<AssetPriceModel[]> {
	return ASSET_PRICE_HANDLER.listPrices()
}

export function queryAssetPricesAfterAssetCreatedAt(createdAt?: number): Promise<AssetPriceModel[]> {
	const ts = createdAt ? new Date(createdAt).toISOString() : undefined
	return ASSET_PRICE_HANDLER.listPricesAfterAssetCreatedAt(ts)
}

export function queryAssetPricesAfterUpdatedAt(updatedAt?: number): Promise<AssetPriceModel[]> {
	const ts = updatedAt ? new Date(updatedAt).toISOString() : undefined
	return ASSET_PRICE_HANDLER.listPricesAfterUpdatedAt(ts)
}

export async function queryLastAssetsBySymbol(symbol: string): Promise<Asset | undefined> {
	const models = await ASSET_HANDLER.listAssetsBySymbol(symbol, 1)
	return convertAssetModelsToAsset(symbol, models)
}

// models: must only contain same symbol assets
function convertAssetModelsToAsset(symbol: string, models: AssetModel[][]): Asset | undefined {
	const model = _(models).flatten().reduce((acc, cur) => ({
		...acc,
		amount: acc.amount + cur.amount,
		value: acc.value + cur.value,
	}))

	return model ? {
		symbol,
		amount: model.amount,
		value: model.value,
		price: model.price,
	} as Asset : undefined
}

export async function queryAssetsAfterCreatedAt(createdAt?: number): Promise<AssetModel[]> {
	return ASSET_HANDLER.listAssetsAfterCreatedAt(createdAt)
}

export async function queryAssetsByIDs(ids: number[]): Promise<AssetModel[]> {
	return ASSET_HANDLER.listAssetsByIDs(ids)
}

export async function queryAssetsByUUIDs(uuids: string[]): Promise<AssetModel[]> {
	return ASSET_HANDLER.listAssetsByUUIDs(uuids)
}

async function deleteAssetByUUID(uuid: string): Promise<void> {
	return ASSET_HANDLER.deleteAssetsByUUID(uuid)
}

async function deleteAssetByID(id: number): Promise<void> {
	return ASSET_HANDLER.deleteAssetByID(id)
}

async function deleteAssetPriceByUUID(uuid: string): Promise<void> {
	return ASSET_PRICE_HANDLER.deletePricesByUUID(uuid)
}

async function deleteAssetPriceByID(id: number): Promise<void> {
	return ASSET_PRICE_HANDLER.deletePricesByAssetID(id)
}

export async function queryTotalValue(): Promise<TotalValueData> {
	const results = await ASSET_HANDLER.listSymbolGroupedAssets(2)

	if (results.length === 0) {
		return {
			totalValue: 0,
			prevTotalValue: 0
		}
	}

	const latest = results[0]

	const latestTotal = _(latest).sumBy("value") || 0

	let previousTotal = 0

	if (results.length === 2) {
		const previous = results[1]

		previousTotal = _(previous).sumBy("value")

	}

	return {
		totalValue: latestTotal,
		prevTotalValue: previousTotal,
	}
}

export async function queryMaxTotalValue(dateRange: TDateRange): Promise<MaxTotalValueData> {
	const record = await ASSET_HANDLER.listMaxTotalValueRecord(dateRange.start, dateRange.end)
	if (!record) {
		return {
			uuid: "",
			totalValue: 0,
			date: new Date()
		}
	}
	return {
		uuid: record.uuid,
		totalValue: record.totalValue,
		date: new Date(record.createdAt)
	}
}

export async function queryPNLChartValue(dateRange: TDateRange): Promise<PNLChartData> {

	const data = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(dateRange.start, dateRange.end)

	return _(data).reverse().map(rs => ({
		totalValue: _(rs).sumBy("value"),
		timestamp: new Date(rs[0]?.createdAt).getTime(),
	})).value()
}

export async function queryPNLTableValue(): Promise<PNLTableDate> {
	const pnlData = _(await ASSET_HANDLER.listSymbolGroupedAssets(35)).reverse().map(rs => ({
		totalValue: _(rs).sumBy("value"),
		timestamp: new Date(rs[0]?.createdAt).getTime(),
	})).value()

	const getPNL = (days: number) => {
		if (pnlData.length < days + 1) {
			return
		}

		const pickData = pnlData[pnlData.length - days - 1]
		const val = pnlData[pnlData.length - 1].totalValue - pickData.totalValue
		return {
			value: val,
			timestamp: pickData.timestamp
		}
	}

	return {
		todayPNL: getPNL(1),
		sevenTPnl: getPNL(8),
		thirtyPNL: getPNL(31),
	}
}

export async function queryTopCoinsRank(dateRange: TDateRange): Promise<TopCoinsRankData> {

	const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(dateRange.start, dateRange.end)

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

export async function queryTopCoinsPercentageChangeData(dateRange: TDateRange): Promise<TopCoinsPercentageChangeData> {
	const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(dateRange.start, dateRange.end)

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

export async function queryLastRefreshAt(): Promise<string | undefined> {
	const lc = await ASSET_HANDLER.getLatestCreatedAt()
	return lc ? timeToDateStr(new Date(lc).getTime(), true) : undefined
}

function getCoins(assets: AssetModel[][], size = 10): string[] {
	// only take top 10 coins in each item
	return _(assets).map(as => _(as).sortBy('value').reverse().take(size > 0 ? size : _(as).size()).value()).flatten().map(a => a.symbol).uniq().value()
}

export async function queryAssetChange(dateRange: TDateRange): Promise<AssetChangeData> {

	const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(dateRange.start, dateRange.end)

	const reservedAssets = _(assets).reverse().value()

	return {
		timestamps: _(reservedAssets).flatten().map(t => new Date(t.createdAt).getTime()).uniq().value(),
		data: _(reservedAssets).map(ass => ({
			usdValue: _(ass).sumBy("value"),
			btcPrice: _(ass).find(a => a.symbol === "BTC")?.price,
		})).value(),
	}
}

export async function queryLatestAssets(): Promise<Asset[]> {
	const size = 1

	const assets = await ASSET_HANDLER.listSymbolGroupedAssets(size)
	if (assets.length === 0) {
		return []
	}

	return _(assets[0])
		.filter(a => a.amount !== 0)
		.map(a => ({
			symbol: a.symbol,
			amount: a.amount,
			value: a.value,
			price: a.value / a.amount,
		})).value()
}

export async function queryLatestAssetsPercentage(): Promise<LatestAssetsPercentageData> {
	const size = 1

	const assets = await ASSET_HANDLER.listSymbolGroupedAssets(size)
	if (assets.length === 0) {
		return []
	}

	// ignore coins whose amount is 0
	const latest = _(assets[0]).filter(a => a.amount !== 0).value()
	const backgroundColors = generateRandomColors(_(latest).size())

	const total = _(latest).sumBy("value") + 10 ** -21 // avoid total is 0

	const res: {
		coin: string,
		percentage: number,
		amount: number,
		value: number,
	}[] = _(latest).map(t => ({
		coin: t.symbol,
		amount: t.amount,
		value: t.value,
		percentage: t.value / total * 100,

	})).value()

	return _(res).sortBy('percentage').reverse().map((v, idx) => ({
		...v,
		chartColor: `rgba(${backgroundColors[idx].R}, ${backgroundColors[idx].G}, ${backgroundColors[idx].B}, 1)`
	})).value()
}

export async function queryCoinsAmountChange(symbol: string, dateRange: TDateRange): Promise<CoinsAmountAndValueChangeData | undefined> {
	const assets = await ASSET_HANDLER.listAssetsBySymbolByDateRange(symbol, dateRange.start, dateRange.end)
	if (!assets) {
		return
	}

	const reservedAssets = _(assets).reverse().value()


	const getAmountsAndTimestamps = (symbol: string): {
		amount: number,
		value: number,
		timestamp: number
	}[] => {
		return _(reservedAssets).map(assets => {
			return {
				amount: _(assets).sumBy("amount"),
				value: _(assets).sumBy("value"),
				timestamp: new Date(assets[0].createdAt).getTime(),
			}
		}).value()
	}


	const aat = getAmountsAndTimestamps(symbol)

	return {
		coin: symbol,
		amounts: _(aat).map('amount').value(),
		values: _(aat).map('value').value(),
		timestamps: _(aat).map('timestamp').value(),
	}
}

// gather: if true, group asset models by same symbol
export async function queryHistoricalData(size = 30, gather = true): Promise<HistoricalData[]> {
	const models = gather ? await ASSET_HANDLER.listSymbolGroupedAssets(size) : await ASSET_HANDLER.listAssets(size)


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

// delete batch records by uuid
export async function deleteHistoricalDataByUUID(uuid: string): Promise<void> {
	await deleteAssetByUUID(uuid)
	// !also delete asset price
	await deleteAssetPriceByUUID(uuid)
}

// delete single record by id
export async function deleteHistoricalDataDetailById(id: number): Promise<void> {
	await deleteAssetByID(id)
	// !also delete asset price
	await deleteAssetPriceByID(id)
}

export async function restoreHistoricalData(data: RestoreHistoricalData): Promise<void> {
	const { assets, prices } = data

	await ASSET_HANDLER.saveAssets(assets)
	await ASSET_PRICE_HANDLER.savePrices(prices)
}

export async function queryRestoreHistoricalData(id: string | number): Promise<RestoreHistoricalData> {
	// if id is number => it's asset id
	// if id is string => it's asset uuid
	const isUUID = _(id).isString()
	const assets = isUUID ? await ASSET_HANDLER.listAssetsByUUIDs([id as string]) : await ASSET_HANDLER.listAssetsByIDs([id as number])
	const prices = isUUID ? await ASSET_PRICE_HANDLER.listPricesByAssetUUID(id as string) : [await ASSET_PRICE_HANDLER.getPriceByAssetID(id as number)]

	return {
		assets,
		prices: _(prices).compact().value(),
	}

}

export async function queryCoinDataByUUID(uuid: string): Promise<Asset[]> {
	const models = await ASSET_HANDLER.listSymbolGroupedAssetsByUUID(uuid)

	const res: Asset[] = _(models)
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
	const assets = await ASSET_HANDLER.listSymbolGroupedAssets()

	return _(assets)
		.map(ass => _(ass).first())
		.compact()
		.map(as => ({
			id: as.uuid,
			date: timeToDateStr(new Date(as.createdAt).getTime())
		}))
		.value()
}

// delay: ms
export async function resizeChartWithDelay(chartNameKey: string, delay = 100) {
	await new Promise((resolve) => setTimeout(resolve, delay))
	return resizeChart(chartNameKey)
}

export function resizeChart(chartNameKey: string) {
	for (const id in Chart.instances) {
		const text = Chart.instances[id].options.plugins?.title?.text as
			| string
			| undefined
		if (text?.startsWith(chartNameKey)) {
			Chart.instances[id].resize()
			break
		}
	}
}
