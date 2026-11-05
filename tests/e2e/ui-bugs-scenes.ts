import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";
import { installTauriBridge as installDesktopFidelityBridge } from "./fidelity-desktop-scenes";
import { installTauriBridge as installMobileFidelityBridge } from "./fidelity-scenes";

export async function installManySourceCoinFixture(page: Page) {
  const mobile = /iPhone|iPad/.test(await page.evaluate(() => navigator.userAgent));
  if (mobile) await installMobileFidelityBridge(page, { fidelitySample: "BTC" });
  else await installDesktopFidelityBridge(page, { fidelityDesktop: "full" });
  const ids = Array.from({ length: 14 }, (_, index) =>
    createHash("md5").update(`extra-btc-source-${index}`).digest("hex").slice(0, 10));
  await page.evaluate(async ({ ids: wallets, mobile }) => {
    for (const [index, wallet] of wallets.entries()) {
      await (window as any).__e2eInvoke("plugin:sql|execute", {
        query: `INSERT INTO assets_v2
          (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES (?, '2026-10-31T09:41:00.000Z', ?, 'crypto', 'BTC', 0.01, ?, 58200)`,
        values: [mobile ? "fidelity-day-30" : "fidelity-oct-31", wallet, 582 + index],
      });
    }
  }, { ids, mobile });
}

export async function installManySourceFixture(page: Page, sources: number, groups = 47) {
  await installTauriBridge(page);
  const ids = Array.from({ length: sources }, (_, index) =>
    createHash("md5").update(`wallet-${index}`).digest("hex"));
  await page.evaluate(async ({ ids, groups }) => {
    const invoke = (window as any).__e2eInvoke;
    await invoke("plugin:sql|execute", { query: "DELETE FROM assets_v2", values: [] });
    for (const [uuid, createdAt, offset] of [
      ["many-old", "2026-09-01T09:00:00.000Z", 0],
      ["many-new", "2026-10-31T09:00:00.000Z", 10],
    ] as const) {
      for (let index = 0; index < groups; index++) {
        const value = 100 + index + offset;
        await invoke("plugin:sql|execute", {
          query: "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
          values: [uuid, createdAt, ids[index % ids.length], index % ids.length === ids.length - 1 ? "stock" : "crypto",
            `COIN${String(index + 1).padStart(2, "0")}`, value, value],
        });
      }
    }
  }, { ids, groups });
}
