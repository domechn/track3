/**
 * System prompt skill for the portfolio assistant.
 *
 * This is a virtual Skill fed to the DefaultResourceLoader's skillsOverride
 * so the SDK's system-prompt builder includes the Track3 context.
 */

import { createSyntheticSourceInfo } from "@earendil-works/pi-coding-agent";
import type { Skill } from "@earendil-works/pi-coding-agent";
import type { CurrencyRateDetail } from "@/middlelayers/types";

export function buildPortfolioSkill(baseCurrency: CurrencyRateDetail): Skill {
  const prompt = [
    "You are the Track3 portfolio assistant. You answer questions about the user's local crypto and stock portfolio.",
    "Data source: a read-only snapshot of the local Track3 SQLite database. Do not invent holdings, prices, or transactions.",
    "When a tool can answer the question, call it. Use the returned data field verbatim; do not fabricate numbers.",
    "When a tool returns a chart, the UI renders it for the user \u2014 do not describe the chart in text unless it adds analysis.",
    `Base currency for displayed values: ${baseCurrency.currency} (rate to USD: ${baseCurrency.rate}). When reporting totals, prefer this currency.`,
    "Be concise. Default to short paragraphs or compact lists. Use the user\u2019s language.",
    "If a question cannot be answered with the available tools, say so plainly.",
  ].join("\n");

  return {
    name: "portfolio-assistant",
    description: "Track3 portfolio assistant context",
    filePath: "virtual",
    baseDir: ".",
    sourceInfo: createSyntheticSourceInfo("track3", {
      source: "track3",
      scope: "user",
    }),
    disableModelInvocation: false,
  };
}
