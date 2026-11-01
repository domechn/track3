import { describe, expect, it } from "vitest";
import { customFollowTargets, resolveCustomPrices, validateCustomPrice } from "./custom-price";
import type { WalletCoin } from "./datafetch/types";
import type { AssetModel } from "./types";

const nova: WalletCoin = {
  symbol: "NOVA", assetType: "crypto", wallet: "others", amount: 10,
  customPrice: { kind: "manual", usd: 0.42, setAt: "2026-11-01T10:00:00.000Z" },
};
const previous = [{
  id: 1, uuid: "before", createdAt: "2026-10-31T10:00:00.000Z",
  symbol: "NOVA", assetType: "crypto", wallet: "others", amount: 10, price: 0.3, value: 3,
}] as AssetModel[];

describe("custom price rules", () => {
  it("uses manual price only when the same symbol has no market quote", () => {
    expect(resolveCustomPrices([nova], { "crypto:NOVA": 2 }, previous)[0].price).toBeUndefined();
    expect(resolveCustomPrices([nova], {}, previous)[0].price).toEqual({ base: "usd", value: 0.42 });
  });

  it("queries a listed follow target and uses its quote times the ratio", () => {
    const follow: WalletCoin = { ...nova, customPrice: {
      kind: "follow", assetType: "crypto", symbol: "BTC", ratio: 0.5,
    } };
    expect(customFollowTargets([follow])).toEqual([{ assetType: "crypto", symbol: "BTC" }]);
    expect(resolveCustomPrices([follow], { "crypto:BTC": 100 }, previous)[0].price)
      .toEqual({ base: "usd", value: 50 });
    expect(resolveCustomPrices([follow], {}, previous)[0].price)
      .toEqual({ base: "usd", value: 0.3 });
    expect(resolveCustomPrices([follow], {}, [])[0].price).toBeUndefined();
  });

  it("does not price an attached row or another wallet with the custom rule", () => {
    expect(resolveCustomPrices([{ ...nova, wallet: "exchange" }], {}, previous)[0].price).toBeUndefined();
    expect(resolveCustomPrices([nova, { ...nova, wallet: "exchange", customPrice: undefined }], {}, previous)[1].price).toBeUndefined();
  });

  it("rejects invalid numbers, long notes, and follow chains", () => {
    expect(validateCustomPrice({ kind: "manual", usd: Infinity, setAt: "2026-11-01T10:00:00.000Z" }, ["NOVA"], "NOVA")).toBe(false);
    expect(validateCustomPrice({ kind: "manual", usd: 1e13, setAt: "2026-11-01T10:00:00.000Z" }, ["NOVA"], "NOVA")).toBe(false);
    expect(validateCustomPrice({ kind: "manual", usd: 1, setAt: "2026-11-01T10:00:00.000Z", note: "x".repeat(141) }, ["NOVA"], "NOVA")).toBe(false);
    expect(validateCustomPrice({ kind: "follow", assetType: "crypto", symbol: "OTHER", ratio: 1 }, ["NOVA", "OTHER"], "NOVA")).toBe(false);
    expect(validateCustomPrice({ kind: "follow", assetType: "crypto", symbol: "BTC", ratio: 0 }, ["NOVA"], "NOVA")).toBe(false);
  });
});
