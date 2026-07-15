import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase, executeWrite, executeWriteWork } from "./database";
import {
  addToBlacklist,
  getBlacklistCoins,
  getPortfolioInputGeneration,
  removeFromBlacklist,
  saveBlacklistCoins,
} from "./configuration";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./database", () => ({
  getDatabase: vi.fn(),
  executeWrite: vi.fn(),
  executeWriteWork: vi.fn(),
}));

const blacklistConfigId = "995";

function createConfigurationDb(rows: Map<string, string>) {
  return {
    select: vi.fn(async (sql: string, values: unknown[]) => {
      const id = String(values?.[0] ?? "");
      if (!id || !rows.has(id)) {
        return [];
      }
      return [{ id, data: rows.get(id)! }];
    }),
    execute: vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.startsWith("INSERT OR REPLACE")) {
        const id = String(values?.[0] ?? "");
        if (id) {
          rows.set(id, String(values[1] ?? ""));
        }
      }
      if (sql.startsWith("DELETE FROM configuration")) {
        rows.delete(String(values?.[0] ?? ""));
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
  vi.mocked(executeWrite).mockImplementation(async (sql: string, values?: unknown[]) => {
    const db = await getDatabase();
    return db.execute(sql, values);
  });
  vi.mocked(executeWriteWork).mockImplementation(async (operation) =>
    operation((await getDatabase()) as never),
  );
});

describe("blacklist configuration", () => {
  it("normalizes saved symbols and removes duplicates", async () => {
    const generation = getPortfolioInputGeneration();

    await saveBlacklistCoins(["btc", "", "ETH", "eth", "  sol  "]);

    expect(configurationRows.get(blacklistConfigId)).toBe("BTC,ETH,SOL");
    expect(invoke).not.toHaveBeenCalled();
    expect(getPortfolioInputGeneration()).toBe(generation + 2);
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
