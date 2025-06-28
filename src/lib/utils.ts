import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import UnknownLogo from "@/assets/icons/unknown-logo.svg"
import { WALLET_LOGS } from '@/middlelayers/constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getWalletLogo(type: string) {
  return WALLET_LOGS[type.toLowerCase()] ?? UnknownLogo
}
