import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRebalanceProfile, saveRebalanceProfile } from "./rebalance";
import { executeWrite, getDatabase } from "./database";

vi.mock("./database", () => ({
  executeWrite: vi.fn(),
  getDatabase: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saved rebalance profile", () => {
  it("roundtrips canonical asset symbols through the database", async () => {
    let stored: { targets: string; tolerance_percent: number } | undefined;
    vi.mocked(getDatabase).mockResolvedValue({
      select: async () => stored ? [stored] : [],
    } as never);
    vi.mocked(executeWrite).mockImplementation(async (_sql, values) => {
      stored = { targets: values![0] as string, tolerance_percent: values![1] as number };
      return { rowsAffected: 1 };
    });
    await saveRebalanceProfile({
      targets: [{ kind: "asset", assetType: "crypto", symbol: "btc", percent: 100 }],
      tolerancePercent: 5,
    });
    expect(await getRebalanceProfile()).toEqual({
      targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 100 }],
      tolerancePercent: 5,
    });
  });
});
