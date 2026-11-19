import { expect, it, vi } from "vitest";
import { ASSET_HANDLER } from "./assets";
import { saveModelsToDatabase } from "../database";

vi.mock("../database", () => ({
  saveModelsToDatabase: vi.fn(async () => []),
}));

it("persists every row passed to the direct saver", async () => {
  await ASSET_HANDLER.saveCoinsToDatabase([
    { symbol: "DUST", assetType: "crypto", wallet: "wallet-a", amount: 2, price: 0.2, usdValue: 0.4 },
    { symbol: "ZERO", assetType: "crypto", wallet: "wallet-a", amount: 0, price: 1, usdValue: 0 },
  ]);
  expect(saveModelsToDatabase).toHaveBeenCalledWith("assets_v2", [
    expect.objectContaining({ symbol: "DUST", value: 0.4 }),
    expect.objectContaining({ symbol: "ZERO", value: 0 }),
  ], "REPLACE");
});
