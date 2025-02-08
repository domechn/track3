import _ from 'lodash'
import { generateRandomColors } from '../utils/color'
import { AddProgressFunc, Asset, AssetAction, AssetChangeData, AssetModel, AssetsPercentageChangeData, CoinsAmountAndValueChangeData, HistoricalData, LatestAssetsPercentageData, MaxTotalValueData, PNLChartData, PNLTableDate, RestoreHistoricalData, TDateRange, TopCoinsPercentageChangeData, TopCoinsRankData, TotalValueData, TotalValuesData, Transaction, TransactionModel, TransactionType, UserLicenseInfo, WalletCoinUSD } from './types'

import { loadPortfolios, queryCoinPrices, queryStableCoins } from './data'
import { getConfiguration } from './configuration'
import { calculateTotalValue } from './datafetch/utils/coins'
import { timeToDateStr } from '../utils/date'
import { WalletAnalyzer } from './wallet'
import { OthersAnalyzer } from './datafetch/coins/others'
import { ASSET_HANDLER } from './entities/assets'
import { Chart } from 'chart.js'
import md5 from 'md5'
import { isProVersion } from './license'
import { getLocalStorageCacheInstance, getMemoryCacheInstance } from './datafetch/utils/cache'
import { GlobalConfig, WalletCoin } from './datafetch/types'
import { CACHE_GROUP_KEYS } from './consts'
import { TRANSACTION_HANDLER } from './entities/transactions'

// if data length is greater than 100, only take 100 data points
const DATA_MAX_POINTS = 100

export const WALLET_ANALYZER = new WalletAnalyzer((size) => ASSET_HANDLER.listAssets(size))

export async function refreshAllData(addProgress: AddProgressFunc) {
	const lastAssets = _(await ASSET_HANDLER.listAssets(1)).flatten().value()
	// will add 90 percent in query coins data
	const coins = await queryCoinsData(lastAssets, addProgress)

	// todo: add db transaction
	const uid = await ASSET_HANDLER.saveCoinsToDatabase(coins)
	addProgress(5)

	// calculate transactions and save
	const newAssets = _(await ASSET_HANDLER.listAssets(1)).flatten().value()
	await TRANSACTION_HANDLER.saveTransactions(generateTransactions(uid, lastAssets, newAssets))
	addProgress(5)
}

function generateTransactions(uid: string, before: AssetModel[], after: AssetModel[]): TransactionModel[] {
	const updatedTxns = _(after).map(a => {
		const l = _(before).find(la => la.symbol === a.symbol && la.wallet === a.wallet)
		if (!l) {
			if (a.amount !== 0) {
				return {
					uuid: uid,
					assetID: a.id,
					wallet: a.wallet,
					symbol: a.symbol,
					amount: a.amount,
					price: a.price,
					txnType: 'buy',
					txnCreatedAt: a.createdAt,
					createdAt: a.createdAt,
				} as TransactionModel
			}
			return
		}
		if (a.amount === l.amount) {
			return
		}
		return {
			uuid: uid,
			assetID: a.id,
			wallet: a.wallet,
			symbol: a.symbol,
			amount: Math.abs(a.amount - l.amount),
			price: a.price,
			txnType: a.amount > l.amount ? 'buy' : 'sell',
			txnCreatedAt: a.createdAt,
		} as TransactionModel
	}).compact().value()
	const removedTxns = _(before).filter(la => !_(after).find(a => a.symbol === la.symbol && a.wallet === la.wallet)).map(la => {
		if (la.amount === 0) {
			return
		}
		return {
			uuid: uid,
			assetID: la.id,
			wallet: la.wallet,
			symbol: la.symbol,
			amount: la.amount,
			price: la.price,
			txnType: 'sell',
			txnCreatedAt: la.createdAt,
		} as TransactionModel
	}).compact().value()

	return [...updatedTxns, ...removedTxns]
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
	const lastAssets = _(await ASSET_HANDLER.listAssets(1)).flatten().value()

	const walletCoins = await queryCoinsDataByWalletCoins(_(assets).map(a => ({
		symbol: a.symbol,
		amount: a.amount,
		// wallet here dose not matter
		wallet: a.wallet ?? OthersAnalyzer.wallet
	})).value(), config, lastAssets, userProInfo)

	const assetRes = _(walletCoins).map(t => {
		const ast = {
			symbol: t.symbol,
			amount: t.amount,
			value: t.usdValue,
			price: t.price,
		}
		// check if there are assets without price, if exits, use the last price
		// sometimes coin price is provided by erc20 provider or cex, so it may not be existed in coin price query service ( coingecko )
		const lastAst = _(assets).find(a => a.symbol === t.symbol)
		if (lastAst && ast.amount !== lastAst.amount) {
			ast.amount = lastAst.amount
			ast.value = lastAst.value
			ast.price = lastAst.price
		}
		return ast
	}).value()

	// 15 min ttl
	cache.setCache(cacheKey, assetRes, 15 * 60)
	return assetRes
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
	// if it is undefined, means "∞"
	percentage?: number,
	coins: {
		symbol: string,
		// coin profit
		value: number
		// coin profit percentage
		// if it is undefined, means "∞"
		percentage?: number

		buyAmount: number,
		sellAmount: number,
		costAvgPrice: number,
		sellAvgPrice: number,
	}[]
}

export async function queryTransactionsBySymbolAndDateRange(symbol: string, dateRange: TDateRange): Promise<Transaction[]> {
	const models = await TRANSACTION_HANDLER.listTransactionsByDateRange(dateRange.start, dateRange.end, symbol)
	return _(models).flatten().map(m => ({
		id: m.id,
		assetID: m.assetID,
		uuid: m.uuid,
		symbol: m.symbol,
		wallet: m.wallet,
		amount: m.amount,
		price: m.price,
		txnType: m.txnType,
		txnCreatedAt: m.txnCreatedAt,
	})).value()
}

// calculate total profit from transactions
export async function calculateTotalProfit(dateRange: TDateRange, symbol?: string): Promise<TotalProfit & { lastRecordDate?: Date | string }> {
	const cache = getLocalStorageCacheInstance(CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY)
	const key = `${dateRange.start.getTime()}-${dateRange.end.getTime()}-${symbol ?? "all"}`
	const c = cache.getCache<TotalProfit>(key)
	if (c) {
		return c
	}

	// const allAssets = await ASSET_HANDLER.listAssetsByDateRange(dateRange.start, dateRange.end)
	const latestAssets = await ASSET_HANDLER.listAssetsMaxCreatedAt(dateRange.start, dateRange.end, symbol)
	// group latestAssets by symbol, can sum amount and value
	const dateRangeAssets = _(latestAssets).groupBy("symbol").map((assets, symbol) => {
		const allAmount = _(assets).sumBy("amount")
		const allValue = _(assets).sumBy("value")
		return {
			symbol,
			price: allAmount === 0 ? 0 : allValue / allAmount,
			amount: allAmount,
			value: allValue,
			// all createdAt are same, so just get the first one
			createdAt: _(assets).first()?.createdAt
		}
	}).value()
	const earliestAssets = await ASSET_HANDLER.listAssetsMinCreatedAt(dateRange.start, dateRange.end, symbol)

	const allTransactions = await TRANSACTION_HANDLER.listTransactionsByDateRange(dateRange.start, dateRange.end, symbol)
	// todo: handle if one asset has multiple transactions
	const allTransactionsAssetIdMap = _(allTransactions).flatten().groupBy("assetID").mapValues(t => t[0]).value()

	const dateRangeEarliestAssets = _(earliestAssets).groupBy("symbol").map((assets, symbol) => {
		const bsAssets = _(assets).filter(a => {
			const txn = allTransactionsAssetIdMap[a.id]
			return !txn || isTransactionBuyOrSell(txn)
		}).value()
		const allAmount = _(bsAssets).sumBy("amount")
		const allValue = _(bsAssets).map(a => (allTransactionsAssetIdMap[a.id]?.price ?? a.price) * a.amount).sum()
		return {
			symbol,
			price: allAmount === 0 ? 0 : allValue / allAmount,
			amount: allAmount,
			value: allValue,
			// all createdAt are same, so just get the first one
			createdAt: _(assets).first()?.createdAt
		}
	}).value()

	const groupedTransactions = _(allTransactions).flatten().groupBy("symbol").map((txns, symbol) => {
		const symbolTxns = _(txns).sortBy('txnCreatedAt').map(txn => {
			if (!isTransactionBuyOrSell(txn)) {
				return
			}

			return transformTransactionModelToAssetAction(txn)
		}).compact().value()
		return {
			symbol,
			latest: _(dateRangeAssets).find(a => a.symbol === txns[0].symbol),
			actions: symbolTxns
		}
	}).value()
	const coins = _(groupedTransactions).map(d => {
		if (!d.latest) {
			return
		}
		const beforeBuyAmount = _(dateRangeEarliestAssets).find(a => a.symbol === d.symbol)?.amount ?? 0

		const beforeCost = _(dateRangeEarliestAssets).find(a => a.symbol === d.symbol)?.value ?? 0
		const beforeCreatedAt = _(dateRangeEarliestAssets).find(a => a.symbol === d.symbol)?.createdAt
		const beforeSellAmount = 0
		const beforeSell = 0
		// filter out transactions before the first buy
		const afterActions = _(d.actions).filter(a => beforeCreatedAt === undefined || a.changedAt > beforeCreatedAt).value()

		const buyAmount = _(afterActions).filter(a => a.amount > 0).sumBy((a) => a.amount) + beforeBuyAmount

		const sellAmount = _(afterActions).filter(a => a.amount < 0).sumBy((a) => -a.amount) + beforeSellAmount
		const cost = _(afterActions).filter(a => a.amount > 0).sumBy((a) => a.amount * a.price) + beforeCost
		const sell = _(afterActions).filter(a => a.amount < 0).sumBy((a) => -a.amount * a.price) + beforeSell
		const costAvgPrice = buyAmount === 0 ? 0 : cost / buyAmount
		const sellAvgPrice = sellAmount === 0 ? 0 : sell / sellAmount

		const lastPrice = d.latest.price

		const lastAmount = d.latest.amount

		const realizedProfit = sellAmount * (sellAvgPrice - costAvgPrice)
		const unrealizedProfit = lastAmount * (lastPrice - costAvgPrice)

		const percentage = cost === 0 ? undefined : (realizedProfit + unrealizedProfit) / cost * 100
		return {
			symbol: d.symbol,
			value: realizedProfit + unrealizedProfit,
			realSpentValue: cost,
			buyAmount,
			sellAmount,
			costAvgPrice,
			sellAvgPrice,
			percentage,
		}
	}).compact().value()

	const total = _(coins).sumBy(c => c.value)
	const totalRealSpent = _(coins).sumBy(c => c.realSpentValue)

	const lrd = _(latestAssets).maxBy(a => new Date(a.createdAt).getTime())?.createdAt

	const resp = {
		total,
		percentage: totalRealSpent === 0 ? undefined : total / totalRealSpent * 100,
		coins,
		lastRecordDate: lrd ? new Date(lrd) : undefined
	}
	cache.setCache<TotalProfit>(key, resp)
	return resp
}

export function cleanTotalProfitCache() {
	const cache = getLocalStorageCacheInstance(CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY)
	cache.clearCache()
}

export async function updateTransactionPrice(id: number, price: number) {
	const txnModel = await TRANSACTION_HANDLER.getTransactionByID(id)
	await TRANSACTION_HANDLER.createOrUpdate({
		...txnModel,
		price
	})
}

export async function updateTransactionTxnType(id: number, txnType: TransactionType) {
	const txnModel = await TRANSACTION_HANDLER.getTransactionByID(id)
	await TRANSACTION_HANDLER.createOrUpdate({
		...txnModel,
		txnType
	})
}

// return dates which has data
export async function getAvailableDates(): Promise<Date[]> {
	const dates = await ASSET_HANDLER.getHasDataCreatedAtDates()
	// return asc sort
	return _(dates).reverse().value()
}

async function queryCoinsDataByWalletCoins(assets: WalletCoin[], config: GlobalConfig, lastAssets: AssetModel[], userProInfo: UserLicenseInfo, addProgress?: AddProgressFunc): Promise<WalletCoinUSD[]> {
	// always query btc and usdt price
	const priceMap = await queryCoinPrices(_(assets).filter(a => !a.price).map("symbol").push("USDT").push("BTC").uniq().compact().value(), userProInfo)
	if (addProgress) {
		addProgress(10)
	}

	const stableCoins = await queryStableCoins()

	const upperCaseStableCoins = _(stableCoins).map(c => c.toUpperCase()).value()

	let latestAssets = _.clone(assets)
	const groupUSD: boolean = _(config).get(['configs', 'groupUSD']) || false

	if (groupUSD) {
		_(assets).groupBy('wallet').forEach((coins, wallet) => {
			// not case sensitive
			const usdAmount = _(coins).filter(c => upperCaseStableCoins.includes(c.symbol.toUpperCase())).map(c => c.amount).sum()
			const removedUSDCoins = _(coins).filter(c => !upperCaseStableCoins.includes(c.symbol.toUpperCase())).value()
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
	const filteredTotals = _(totals).filter(t => {
		if (t.usdValue > 1) {
			return true
		}
		const totalWallet = md5(t.wallet)
		const lastAsset = _(lastAssets).find(a => a.symbol === t.symbol && (a.wallet === totalWallet || a.wallet === t.wallet))

		// not found in last asset, which means coin has already been removed before last record
		if (!lastAsset) {
			return false
		}
		// coin has been sold out in last time
		if (lastAsset.amount === 0) {
			return false
		}
		// already handled in loadPortfolios
		if (t.amount === 0) {
			return true
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
async function queryCoinsData(lastAssets: AssetModel[], addProgress: AddProgressFunc): Promise<WalletCoinUSD[]> {
	addProgress(1)
	const config = await getConfiguration()
	if (!config) {
		throw new Error("no configuration found,\n please add configuration first")
	}
	addProgress(2)
	// check if pro user
	const userProInfo = await isProVersion()
	addProgress(2)
	// will add 70 percent progress in load portfolios
	const assets = await loadPortfolios(config, lastAssets, addProgress, userProInfo)

	return queryCoinsDataByWalletCoins(assets, config, lastAssets, userProInfo, addProgress)
}

export async function queryAssetMaxAmountBySymbol(symbol: string): Promise<number> {
	return ASSET_HANDLER.getMaxAmountBySymbol(symbol)
}

// return all transactions for exporting data
export function queryAllTransactions(): Promise<TransactionModel[]> {
	return TRANSACTION_HANDLER.listTransactions()
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

async function deleteTransactionsByUUID(uuid: string): Promise<void> {
	return TRANSACTION_HANDLER.deleteTransactionsByUUID(uuid)
}

async function deleteTransactionsByAssetID(id: number): Promise<void> {
	return TRANSACTION_HANDLER.deleteTransactionsByAssetID(id)
}

export async function queryTotalValue(): Promise<TotalValueData> {
	const results = await ASSET_HANDLER.listSymbolGroupedAssets(1)

	if (results.length === 0) {
		return {
			totalValue: 0,
		}
	}

	const latest = results[0]

	const latestTotal = _(latest).sumBy("value") || 0

	return {
		totalValue: latestTotal,
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

export async function queryPNLChartValue(dateRange: TDateRange, maxSize = DATA_MAX_POINTS): Promise<PNLChartData> {

	const data = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(dateRange.start, dateRange.end)

	const step = data.length > maxSize ? Math.floor(data.length / maxSize) : 0

	return _(data).reverse().filter((_d, idx) => step === 0 || (idx % step) === 0).map(rs => ({
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
		latestTotalValue: _(pnlData).last()?.totalValue,
		todayPNL: getPNL(1),
		sevenTPnl: getPNL(8),
		thirtyPNL: getPNL(31),
	}
}

// returns top n coin symbols which have most value during the date range
export async function queryTopNAssets(dateRange: TDateRange, n: number): Promise<string[]> {
	const assets = await ASSET_HANDLER.listTopNAssetsByDateRange(n, dateRange.start, dateRange.end)

	return _(assets).map(a => a.symbol).value()
}

// return top 10 and other coins' percentage change during the date range
export async function queryAssetsPercentageChange(dataRange: TDateRange): Promise<AssetsPercentageChangeData> {
	const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(dataRange.start, dataRange.end)
	const reservedAssets = _(assets).reverse().value()
	const getPercentages = (asts: AssetModel[]): {
		timestamp: number,
		data: {
			symbol: string,
			percentage: number
		}[]
	} => {
		const total = _(asts).sumBy("value")
		// get top 10 coins and their percentage change
		if (total === 0) {
			return {
				timestamp: new Date(asts[0]?.createdAt).getTime(),
				data: _(asts).map(a => ({
					symbol: a.symbol,
					percentage: 0
				})).value()
			}
		}

		return {
			timestamp: new Date(asts[0]?.createdAt).getTime(),
			data: _(asts).map(a => ({
				symbol: a.symbol,
				percentage: a.value / total * 100
			})).value()
		}
	}

	const data = _(reservedAssets).map((asts) => getPercentages(asts)).value()
	return _(data).map(d => ({
		timestamp: d.timestamp,
		percentages: d.data,
	})).value()
}

export async function queryTopCoinsRank(dateRange: TDateRange, maxSize = DATA_MAX_POINTS): Promise<TopCoinsRankData> {

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


	const step = reservedAssets.length > maxSize ? Math.floor(reservedAssets.length / maxSize) : 0
	const filteredReservedAssets = _(reservedAssets).filter((_d, idx) => step === 0 || (idx % step) === 0).value()
	const coins = getCoins(filteredReservedAssets)
	const colors = generateRandomColors(coins.length)

	return {
		timestamps: _(filteredReservedAssets).flatten().map(t => new Date(t.createdAt).getTime()).uniq().value(),
		coins: _(coins).map((coin, idx) => ({
			coin,
			lineColor: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
			rankData: getRankData(coin),
		})).value()
	}
}

export async function queryTopCoinsPercentageChangeData(dateRange: TDateRange, maxSize = DATA_MAX_POINTS): Promise<TopCoinsPercentageChangeData> {
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


	const step = reservedAssets.length > maxSize ? Math.floor(reservedAssets.length / maxSize) : 0
	const filteredReservedAssets = _(reservedAssets).filter((_d, idx) => step === 0 || (idx % step) === 0).value()
	const coins = getCoins(filteredReservedAssets)
	const colors = generateRandomColors(coins.length)

	return {
		timestamps: _(filteredReservedAssets).flatten().map(t => new Date(t.createdAt).getTime()).uniq().value(),
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

export async function queryAssetChange(dateRange: TDateRange, maxSize = DATA_MAX_POINTS): Promise<AssetChangeData> {

	const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(dateRange.start, dateRange.end)

	const step = assets.length > maxSize ? Math.floor(assets.length / maxSize) : 0
	const reservedAssets = _(assets).reverse().filter((_d, idx) => step === 0 || (idx % step) === 0).value()

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

export async function queryCoinsAmountChange(symbol: string, dateRange: TDateRange, maxSize = DATA_MAX_POINTS): Promise<CoinsAmountAndValueChangeData | undefined> {
	const assets = await ASSET_HANDLER.listAssetsBySymbolByDateRange(symbol, dateRange.start, dateRange.end)
	if (!assets) {
		return
	}

	const reservedAssets = _(assets).reverse().value()


	const getAmountsAndTimestamps = (models: AssetModel[][]): {
		amount: number,
		value: number,
		timestamp: number
	}[] => {
		return _(models).map(assets => {
			return {
				amount: _(assets).sumBy("amount"),
				value: _(assets).sumBy("value"),
				timestamp: new Date(assets[0].createdAt).getTime(),
			}
		}).value()
	}


	const aat = getAmountsAndTimestamps(reservedAssets)
	const step = aat.length > maxSize ? Math.floor(aat.length / maxSize) : 0
	const reservedAat = _(aat).filter((_d, idx) => step === 0 || (idx % step) === 0).value()

	return {
		coin: symbol,
		amounts: _(reservedAat).map('amount').value(),
		values: _(reservedAat).map('value').value(),
		timestamps: _(reservedAat).map('timestamp').value(),
	}
}

// gather: if true, group asset models by same symbol
export async function queryHistoricalData(size = 30, gather = true): Promise<HistoricalData[]> {
	const assetModels = gather ? await ASSET_HANDLER.listSymbolGroupedAssets(size) : await ASSET_HANDLER.listAssets(size)
	const uuids = _(assetModels).flatMap(m => _(m).map('uuid').value()).compact().uniq().value()
	const transactionModels = await TRANSACTION_HANDLER.listTransactionsByUUIDs(uuids)

	const assetsModelsToHistoricalData = (ams: AssetModel[]): HistoricalData => {
		const uuid = _(ams).first()!.uuid
		return {
			id: uuid,
			createdAt: _(ams).first()!.createdAt,
			assets: ams,
			transactions: _(transactionModels).filter(t => t.uuid === uuid).value(),
			total: _(ams).sumBy('value'),
		}
	}

	return _(assetModels).map(m => assetsModelsToHistoricalData(m)).value()
}

// return all total values order by timestamp asc
export async function queryTotalValues(dateRange: TDateRange): Promise<TotalValuesData> {
	const data = await ASSET_HANDLER.listTotalValueRecords(dateRange.start, dateRange.end)

	return _(data).map(rs => ({
		totalValue: rs.totalValue,
		timestamp: new Date(rs.createdAt).getTime(),
	})).value()
}

// delete batch records by uuid
export async function deleteHistoricalDataByUUID(uuid: string): Promise<void> {
	await deleteAssetByUUID(uuid)
	// !also delete assets related transactions
	await deleteTransactionsByUUID(uuid)
}

// delete single record by id
export async function deleteHistoricalDataDetailById(id: number): Promise<void> {
	await deleteAssetByID(id)
	// !also delete assets related transactions
	await deleteTransactionsByAssetID(id)
}

export async function restoreHistoricalData(data: RestoreHistoricalData): Promise<void> {
	const { assets, transactions } = data

	await ASSET_HANDLER.saveAssets(assets)
	// await ASSET_PRICE_HANDLER.savePrices(prices)
	await TRANSACTION_HANDLER.saveTransactions(transactions)
}

export async function queryRestoreHistoricalData(id: string | number): Promise<RestoreHistoricalData> {
	// if id is number => it's asset id
	// if id is string => it's asset uuid
	const isUUID = _(id).isString()
	const assets = isUUID ? await ASSET_HANDLER.listAssetsByUUIDs([id as string]) : await ASSET_HANDLER.listAssetsByIDs([id as number])
	const transactions = isUUID ? await TRANSACTION_HANDLER.listTransactionsByUUIDs([id as string]) : await TRANSACTION_HANDLER.listTransactionsByAssetID(id as number)

	return {
		assets,
		transactions,
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

function transformTransactionModelToAssetAction(txn: TransactionModel): AssetAction {
	return {
		assetID: txn.assetID,
		uuid: txn.uuid,
		symbol: txn.symbol,
		wallet: txn.wallet,
		amount: ["sell", "withdraw"].includes(txn.txnType) ? -txn.amount : txn.amount,
		price: txn.price,
		changedAt: txn.txnCreatedAt
	}
}

function isTransactionBuyOrSell(txn: Transaction) {
	return txn.txnType === "buy" || txn.txnType === "sell"
}
