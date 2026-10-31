import { expect, it } from "vitest";
import { profileFromTargets } from "./rebalance-profile";

it("stores a clean profile without editor fields", () => {
  expect(profileFromTargets([
    { kind: "asset", assetType: "crypto", symbol: " eth ", percent: 40, id: 1 },
    { kind: "type", assetType: "stock", percent: 50, id: 2 },
    { kind: "cash", percent: 10, id: 3 },
  ], 2)).toEqual({
    targets: [
      { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 40 },
      { kind: "type", assetType: "stock", percent: 50 },
      { kind: "cash", percent: 10 },
    ],
    tolerancePercent: 2,
  });
});
