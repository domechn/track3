import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import yaml from "yaml";
import { getDatabase, executeWrite, executeWriteWork } from "./database";
import {
  getPortfolioInputGeneration,
  cleanLicense,
  getConfiguration,
  importRawConfiguration,
  saveConfiguration,
  saveLicense,
  saveStableCoins,
} from "./configuration";
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
  executeWrite: vi.fn(),
  executeWriteWork: vi.fn(),
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

function makeConfig(groupUSD = true): GlobalConfig {
  return {
    configs: { groupUSD, hideInactive: false },
    exchanges: [
      {
        name: "binance",
        initParams: { apiKey: "k1", secret: "s1" },
        active: true,
      },
    ],
    erc20: { addresses: [] },
    btc: {
      addresses: [
        {
          address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
          active: true,
        },
      ],
    },
    sol: { addresses: [] },
    doge: { addresses: [] },
    trc20: { addresses: [] },
    ton: { addresses: [] },
    sui: { addresses: [] },
    others: [{ symbol: "MYTOKEN", amount: 100, alias: "My Token" }],
    stockConfig: { brokers: [] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tracing = createTracingDb();
  vi.mocked(getDatabase).mockResolvedValue(tracing.db as never);
  vi.mocked(executeWrite).mockImplementation(async (sql: string, values?: unknown[]) => {
    const db = await getDatabase();
    return db.execute(sql, values);
  });
  vi.mocked(executeWriteWork).mockImplementation(async (operation) =>
    operation(tracing.db as never),
  );
});

describe("saveConfiguration", () => {
  it("reads all four active slots from one SQLite snapshot", async () => {
    tracing.db.select.mockImplementation(
      async () =>
        [
          { id: "10", data: "!ent:exchanges: []\n" },
          { id: "11", data: "!ent:btc:\n  addresses: []\n" },
          {
            id: "12",
            data: "configs:\n  groupUSD: true\nothers: []\n",
          },
          { id: "20", data: "!ent:brokers: []\n" },
        ] as never,
    );

    await expect(getConfiguration()).resolves.toMatchObject({
      exchanges: [],
      btc: { addresses: [] },
      configs: { groupUSD: true },
      others: [],
      stockConfig: { brokers: [] },
    });

    expect(tracing.db.select).toHaveBeenCalledOnce();
    expect(tracing.db.select).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id IN (?, ?, ?, ?)"),
      ["10", "11", "12", "20"],
    );
  });

  it("persists all four active slots with one atomic SQLite statement", async () => {
    await saveConfiguration(makeConfig());

    expect(tracing.executeCalls).toHaveLength(1);
    expect(tracing.executeCalls[0].sql).toContain(
      "INSERT INTO configuration (id, data) VALUES (?, ?), (?, ?), (?, ?), (?, ?)",
    );
    expect(tracing.executeCalls[0].values.filter((_, index) => index % 2 === 0))
      .toEqual(["10", "11", "12", "20"]);
    expect(String(tracing.executeCalls[0].values[1])).toMatch(/^!ent:/);
    expect(String(tracing.executeCalls[0].values[3])).toMatch(/^!ent:/);
    expect(String(tracing.executeCalls[0].values[5])).not.toMatch(/^!ent:/);
    expect(String(tracing.executeCalls[0].values[7])).toMatch(/^!ent:/);
  });

  it.each(["11", "12", "20"])(
    "leaves every active slot unchanged and invalidates generation when slot %s fails",
    async (failedSlot) => {
      const activeRows = new Map(
        ["10", "11", "12", "20"].map((id) => [id, `old-${id}`]),
      );
      let generationAtFirstWrite: number | undefined;
      const generationBefore = getPortfolioInputGeneration();
      tracing.db.execute.mockImplementation(
        async (_sql: string, values: unknown[]) => {
          generationAtFirstWrite ??= getPortfolioInputGeneration();
          const entries = Array.from(
            { length: values.length / 2 },
            (_, index) =>
              [String(values[index * 2]), String(values[index * 2 + 1])] as const,
          );
          if (entries.some(([id]) => id === failedSlot)) {
            throw new Error(`slot ${failedSlot} failed`);
          }
          for (const [id, data] of entries) {
            activeRows.set(id, data);
          }
          return { rowsAffected: entries.length };
        },
      );

      await expect(saveConfiguration(makeConfig(false))).rejects.toThrow(
        `slot ${failedSlot} failed`,
      );

      expect(generationAtFirstWrite).toBe(generationBefore + 1);
      expect(getPortfolioInputGeneration()).toBe(generationBefore + 2);
      expect(Object.fromEntries(activeRows)).toEqual({
        "10": "old-10",
        "11": "old-11",
        "12": "old-12",
        "20": "old-20",
      });
    },
  );

  it("keeps the successful active configuration visible and generation invalidated when legacy cleanup fails", async () => {
    const rows = new Map<string, string>([
      ["1", "legacy-configuration"],
      ["10", "old-10"],
      ["11", "old-11"],
      ["12", "old-12"],
      ["20", "old-20"],
    ]);
    tracing.db.execute.mockImplementation(
      async (sql: string, values: unknown[]) => {
        if (sql.startsWith("DELETE FROM configuration")) {
          throw new Error("legacy delete failed");
        }
        for (let index = 0; index < values.length; index += 2) {
          rows.set(String(values[index]), String(values[index + 1]));
        }
        return { rowsAffected: values.length / 2 };
      },
    );
    const generationBefore = getPortfolioInputGeneration();

    await expect(
      importRawConfiguration(yaml.stringify(makeConfig(false))),
    ).rejects.toThrow("legacy delete failed");

    expect(getPortfolioInputGeneration()).toBe(generationBefore + 2);
    expect(rows.get("1")).toBe("legacy-configuration");
    expect(rows.get("10")).not.toBe("old-10");
    expect(rows.get("11")).not.toBe("old-11");
    expect(rows.get("12")).not.toBe("old-12");
    expect(rows.get("20")).not.toBe("old-20");
  });

  it("does not invalidate portfolio input generation for stablecoin cache writes", async () => {
    const generation = getPortfolioInputGeneration();

    await saveStableCoins(["USDT", "USDC"]);

    expect(getPortfolioInputGeneration()).toBe(generation);
  });

  it("invalidates portfolio input generation when the Pro license changes", async () => {
    const generation = getPortfolioInputGeneration();

    await saveLicense("license");
    expect(getPortfolioInputGeneration()).toBe(generation + 2);

    await cleanLicense();
    expect(getPortfolioInputGeneration()).toBe(generation + 4);
  });
});
