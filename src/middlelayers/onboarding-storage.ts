export const ONBOARDING_STORAGE_KEY = "track3-onboarding-v1"
export const ONBOARDING_REPLAY_EVENT = "track3:onboarding-replay"
export type OnboardingState = "completed" | "skipped" | "existing"

export function readOnboardingState(): string | null | "unreadable" {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY)
  } catch {
    return "unreadable"
  }
}

export function writeOnboardingState(value: OnboardingState): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, value)
  } catch {
    // The guide still closes when storage is unavailable.
  }
}

export function requestOnboardingReplay(): void {
  window.dispatchEvent(new Event(ONBOARDING_REPLAY_EVENT))
}
