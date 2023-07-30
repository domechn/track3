import _ from 'lodash'
import { getConfiguration } from './configuration'
import { CexAnalyzer } from './datafetch/coins/cex/cex'
import md5 from 'md5'
import { Addresses } from './datafetch/types'

export async function listWalletAliases(wallets: string[]): Promise<{ [k: string]: string | undefined }> {
	const config = await getConfiguration()

	if (!config) {
		return {}
	}

	const aliases: {
		// wallet hash
		walletType: string
		wallet: string
		alias: string
	}[] = []

	// cex exchanges
	const cexAna = new CexAnalyzer(config)
	_(cexAna.listExchangeIdentities()).forEach(x => {
		aliases.push({
			walletType: x.exchangeName,
			// need md5 here, because when we store it in database, it is md5 hashed
			wallet: md5(x.identity),
			alias: x.alias || x.identity,
		})
	})

	const handleWeb3Wallet = (addrs: Addresses, walletType: string) => {
		_(addrs.addresses).forEach(x => {
			const alias = _(x).isString() ? undefined : (x as { alias: string, address: string }).alias
			const address = _(x).isString() ? x as string : (x as { alias: string, address: string }).address
			aliases.push({
				walletType,
				wallet: md5(address),
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
		wallet: md5(others),
		alias: Others,
	})

	return _(wallets).map(w => {
		const alias = _(aliases).find(x => x.wallet === w)
		return {
			[w]: alias ? alias.walletType === Others ? alias.walletType : alias?.walletType + "-" + alias?.alias : undefined
		}
	}).reduce((a, b) => ({ ...a, ...b }), {})
}
