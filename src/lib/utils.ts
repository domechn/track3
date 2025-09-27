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
 * @param wallet - Wallet address (MD5 hashed)
 * @returns Wallet address with "md5:" prefix
 */
export function addMD5PrefixToWallet(wallet: string): string {
  const md5Prefix = "md5:"
  return wallet.startsWith(md5Prefix) ? wallet : md5Prefix + wallet
}

/**
 * Check if two wallet addresses are the same (handles MD5 normalization)
 * @param wallet1 - First wallet address
 * @param wallet2 - Second wallet address
 * @returns True if wallets are the same after normalization
 */
export function isSameWallet(wallet1: string, wallet2: string): boolean {
  return normalizeWalletToMD5(wallet1) === normalizeWalletToMD5(wallet2)
}
