import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { trace } from "./functions/trace";
import {
  getLatestSnapshot,
  getAssetsBySnapshot,
  groupAssets,
  totalValue,
} from "./functions/assets";

const skill: Skill = {
  name: "asset_snapshot",
  description:
    "Get all assets from the latest portfolio snapshot or the snapshot " +
    "closest to a given date. Returns each asset's symbol, type, amount, " +
    "value in the user's base currency, and USD price. Use this when the " +
    "user asks what they hold at a point in time.",
  parameters: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description:
          "ISO date string. If omitted, returns the latest available snapshot.",
      },
    },
  },
  async run(args, ctx): Promise<ToolResult> {
    trace("SKILL: asset_snapshot called", "args:", JSON.stringify(args).slice(0, 200));
    const date =
      typeof args.date === "string" && args.date
        ? new Date(args.date)
        : undefined;
    const snapshot = await getLatestSnapshot(date);
    if (!snapshot) {
      trace("SKILL: asset_snapshot -> no data");
    return {
        data: { empty: true },
        text: "No portfolio snapshot available.",
      };
    }

    const assets = await getAssetsBySnapshot(snapshot.uuid);
    const grouped = groupAssets(assets);
    const usdTotal = totalValue(assets);
    const rate = ctx.baseCurrency.rate || 1;

    return {
      data: {
        asOf: snapshot.createdAt.toISOString(),
        baseCurrency: ctx.baseCurrency.currency,
        totalValue: usdTotal * rate,
        totalValueUsd: usdTotal,
        assetCount: grouped.length,
        assets: grouped.map((g) => ({
          symbol: g.symbol,
          assetType: g.assetType,
          amount: g.amount,
          valueUsd: g.value,
          value: g.value * rate,
          priceUsd: g.price,
        })),
      },
      text: `Snapshot at ${snapshot.createdAt.toISOString()}: ${(usdTotal * rate).toFixed(2)} ${ctx.baseCurrency.currency} across ${grouped.length} assets.`,
    };
  },
};

registerSkill(skill);
export default skill;
