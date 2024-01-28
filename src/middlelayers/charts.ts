import _ from 'lodash'
import { generateRandomColors } from '../utils/color'
import { AddProgressFunc, Asset, AssetAction, AssetChangeData, AssetModel, AssetPriceModel, CoinData, CoinsAmountAndValueChangeData, HistoricalData, LatestAssetsPercentageData, PNLData, TopCoinsPercentageChangeData, TopCoinsRankData, TotalValueData, WalletCoinUSD } from './types'

import { loadPortfolios, queryCoinPrices } from './data'
import { getConfiguration } from './configuration'
import { calculateTotalValue } from './datafetch/utils/coins'
import { timestampToDate } from '../utils/date'
import { WalletAnalyzer } from './wallet'
import { OthersAnalyzer } from './datafetch/coins/others'
import { ASSET_HANDLER } from './entities/assets'
import { ASSET_PRICE_HANDLER } from './entities/asset-prices'
import { Chart } from 'chart.js'
import md5 from 'md5'

const STABLE_COIN = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "PAX"]

export const WALLET_ANALYZER = new WalletAnalyzer((size) => ASSET_HANDLER.listAssets(size))

export async function refreshAllData(addProgress: AddProgressFunc) {
	// will add 90 percent in query coins data
	const coins = await queryCoinsData(addProgress)

	await ASSET_HANDLER.saveCoinsToDatabase(coins)
	addProgress(10)
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

// calculateTotalProfit gets all profit
export async function calculateTotalProfit(size: number): Promise<{
	total: number,
	coins: {
		symbol: string,
		value: number
	}[]
}> {
	const symbols = await ASSET_HANDLER.listAllSymbols()
	const allAssets = await ASSET_HANDLER.listAssets(size)
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
			value,
		}
	}).compact().value()

	return {
		total: _(coins).sumBy(c => c.value),
		coins
	}
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

async function queryCoinsData(addProgress: AddProgressFunc): Promise<WalletCoinUSD[]> {
	const config = await getConfiguration()
	if (!config) {
		throw new Error("no configuration found,\n please add configuration first")
	}
	addProgress(5)
	// will add 70 percent in load portfolios
	const assets = await loadPortfolios(config, addProgress)
	// always query btc and usdt price
	const priceMap = await queryCoinPrices(_(assets).filter(a => !a.price).map("symbol").push("USDT").push("BTC").uniq().compact().value())
	addProgress(10)

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

	// if item in totals exists in lastAssets and it's usdValue is less than 1, we think it has been sold out, so we need to update it's amount and value to 0
	const lastAssets = await ASSET_HANDLER.listAssets(1)
	for (const total of totals) {
		if (_(total.wallet).startsWith("md5:")) {
			// it means this asset has already handled before
			continue
		}
		const totalWallet = md5(total.wallet)
		// total.usdValue !== 0 && total.usdValue < 1 will also be handled before saving to database
		const lastAsset = _(lastAssets).flatten().find(a => a.symbol === total.symbol && a.wallet === totalWallet && total.usdValue !== 0 && total.usdValue < 1)
		if (lastAsset) {
			console.debug(`asset ${total.symbol} in wallet ${total.wallet} has been sold out, update it's amount and value to 0`)
			total.amount = 0
			total.usdValue = 0
		}
	}

	addProgress(5)
	return totals
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

export async function queryPNLValue(size = 10): Promise<PNLData> {
	// need to query size + 1 records to calculate first pnl data
	// take at least 35 records to calculate 30 days pnl
	const querySize = size < 30 ? 35 : size + 1
	// const querySize = size + 1

	const results = await ASSET_HANDLER.listSymbolGroupedAssets(querySize)

	const data = _(results).sort((a, b) => a[0].createdAt > b[0].createdAt ? 1 : -1).map(rs => ({
		totalValue: _(rs).sumBy("value"),
		timestamp: new Date(rs[0]?.createdAt).getTime(),
	})).value()

	const getPNL = (days: number) => {
		if (data.length < days + 1) {
			return
		}

		const pickData = data[data.length - days - 1]
		const val = data[data.length - 1].totalValue - pickData.totalValue
		return {
			value: val,
			timestamp: pickData.timestamp
		}
	}

	const realData = size + 1 !== querySize ? _(data).takeRight(size + 1).value() : data

	return {
		// take last size + 1 from data
		data: realData,
		todayPNL: getPNL(1),
		sevenTPnl: getPNL(8),
		thirtyPNL: getPNL(31),
	}
}

export async function queryTopCoinsRank(size = 10): Promise<TopCoinsRankData> {

	const assets = await ASSET_HANDLER.listSymbolGroupedAssets(size)

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
	const assets = await ASSET_HANDLER.listSymbolGroupedAssets(size)

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
	return lc ? timestampToDate(new Date(lc).getTime(), true) : undefined
}

function getCoins(assets: AssetModel[][], size = 10): string[] {
	// only take top 10 coins in each item
	return _(assets).map(as => _(as).sortBy('value').reverse().take(size > 0 ? size : _(as).size()).value()).flatten().map(a => a.symbol).uniq().value()
}

export async function queryAssetChange(size = 10): Promise<AssetChangeData> {

	const assets = await ASSET_HANDLER.listSymbolGroupedAssets(size)

	const reservedAssets = _(assets).reverse().value()

	return {
		timestamps: _(reservedAssets).flatten().map(t => new Date(t.createdAt).getTime()).uniq().value(),
		data: _(reservedAssets).map(ass => ({
			usdValue: _(ass).sumBy("value"),
			btcPrice: _(ass).find(a => a.symbol === "BTC")?.price,
		})).value(),
	}
}

export async function queryLatestAssetsPercentage(): Promise<LatestAssetsPercentageData> {
	const size = 1

	const assets = await ASSET_HANDLER.listSymbolGroupedAssets(size)
	if (assets.length === 0) {
		return []
	}

	const latest = assets[0]
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

export async function queryCoinsAmountChange(symbol: string, size = 10): Promise<CoinsAmountAndValueChangeData | undefined> {
	const assets = await ASSET_HANDLER.listAssetsBySymbol(symbol, size)
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
		amounts: _(aat).map('amount').reverse().take(size).reverse().value(),
		values: _(aat).map('value').reverse().take(size).reverse().value(),
		timestamps: _(aat).map('timestamp').reverse().take(size).reverse().value(),
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

export async function queryCoinDataByUUID(uuid: string): Promise<CoinData[]> {
	const models = await ASSET_HANDLER.listSymbolGroupedAssetsByUUID(uuid)

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
	const assets = await ASSET_HANDLER.listSymbolGroupedAssets()

	return _(assets)
		.map(ass => _(ass).first())
		.compact()
		.map(as => ({
			id: as.uuid,
			date: timestampToDate(new Date(as.createdAt).getTime())
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
