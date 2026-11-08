import type { Page } from "@playwright/test";
import { executeSceneSql } from "./fidelity-records-scenes";
import { installTauriBridge } from "./tauri-bridge";

export async function seedHistoryKpis(page: Page, total: number, previous?: number) {
  await installTauriBridge(page);
  await seedHistoryKpisData(page, total, previous);
}

export async function seedHistoryKpisData(page: Page, total: number, previous?: number) {
  await executeSceneSql(page, "DELETE FROM assets_v2");
  const rows = Array.from({ length: 16 }, (_, index) => {
    const value = index === 15 ? total - 30 : 2;
    return ["owner-latest", "2026-11-08T11:51:00.000Z", `source-${index}`, "crypto", `COIN${Math.min(index, 10)}`,
      1, value, value];
  });
  await executeSceneSql(page,
    `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES ${
      rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",")}`,
    rows.flat());
  if (previous !== undefined) await executeSceneSql(page,
    "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["owner-earlier", "2026-11-01T11:51:00.000Z", "source-0", "crypto", "COIN0", 1, previous, previous]);
}
