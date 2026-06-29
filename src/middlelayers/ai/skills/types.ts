import type { CurrencyRateDetail } from "../../types";
import type { AssetType } from "../../datafetch/types";

export type SkillArgs = Record<string, unknown>;

export type ToolResult = {
  // JSON-serializable payload returned to the model.
  data: unknown;
  // Optional short text summary that the model can read after the tool runs.
  text?: string;
};

export type SkillContext = {
  // The user's preferred display currency. Skills that report values
  // convert into this currency so the numbers line up with the rest of
  // the app.
  baseCurrency: CurrencyRateDetail;
  // Optional abort signal forwarded to long-running skills.
  signal?: AbortSignal;
};

// Centralized asset-type helper, exposed through ctx so skill
// implementations don't have to import internal modules.
export type GetAssetType = (asset?: { assetType?: AssetType }) => AssetType;

export type Skill = {
  name: string;
  description: string;
  // JSON Schema object describing the tool's arguments.
  parameters: Record<string, unknown>;
  run: (args: SkillArgs, ctx: SkillContext) => Promise<ToolResult>;
};
