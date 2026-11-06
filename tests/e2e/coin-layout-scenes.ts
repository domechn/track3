import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";

export type CoinLayoutCase = "sixteen" | "twelve" | "single" | "three-days";

export async function seedCoinLayoutCase(page: Page, fixture: CoinLayoutCase) {
  const wallets = Array.from({ length: 14 }, (_, index) =>
    createHash("md5").update(`coin-layout-wallet-${index + 1}`).digest("hex"));
  await page.evaluate(async ({ fixture, wallets }) => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    const latest = "2026-10-31T09:41:00.000Z";
    if (fixture === "sixteen" || fixture === "three-days") {
      for (const wallet of wallets) await run(
        "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, 'crypto', 'BTC', 0, 0, 63842.11)",
        ["fidelity-oct-31", latest, wallet]);
    }
    if (fixture === "twelve") {
      for (const [index, wallet] of wallets.slice(0, 10).entries()) await run(
        "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, 'crypto', 'BTC', 0.001, ?, 63842.11)",
        ["fidelity-oct-31", latest, wallet, 64 + index]);
    }
    if (fixture === "single") {
      await run("DELETE FROM assets_v2 WHERE uuid = 'fidelity-oct-31' AND symbol = 'BTC' AND wallet != (SELECT wallet FROM assets_v2 WHERE uuid = 'fidelity-oct-31' AND symbol = 'BTC' ORDER BY value DESC LIMIT 1)");
    }
    await run("DELETE FROM transactions WHERE symbol = 'BTC'");
    const buys = fixture === "single" ? 0 : fixture === "twelve" ? 30 : 2;
    for (let index = 0; index < buys; index++) await run(
      "INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt) SELECT ?, id, 'crypto', wallet, 'BTC', ?, 52000, 'buy', ? FROM assets_v2 WHERE uuid = 'fidelity-oct-31' AND symbol = 'BTC' ORDER BY value DESC LIMIT 1",
      [`coin-layout-buy-${index}`, fixture === "twelve" ? 0.1 : index === 0 ? 1.2 : 2.0226,
        new Date(Date.UTC(2026, 9, index + 1, 9, 0)).toISOString()]);
    if (fixture === "three-days") await run("DELETE FROM assets_v2 WHERE createdAt < '2026-10-29T00:00:00.000Z'");
  }, { fixture, wallets });
}
