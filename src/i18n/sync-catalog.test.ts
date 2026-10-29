import { expect, it } from "vitest";
import desktopEn from "./locales/en.json";
import desktopZh from "./locales/zh.json";
import mobileEn from "@/mobile/en.json";
import mobileZh from "@/mobile/zh.json";

it("keeps the sync status copy present in both English and Chinese desktop and mobile catalogs", () => {
  const keys = [
    "sync.connection.timeout",
    "sync.status.skipped",
    "sync.status.skip",
    "sync.status.turnOffDevice",
    "sync.status.turnOffTitle",
    "sync.status.turnOffDescription",
    "sync.status.turnOffConfirm",
    "sync.status.lastSynced",
    "sync.status.never",
    "sync.status.running",
    "sync.status.started",
    "sync.status.elapsed",
    "sync.status.upToDate",
  ];
  for (const catalog of [desktopEn, desktopZh, mobileEn, mobileZh]) {
    for (const key of keys) {
      expect((catalog as Record<string, string>)[key], key).toBeTruthy();
    }
  }
  expect(Object.keys(desktopEn).sort()).toEqual(Object.keys(desktopZh).sort());
  expect(Object.keys(mobileEn).sort()).toEqual(Object.keys(mobileZh).sort());
});
