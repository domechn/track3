import { iosHaptic } from "@/utils/ios-native"
import { isIOS } from "@/utils/platform"

export function useHaptics() {
  return (kind: "selection" | "light" | "success" = "selection") => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    if (isIOS()) {
      void iosHaptic(kind === "success" ? "success" : "light").catch(() => {})
      return
    }
    navigator.vibrate?.(kind === "success" ? [12, 28, 12] : kind === "light" ? 8 : 5)
  }
}
