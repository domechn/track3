import { queryLastRefreshAt } from "@/middlelayers/charts"
import { getConfiguration } from "@/middlelayers/configuration"
import { SUPPORT_CONS } from "@/middlelayers/constants"
import type { GlobalConfig } from "@/middlelayers/datafetch/types"
import { readOnboardingState, writeOnboardingState } from "./onboarding-storage"
export { ONBOARDING_REPLAY_EVENT, ONBOARDING_STORAGE_KEY, readOnboardingState, requestOnboardingReplay, writeOnboardingState } from "./onboarding-storage"
export type { OnboardingState } from "./onboarding-storage"

export function hasAnyConfiguredSource(config?: GlobalConfig): boolean {
  if (!config) return false
  return Boolean(
    config.exchanges?.length ||
    config.stockConfig?.brokers?.length ||
    config.others?.length ||
    SUPPORT_CONS.some((chain) => config[chain as keyof GlobalConfig] && (config[chain as keyof GlobalConfig] as { addresses?: unknown[] }).addresses?.length)
  )
}

export async function shouldAutoStartOnboarding(): Promise<boolean> {
  if (readOnboardingState()) return false
  try {
    const [history, config] = await Promise.all([queryLastRefreshAt(), getConfiguration()])
    if (readOnboardingState()) return false
    if (history || hasAnyConfiguredSource(config)) {
      writeOnboardingState("existing")
      return false
    }
    return true
  } catch {
    return false
  }
}

