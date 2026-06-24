import { describe, expect, it } from "vitest";
import {
  KNOWN_CEX_EXCHANGES,
  KNOWN_CHAINS,
  WALLET_CATEGORY_BASE_COLORS,
  classifyWalletType,
  pickTileTextColor,
  tileBackground,
  tileContentLevel,
  tileOpacity,
  type WalletCategory,
} from "./wallet-treemap";

describe("classifyWalletType", () => {
  it("maps known CEX exchange names to 'cex' (using the values the codebase actually emits)", () => {
    // these are the exact strings returned by each exchange's getExchangeName()
    expect(classifyWalletType("Binance")).toBe("cex");
    expect(classifyWalletType("Okex")).toBe("cex");
    expect(classifyWalletType("Bybit")).toBe("cex");
    expect(classifyWalletType("Coinbase")).toBe("cex");
    expect(classifyWalletType("Bitget")).toBe("cex");
    expect(classifyWalletType("Gate")).toBe("cex");
    expect(classifyWalletType("Kraken")).toBe("cex");
    expect(classifyWalletType("HTX")).toBe("cex");
    expect(classifyWalletType("MEXC")).toBe("cex");
  });

  it("tolerates case variations of the CEX names", () => {
    expect(classifyWalletType("binance")).toBe("cex");
    expect(classifyWalletType("OKEX")).toBe("cex");
    expect(classifyWalletType("binAnce")).toBe("cex");
  });

  it("maps known Web3 chain names to 'onchain'", () => {
    expect(classifyWalletType("ERC20")).toBe("onchain");
    expect(classifyWalletType("erc20")).toBe("onchain");
    expect(classifyWalletType("BTC")).toBe("onchain");
    expect(classifyWalletType("btc")).toBe("onchain");
    expect(classifyWalletType("SOL")).toBe("onchain");
    expect(classifyWalletType("SUI")).toBe("onchain");
    expect(classifyWalletType("TON")).toBe("onchain");
    expect(classifyWalletType("DOGE")).toBe("onchain");
    expect(classifyWalletType("TRC20")).toBe("onchain");
  });

  it("maps broker names to 'broker'", () => {
    expect(classifyWalletType("ibkr")).toBe("broker");
    expect(classifyWalletType("IBKR")).toBe("broker");
  });

  it("maps 'Others' (the manually-attached bucket) to 'others'", () => {
    expect(classifyWalletType("Others")).toBe("others");
    expect(classifyWalletType("OTHERS")).toBe("others");
  });

  it("maps unknown values to 'others' (catch-all)", () => {
    expect(classifyWalletType("mystery")).toBe("others");
  });

  it("maps falsy values to 'others'", () => {
    expect(classifyWalletType(undefined)).toBe("others");
    expect(classifyWalletType(null)).toBe("others");
    expect(classifyWalletType("")).toBe("others");
  });

  it("maps the synthetic aggregated-others key to 'aggregated'", () => {
    expect(classifyWalletType("__others_aggregated__")).toBe("aggregated");
  });

  it("exports the CEX and chain allow-lists with reasonable coverage", () => {
    expect(KNOWN_CEX_EXCHANGES.size).toBeGreaterThanOrEqual(5);
    expect(KNOWN_CHAINS.size).toBeGreaterThanOrEqual(5);
  });
});

describe("tileOpacity", () => {
  it("returns 1.0 when there is only one item in the category", () => {
    expect(tileOpacity(0, 1)).toBe(1);
  });

  it("returns 1.0 for rank 0 regardless of category size", () => {
    expect(tileOpacity(0, 3)).toBe(1);
    expect(tileOpacity(0, 12)).toBe(1);
  });

  it("returns 0.25 for the last rank in the category", () => {
    expect(tileOpacity(4, 5)).toBe(0.25);
    expect(tileOpacity(11, 12)).toBe(0.25);
  });

  it("interpolates linearly between 1.0 and 0.25 for middle ranks", () => {
    // rank 2 of 5 -> t=0.5, opacity = 1 - 0.5*0.75 = 0.625
    expect(tileOpacity(2, 5)).toBeCloseTo(0.625, 5);
    // rank 1 of 5 -> t=0.25, opacity = 1 - 0.25*0.75 = 0.8125
    expect(tileOpacity(1, 5)).toBeCloseTo(0.8125, 5);
  });

  it("clamps opacity at 0.25 even for very small rank values", () => {
    expect(tileOpacity(99, 100)).toBe(0.25);
  });
});

describe("tileBackground", () => {
  it("returns a CSS linear-gradient string for each category", () => {
    const categories: WalletCategory[] = ["cex", "onchain", "broker", "others"];
    for (const category of categories) {
      const bg = tileBackground(category, 0, 3);
      expect(bg).toMatch(/^linear-gradient\(135deg,/);
    }
  });

  it("exports an aggregated color for the synthetic Others tile", () => {
    expect(WALLET_CATEGORY_BASE_COLORS.aggregated.main).toMatch(/hsl\(/);
    expect(WALLET_CATEGORY_BASE_COLORS.aggregated.labelKey).toBe(
      "walletAllocation.type.aggregated",
    );
  });

  it("uses the category main hue in the gradient", () => {
    const cexBg = tileBackground("cex", 0, 3);
    const onchainBg = tileBackground("onchain", 0, 3);
    const brokerBg = tileBackground("broker", 0, 3);
    const othersBg = tileBackground("others", 0, 3);

    const cexColor = cexBg.match(/hsl\w?\((\d+)/)?.[1];
    const onchainColor = onchainBg.match(/hsl\w?\((\d+)/)?.[1];
    const brokerColor = brokerBg.match(/hsl\w?\((\d+)/)?.[1];
    const othersColor = othersBg.match(/hsl\w?\((\d+)/)?.[1];

    const cexBase = WALLET_CATEGORY_BASE_COLORS.cex.main.match(/(\d+)/)?.[1];
    const onchainBase = WALLET_CATEGORY_BASE_COLORS.onchain.main.match(/(\d+)/)?.[1];
    const brokerBase = WALLET_CATEGORY_BASE_COLORS.broker.main.match(/(\d+)/)?.[1];
    const othersBase = WALLET_CATEGORY_BASE_COLORS.others.main.match(/(\d+)/)?.[1];

    expect(cexColor).toBe(cexBase);
    expect(onchainColor).toBe(onchainBase);
    expect(brokerColor).toBe(brokerBase);
    expect(othersColor).toBe(othersBase);
  });

  it("emits full opacity (1) for rank 0 in hsla", () => {
    const bg = tileBackground("cex", 0, 5);
    expect(bg).toMatch(/hsla?\([^,]+,[^,]+,[^,]+,\s*1\)/);
  });

  it("emits the minimum opacity (0.25) for the last rank", () => {
    const bg = tileBackground("cex", 4, 5);
    expect(bg).toMatch(/hsla?\([^,]+,[^,]+,[^,]+,\s*0?\.25\)/);
  });
});

describe("tileContentLevel", () => {
  it("returns 'full' when tile is tall enough on desktop", () => {
    expect(tileContentLevel(100, false)).toBe("full");
    expect(tileContentLevel(56, false)).toBe("full");
  });

  it("returns 'name-pct' on desktop when height is in the mid band", () => {
    expect(tileContentLevel(55, false)).toBe("name-pct");
    expect(tileContentLevel(40, false)).toBe("name-pct");
    expect(tileContentLevel(32, false)).toBe("name-pct");
  });

  it("returns 'name' on desktop when only the name fits", () => {
    expect(tileContentLevel(31, false)).toBe("name");
    expect(tileContentLevel(24, false)).toBe("name");
  });

  it("returns 'none' on desktop when the tile is too small to show text", () => {
    expect(tileContentLevel(23, false)).toBe("none");
    expect(tileContentLevel(10, false)).toBe("none");
  });

  it("uses lower thresholds on mobile", () => {
    expect(tileContentLevel(36, true)).toBe("full");
    expect(tileContentLevel(30, true)).toBe("name-pct");
    expect(tileContentLevel(20, true)).toBe("name");
    expect(tileContentLevel(17, true)).toBe("none");
  });
});

describe("pickTileTextColor", () => {
  it("returns 'foreground' for visible tiles on desktop", () => {
    expect(pickTileTextColor(50, false)).toBe("foreground");
    expect(pickTileTextColor(24, false)).toBe("foreground");
  });

  it("returns 'muted' for tiny tiles on desktop", () => {
    expect(pickTileTextColor(23, false)).toBe("muted");
    expect(pickTileTextColor(10, false)).toBe("muted");
  });

  it("uses the mobile threshold for tiny tiles", () => {
    expect(pickTileTextColor(20, true)).toBe("foreground");
    expect(pickTileTextColor(17, true)).toBe("muted");
  });
});
