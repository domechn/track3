import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
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
import UnknownLogo from "@/assets/icons/unknown-logo.svg"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getWalletLogo(type: string) {
  switch (type.toLowerCase()) {
    case "binance":
      return BinanceLogo
    case "okex":
      return OkexLogo
    case "bitget":
      return BitgetLogo
    case "gate":
      return GateLogo
    case "kraken":
      return KrakenLogo
    case "btc":
      return BTCLogo
    case "erc20":
      return ETHLogo
    case "sol":
      return SOLLogo
    case "doge":
      return DOGELogo
    case "trc20":
      return TRONLogo
    case "ton":
      return TONLogo
    default:
      return UnknownLogo
  }
}
