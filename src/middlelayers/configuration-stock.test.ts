import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "./database";
import * as configuration from "./configuration";
import { StockConfig } from "./datafetch/types";

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

const stockConfigId = "20";

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

describe("stock configuration", () => {
  it("saves stock brokers in the encrypted stock configuration slot", async () => {
    const cfg: StockConfig = {
      brokers: [
        {
          name: "ibkr",
          alias: "Main IBKR",
          active: true,
          initParams: {
            token: "flex-token",
            queryId: "123456",
          },
        },
      ],
    };

    await (configuration as any).saveStockConfig(cfg);

    expect(invoke).toHaveBeenCalledWith("encrypt", {
      data: expect.stringContaining("token: flex-token"),
    });
    expect(configurationRows.get(stockConfigId)).toMatch(/^!ent:/);
  });

  it("loads and decrypts stock broker configuration", async () => {
    configurationRows.set(
      stockConfigId,
      '!ent:brokers:\n  - name: ibkr\n    alias: Main IBKR\n    active: true\n    initParams:\n      token: flex-token\n      queryId: "123456"\n',
    );

    await expect((configuration as any).getStockConfig()).resolves.toEqual({
      brokers: [
        {
          name: "ibkr",
          alias: "Main IBKR",
          active: true,
          initParams: {
            token: "flex-token",
            queryId: "123456",
          },
        },
      ],
    });
  });
});
