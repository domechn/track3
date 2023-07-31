import _ from 'lodash'
import { getConfiguration } from './configuration'
import { CexAnalyzer } from './datafetch/coins/cex/cex'
import md5 from 'md5'
import { Addresses } from './datafetch/types'
import { AssetModel, WalletAssetsChangeData, WalletAssetsPercentageData } from './types'
import { generateRandomColors } from '../utils/color'

export class WalletAnalyzer {

	// key is wallet address md5 hash
	// "wallet" in value is original wallet address
	private walletAliases: { [k: string]: { wallet: string, alias: string, type: string } | undefined } = {}

	private queryAssets: (size?: number) => Promise<AssetModel[][]>

	constructor(queryAssets: (size?: number) => Promise<AssetModel[][]>) {
		this.queryAssets = queryAssets
	}

	private async listWalletAliases(walletMd5s: string[]): Promise<{ [k: string]: { wallet: string, alias: string, type: string } | undefined }> {
		const unknownAliasWallets = _(walletMd5s).filter(w => !_(this.walletAliases).has(w)).value()

		if (unknownAliasWallets.length === 0) {
			return this.walletAliases
		}
		const config = await getConfiguration()

		if (!config) {
			return {}
		}

		const aliases: {
			// wallet hash
			walletType: string
			wallet: string
			walletMd5: string
			alias: string
		}[] = []

		// cex exchanges
		const cexAna = new CexAnalyzer(config)
		_(cexAna.listExchangeIdentities()).forEach(x => {
			aliases.push({
				walletType: x.exchangeName,
				// need md5 here, because when we store it in database, it is md5 hashed
				walletMd5: md5(x.identity),
				wallet: x.identity,
				alias: x.alias || x.identity,
			})
		})

		const handleWeb3Wallet = (addrs: Addresses, walletType: string) => {
			_(addrs.addresses).forEach(x => {
				const alias = _(x).isString() ? undefined : (x as { alias: string, address: string }).alias
				const address = _(x).isString() ? x as string : (x as { alias: string, address: string }).address
				aliases.push({
					walletType,
					walletMd5: md5(address),
					wallet: address,
					alias: alias || address,
				})
			})
		}

		// BTC
		handleWeb3Wallet(config.btc, "BTC")
		// ETH
		handleWeb3Wallet(config.erc20, "ERC20")
		// Doge
		handleWeb3Wallet(config.doge, "DOGE")
		// SOL
		handleWeb3Wallet(config.sol, "SOL")

		const others = "others"
		const Others = _(others).upperFirst()

		// Others
		aliases.push({
			walletType: Others,
			walletMd5: md5(others),
			wallet: others,
			alias: Others,
		})

		const newAliases: { [k: string]: { wallet: string, alias: string, type: string } | undefined } = _(unknownAliasWallets).map(w => {
			const alias = _(aliases).find(x => x.walletMd5 === w)
			return {
				[w]: alias ? {
					// limit alias to 64 characters
					alias: alias.walletType === Others ? alias.walletType : alias.alias,
					wallet: alias.wallet,
					type: alias.walletType,
				} : undefined
			}
		}).reduce((a, b) => ({ ...a, ...b }), {})

		// save to cache
		this.walletAliases = {
			...this.walletAliases,
			...newAliases,
		}
		return this.walletAliases
	}

	loadWalletTotalAssetsValue(models: AssetModel[]): { wallet: string, total: number }[] {
		return _(models).groupBy('wallet')
			.map((walletAssets, wallet) => {
				const total = _(walletAssets).sumBy("value")
				return {
					wallet,
					total,
				}
			}).value()
	}

	public async queryWalletAssetsPercentage(): Promise<WalletAssetsPercentageData> {
		const assets = (await this.queryAssets(1))[0]
		// check if there is wallet column
		const hasWallet = _(assets).find(a => !!a.wallet)
		if (!assets || !hasWallet) {
			return []
		}
		const walletAssets = this.loadWalletTotalAssetsValue(assets)
		const total = _(walletAssets).sumBy("total") || 0.0001
		const wallets = _(walletAssets).map('wallet').uniq().compact().value()
		const backgroundColors = generateRandomColors(wallets.length)
		const walletAliases = await this.listWalletAliases(wallets)

		return _(walletAssets).map((wa, idx) => ({
			wallet: walletAliases[wa.wallet]?.wallet ?? wa.wallet,
			walletType: walletAliases[wa.wallet]?.type,
			walletAlias: walletAliases[wa.wallet]?.alias,
			chartColor: `rgba(${backgroundColors[idx].R}, ${backgroundColors[idx].G}, ${backgroundColors[idx].B}, 1)`,
			percentage: wa.total / total * 100,
			value: wa.total,
		})).sortBy("percentage").reverse().value()
	}

	public async queryWalletAssetsChange(): Promise<WalletAssetsChangeData> {
		const assets = await this.queryAssets(2)
		const latestAssets = assets[0]
		const previousAssets = assets[1]

		const latestWalletAssets = _(this.loadWalletTotalAssetsValue(latestAssets)).mapKeys('wallet').mapValues('total').value()
		const previousWalletAssets = _(this.loadWalletTotalAssetsValue(previousAssets)).mapKeys('wallet').mapValues('total').value()

		const walletAliases = await this.listWalletAliases(_(latestWalletAssets).keys().uniq().compact().value())
		const res: WalletAssetsChangeData = []
		// calculate change
		_(latestWalletAssets).keys()
			.forEach(wallet => {
				const latest = latestWalletAssets[wallet]
				const previous = previousWalletAssets[wallet]

				if (!previous) {
					res.push({
						wallet: walletAliases[wallet]?.wallet ?? wallet,
						walletType: walletAliases[wallet]?.type,
						walletAlias: walletAliases[wallet]?.alias,
						changePercentage: 100,
						changeValue: latest,
					})
					return
				}

				res.push({
					wallet: walletAliases[wallet]?.wallet ?? wallet,
					walletType: walletAliases[wallet]?.type,
					walletAlias: walletAliases[wallet]?.alias,
					changePercentage: (latest - previous) / previous * 100,
					changeValue: latest - previous,
				})
			})
		return _(res).sortBy("changeValue").reverse().value()
	}

}
