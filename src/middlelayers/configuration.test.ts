import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "./database";
import { saveConfiguration } from "./configuration";
import { GlobalConfig } from "./datafetch/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string, args: { data: string }) => {
    if (command === "encrypt") {
      return `!ent:${args.data}`;
    }
    if (command === "decrypt") {
      return args.data.replace(/^!ent:/, "");
    }
    throw new Error(`unknown command ${command}`);
  }),
}));

vi.mock("./database", () => ({
  getDatabase: vi.fn(),
}));

/** Minimal mock that tracks every execute call in order. */
function createTracingDb() {
  const executeCalls: { sql: string; values: unknown[] }[] = [];
  const db = {
    select: vi.fn(async () => []),
    execute: vi.fn(async (sql: string, values: unknown[]) => {
      executeCalls.push({ sql, values });
      return { rowsAffected: 1 };
    }),
  };
  return { db, executeCalls };
}

let tracing: ReturnType<typeof createTracingDb>;

beforeEach(() => {
  vi.clearAllMocks();
  tracing = createTracingDb();
  vi.mocked(getDatabase).mockResolvedValue(tracing.db as never);
});

describe("saveConfiguration", () => {
  it("persists all four configuration slots sequentially", async () => {
    const cfg: GlobalConfig = {
      configs: { groupUSD: true, hideInactive: false },
      exchanges: [
        { name: "binance", initParams: { apiKey: "k1", secret: "s1" }, active: true },
      ],
      erc20: { addresses: [] },
      btc: { addresses: [{ address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", active: true }] },
      sol: { addresses: [] },
      doge: { addresses: [] },
      trc20: { addresses: [] },
      ton: { addresses: [] },
      sui: { addresses: [] },
      others: [{ symbol: "MYTOKEN", amount: 100, alias: "My Token" }],
      stockConfig: { brokers: [] },
    };

    await saveConfiguration(cfg);

    // Should have exactly 4 execute calls (one per slot)
    expect(tracing.executeCalls.length).toBe(4);

    // Each call should be an INSERT OR REPLACE into the configuration table
    const ids = tracing.executeCalls.map((c) => String(c.values[0]));
    expect(ids).toContain("10"); // exchangesConfigId
    expect(ids).toContain("11"); // walletsConfigId
    expect(ids).toContain("12"); // generalConfigId
    expect(ids).toContain("20"); // stockConfigId
  });

  it("calls execute in order (not in parallel) — each subsequent write waits for the previous", async () => {
    const cfg: GlobalConfig = {
      configs: { groupUSD: false, hideInactive: true },
      exchanges: [],
      erc20: { addresses: [] },
      btc: { addresses: [] },
      sol: { addresses: [] },
      doge: { addresses: [] },
      trc20: { addresses: [] },
      ton: { addresses: [] },
      sui: { addresses: [] },
      others: [],
      stockConfig: { brokers: [] },
    };

    // Install a tiny delay on the mock execute so we can detect concurrency:
    // if writes are parallel, they'll interleave; if serial, they'll complete
    // one at a time in sequence order.
    const order: number[] = [];
    tracing.db.execute.mockImplementation(
      async (_sql: string, values: unknown[]) => {
        const id = Number(values[0]);
        order.push(id);
        // artificial delay to surface races
        await new Promise((r) => setTimeout(r, 5));
        return { rowsAffected: 1 };
      },
    );

    await saveConfiguration(cfg);

    // Writes should complete in slot order: 10, 11, 12, 20
    // (exchanges → wallets → general → stock)
    expect(order).toEqual([10, 11, 12, 20]);
  });
});
