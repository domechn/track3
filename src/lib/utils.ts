import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import UnknownLogo from "@/assets/icons/unknown-logo.svg"
import { WALLET_LOGS } from '@/middlelayers/constants'
import md5 from 'md5'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getWalletLogo(type: string) {
  return WALLET_LOGS[type.toLowerCase()] ?? UnknownLogo
}

/**
 * Normalize wallet address to MD5 hash format
 * Handles both cases: with "md5:" prefix and without
 * @param wallet - Wallet address (may or may not have "md5:" prefix)
 * @returns MD5 hashed wallet address without prefix
 */
export function normalizeWalletToMD5(wallet: string): string {
  const md5Prefix = "md5:"
  return wallet.startsWith(md5Prefix) ? wallet.substring(md5Prefix.length) : md5(wallet)
}

/**
 * Add "md5:" prefix to wallet address
 * @param wallet - Wallet address (any format)
 * @returns Wallet address with "md5:" prefix
 */
export function addMD5PrefixToWallet(wallet: string): string {
  const md5Prefix = "md5:"
  return wallet.startsWith(md5Prefix) ? wallet : md5Prefix + wallet
}

/**
 * Check if two wallet addresses are the same (handles all three wallet formats)
 * @param wallet1 - First wallet address (any format), md5:xxxx or xxxxx ( no prefix md5 hash ) or xxx ( not md5 hash )
 * @param wallet2 - Second wallet address (any format), md5:xxxx or xxxxx ( no prefix md5 hash ) or xxx ( not md5 hash )
 * @returns True if wallets are the same after normalization
 */
export function isSameWallet(wallet1: string, wallet2: string): boolean {
  const md5Prefix = "md5:"
  const wallet1WithoutPrefix = wallet1.startsWith(md5Prefix) ? wallet1.substring(md5Prefix.length) : wallet1
  const wallet2WithoutPrefix = wallet2.startsWith(md5Prefix) ? wallet2.substring(md5Prefix.length) : wallet2

  const wallet1MD5 = md5(wallet1WithoutPrefix)
  const wallet2MD5 = md5(wallet2WithoutPrefix)
  return (
    wallet1WithoutPrefix === wallet2WithoutPrefix ||
    wallet2MD5 === wallet1WithoutPrefix ||
    wallet1MD5 === wallet2WithoutPrefix
  )
}
