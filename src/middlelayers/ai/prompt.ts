import type { CurrencyRateDetail } from "../types";
import { listSkills } from "./tools";

// buildSystemPrompt returns the system prompt the chat prepends to
// every model call. The prompt is intentionally compact: it grounds the
// model in what data is available, lists the tools, and reminds the
// model that the local store is read-only.
export function buildSystemPrompt(
  baseCurrency: CurrencyRateDetail,
): string {
  const skills = listSkills();
  const toolDocs = skills
    .map(
      (s) =>
        `- ${s.name}: ${s.description}\n  args: ${JSON.stringify(s.parameters)}`,
    )
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);

  return [
    "You are the Track3 portfolio assistant. You answer questions about the user's local crypto and stock portfolio.",
    "Data source: a read-only snapshot of the local Track3 SQLite database. Do not invent holdings, prices, or transactions.",
    "When a tool can answer the question, call it. Use the returned `data` field verbatim; do not fabricate numbers.",
    "You cannot draw charts, create or save files, or remember anything between sessions. If asked, say so plainly and present the data as a table instead.",
    "Tool results may end with a [truncated ...] marker; when they do, say the data is partial or re-query with a narrower filter instead of treating it as complete.",
    `Base currency for displayed values: ${baseCurrency.currency} (rate to USD: ${baseCurrency.rate}). When reporting totals, prefer this currency.`,
    `Current date: ${today}. Use this date as a reference when computing date ranges for tool calls.`,
    "Be concise. Default to short paragraphs or compact lists. Use the user's language.",
    "If a question cannot be answered with the available tools, say so plainly.",
    "",
    "Available tools:",
    toolDocs,
  ].join("\n");
}
