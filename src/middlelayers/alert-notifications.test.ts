import { beforeEach, expect, it, vi } from "vitest";
import { deliverAlerts, enableSystemNotifications, formatAlert, systemNotificationsEnabled } from "./alert-notifications";
import { isTauri } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { TriggeredAlert } from "./alerts";
import zh from "@/i18n/locales/zh.json";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(), requestPermission: vi.fn(), sendNotification: vi.fn(),
}));
const alert: TriggeredAlert = {
  ruleId: 1, kind: "total_value_target", title: "Portfolio goal reached",
  message: "Portfolio goal reached: 1000.00", value: 1000,
  at: "2026-10-17T12:00:00.000Z",
};
beforeEach(() => vi.clearAllMocks());

it("reads an existing OS notification grant without requesting permission", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(isPermissionGranted).mockResolvedValue(true);
  expect(await systemNotificationsEnabled()).toBe(true);
  expect(requestPermission).not.toHaveBeenCalled();
});

it("falls back in a browser without asking for permission", async () => {
  vi.mocked(isTauri).mockReturnValue(false);
  const fallback = vi.fn();
  await deliverAlerts([alert], fallback);
  expect(fallback).toHaveBeenCalledWith(alert);
  expect(requestPermission).not.toHaveBeenCalled();
});

it("falls back when permission is denied and only requests on explicit enable", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(isPermissionGranted).mockResolvedValue(false);
  const fallback = vi.fn();
  await deliverAlerts([alert], fallback);
  expect(fallback).toHaveBeenCalledWith(alert);
  expect(requestPermission).not.toHaveBeenCalled();
  vi.mocked(requestPermission).mockResolvedValue("denied");
  expect(await enableSystemNotifications()).toBe(false);
  expect(requestPermission).toHaveBeenCalledTimes(1);
});

it("sends through the OS when already allowed", async () => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(isPermissionGranted).mockResolvedValue(true);
  const fallback = vi.fn();
  await deliverAlerts([alert], fallback);
  expect(sendNotification).toHaveBeenCalledWith({ title: alert.title, body: alert.message });
  expect(fallback).not.toHaveBeenCalled();
});

it("localizes alert content for the selected language", () => {
  const t = (key: string) => (zh as Record<string, string>)[key] ?? key;
  expect(formatAlert(alert, t)).toEqual({
    title: "投资组合价值目标",
    message: "投资组合价值目标已触发：1000.00",
  });
});
