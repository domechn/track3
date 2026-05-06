import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "./database";
import {
  addToBlacklist,
  getBlacklistCoins,
  removeFromBlacklist,
  saveBlacklistCoins,
} from "./configuration";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./database", () => ({
  getDatabase: vi.fn(),
}));

const blacklistConfigId = "995";

function createConfigurationDb(rows: Map<string, string>) {
  return {
    select: vi.fn(async (sql: string) => {
      const id = sql.match(/id = (\d+)/)?.[1];
      if (!id || !rows.has(id)) {
        return [];
      }
      return [{ id, data: rows.get(id)! }];
    }),
    execute: vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.startsWith("INSERT OR REPLACE")) {
        const id = sql.match(/VALUES \((\d+), \?\)/)?.[1];
        if (id) {
          rows.set(id, String(values[0] ?? ""));
        }
      }
      if (sql.startsWith("DELETE FROM configuration")) {
        rows.delete(String(values[0] ?? ""));
      }
      return { rowsAffected: 1 };
    }),
  };
}

let configurationRows: Map<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  configurationRows = new Map<string, string>();
  vi.mocked(getDatabase).mockResolvedValue(
    createConfigurationDb(configurationRows) as never,
  );
});

describe("blacklist configuration", () => {
  it("normalizes saved symbols and removes duplicates", async () => {
    await saveBlacklistCoins(["btc", "", "ETH", "eth", "  sol  "]);

    expect(configurationRows.get(blacklistConfigId)).toBe("BTC,ETH,SOL");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns normalized symbols from stored configuration", async () => {
    configurationRows.set(blacklistConfigId, "btc,,Eth,  sol  ");

    await expect(getBlacklistCoins()).resolves.toEqual(["BTC", "ETH", "SOL"]);
  });

  it("adds symbols without duplicating existing entries by case", async () => {
    configurationRows.set(blacklistConfigId, "btc,ETH");

    await addToBlacklist("BTC");

    expect(configurationRows.get(blacklistConfigId)).toBe("BTC,ETH");
  });

  it("removes symbols case-insensitively", async () => {
    configurationRows.set(blacklistConfigId, "btc,ETH");

    await removeFromBlacklist("BTC");

    expect(configurationRows.get(blacklistConfigId)).toBe("ETH");
  });
});
