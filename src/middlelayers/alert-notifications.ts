import { isTauri } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { TriggeredAlert } from "./alerts";

type AlertText = Pick<TriggeredAlert, "kind" | "value" | "title" | "message" | "symbol">;

export function formatAlert(alert: AlertText, t?: (key: string) => string): { title: string; message: string } {
  if (!t) return { title: alert.title, message: alert.message };
  const title = `${t(`goals.kind.${alert.kind}`)}${alert.symbol ? ` ${alert.symbol}` : ""}`;
  return {
    title,
    message: t("goals.alertTriggered").replace("{kind}", title).replace("{value}", alert.value.toFixed(2)),
  };
}

export async function systemNotificationsEnabled(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await isPermissionGranted();
  } catch {
    return false;
  }
}

export async function enableSystemNotifications(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await isPermissionGranted() || await requestPermission() === "granted";
  } catch {
    return false;
  }
}

export async function deliverAlerts(
  alerts: TriggeredAlert[],
  fallback: (alert: TriggeredAlert) => void,
  t?: (key: string) => string,
): Promise<void> {
  if (!alerts.length) return;
  const allowed = await systemNotificationsEnabled();
  for (const alert of alerts) {
    if (allowed) {
      try {
        const text = formatAlert(alert, t);
        sendNotification({ title: text.title, body: text.message });
        continue;
      } catch {
        // Fall back for this alert.
      }
    }
    fallback(alert);
  }
}
