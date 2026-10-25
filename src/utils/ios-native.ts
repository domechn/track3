import { invoke, isTauri } from "@tauri-apps/api/core";
import { isIOS } from "./platform";

function available() { return isIOS() && isTauri(); }

export async function appLockEnabled(): Promise<boolean> {
  return available() ? invoke<boolean>("ios_lock_enabled") : false;
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  if (!available()) throw new Error("iOS app lock is unavailable");
  if (!await invoke<boolean>("ios_authenticate")) throw new Error("Authentication was not completed");
  await invoke("ios_set_lock_enabled", { enabled });
}

export async function setAppBadge(count: number): Promise<void> {
  if (available()) await invoke("ios_set_badge", { count: Math.max(0, Math.floor(count)) });
}

export async function shareIOSFile(path: string): Promise<void> {
  if (!available()) throw new Error("iOS share sheet is unavailable");
  await invoke("ios_share_file", { path });
}

export async function iosHaptic(kind: "light" | "success" | "error" = "light"): Promise<void> {
  if (available()) await invoke("ios_haptic", { kind });
}
