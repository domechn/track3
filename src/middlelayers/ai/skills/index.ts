/**
 * Skill index.
 *
 * Exports all ToolDefinitions for registration with the Pi Agent SDK.
 * Each tool is defined via defineTool() with JSON Schema parameters.
 */

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

import portfolioSummaryDef from "./portfolio-summary";
import portfolioHistoryDef from "./portfolio-history";
import assetHistoryDef from "./asset-history";
import compareSnapshotsDef from "./compare-snapshots";
import recentTransactionsDef from "./recent-transactions";
import marketPriceDef from "./market-price";
import healthScoreDef from "./health-score";

/** All tool definitions wired into the AgentSession. */
export const allToolDefinitions: ToolDefinition[] = [
  portfolioSummaryDef,
  portfolioHistoryDef,
  assetHistoryDef,
  compareSnapshotsDef,
  recentTransactionsDef,
  marketPriceDef,
  healthScoreDef,
];
