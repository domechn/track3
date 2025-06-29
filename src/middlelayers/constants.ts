import BinanceLogo from "@/assets/icons/binance-logo.svg"
import GateLogo from "@/assets/icons/gate-logo.svg"
import OkexLogo from "@/assets/icons/okex-logo.svg"
import BitgetLogo from "@/assets/icons/bitget-logo.svg"
import KrakenLogo from "@/assets/icons/kraken-logo.svg"
import BTCLogo from "@/assets/icons/btc-logo.svg"
import ETHLogo from "@/assets/icons/eth-logo.svg"
import SOLLogo from "@/assets/icons/sol-logo.svg"
import DOGELogo from "@/assets/icons/doge-logo.svg"
import TRONLogo from "@/assets/icons/tron-logo.svg"
import TONLogo from "@/assets/icons/ton-logo.svg"
import CoinbaseLogo from "@/assets/icons/coinbase-logo.jpg"
import SUILogo from "@/assets/icons/sui-logo.svg"

const dropsBotUrl = "https://drops.bot/address/"
const debankUrl = "https://debank.com/profile/"
const blockchainUrl = "https://www.blockchain.com/explorer/addresses/btc/"
const jupUrl = "https://portfolio.jup.ag/portfolio/"

export const SUPPORT_CONS = ["btc", "erc20", "sol", "doge", "trc20", "ton", "sui"]

export const WALLET_LOGS: { [k: string]: string } = {
	"binance": BinanceLogo,
	"okex": OkexLogo,
	"bitget": BitgetLogo,
	"gate": GateLogo,
	"kraken": KrakenLogo,
	"coinbase": CoinbaseLogo,
	"btc": BTCLogo,
	"erc20": ETHLogo,
	"sol": SOLLogo,
	"doge": DOGELogo,
	"trc20": TRONLogo,
	"ton": TONLogo,
	"sui": SUILogo,
}

// for select options when creating new exchange in configuration
export const CEX_OPTIONS = [
	{
		value: "binance",
		label: "Binance",
	},
	{
		value: "okex",
		label: "OKX",
	},
	{
		value: "bitget",
		label: "Bitget",
	},
	{
		value: "gate",
		label: "Gate.io",
	},
	{
		value: "kraken",
		label: "Kraken",
	},
	{
		value: "coinbase",
		label: "Coinbase",
	},
]

// for select options when creating new wallet in configuration
export const WALLET_OPTIONS = [
	{
		value: "btc",
		label: "BTC",
	},
	{
		value: "erc20",
		label: "ERC20",
	},
	{
		value: "sol",
		label: "SOL",
	},
	{
		value: "doge",
		label: "DOGE",
	},
	{
		value: "trc20",
		label: "TRC20 ( Pro )",
	},
	{
		value: "ton",
		label: "TON",
	},
	{
		value: "sui",
		label: "SUI",
	},
]

export const WALLET_AIRDROP_URLS: {
	[walletType: string]: (wallet: string) => string
} = {
	"ERC20": (wallet: string) => `${dropsBotUrl}${wallet}`,
	"BTC": (wallet: string) => `${dropsBotUrl}${wallet}`,
	"SOL": (wallet: string) => `${dropsBotUrl}${wallet}`,
	"SUI": (wallet: string) => `${dropsBotUrl}${wallet}`,
	"TON": (wallet: string) => `${dropsBotUrl}${wallet}`,
}

export const WALLET_DETAIL_URLS: {
	[walletType: string]: (wallet: string) => string
} = {
	"ERC20": (wallet: string) => `${debankUrl}${wallet}`,
	"BTC": (wallet: string) => `${blockchainUrl}${wallet}`,
	"SOL": (wallet: string) => `${jupUrl}${wallet}`,
}
