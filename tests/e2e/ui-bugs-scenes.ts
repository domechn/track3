import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

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
