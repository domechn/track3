import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LIVE_TOTAL_REASONS, type LiveTotalState } from "@/components/use-live-total";
import type { PortfolioSourceResult, PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";

const docs = resolve(__dirname, "../../docs/state-machines");
const page = (name: string) => readFileSync(join(docs, name), "utf8");

// `Record<Union, true>` makes the compiler reject a list that misses or invents a member of the union.
const liveTotalStates: Record<LiveTotalState, true> = {
  idle: true, connecting: true, live: true, partial: true, stale: true, error: true, off: true,
};
const sourceResultStatuses: Record<PortfolioSourceResult["status"], true> = { ok: true, partial: true, stale: true };
const sourceStatuses: Record<PortfolioSourceStatus["status"], true> = { ok: true, partial: true, failed: true, stale: true };

// Values of `data-state` and `data-retry-state` on the refresh controls; the refresh control tests pin them.
const refreshControlStates = ["idle", "preflight", "confirm", "running"];
const retryStates = ["off", "idle", "waiting", "stopped"];
const schedulerStates = ["disposed", "disabled", "idle", "waiting", "blocked-hidden-or-offline", "blocked-busy",
  "running", "stopped"];
const refreshPhases = ["query", "generation check", "prepare", "persist"];

const machines: Array<[file: string, values: string[]]> = [
  ["live-total.md", [...Object.keys(liveTotalStates), ...LIVE_TOTAL_REASONS]],
  ["refresh-flow.md", [...refreshControlStates, ...refreshPhases]],
  ["refresh-retry-scheduler.md", [...schedulerStates, ...retryStates]],
  ["source-status.md", [...Object.keys(sourceResultStatuses), ...Object.keys(sourceStatuses)]],
  ["ibkr-flex.md", []],
];

describe("state machine docs", () => {
  it.each(machines)("%s has a diagram, is linked from the README and names every state", (file, values) => {
    const text = page(file);
    expect(text).toContain("```mermaid\nstateDiagram-v2");
    expect(page("README.md")).toContain(`(${file})`);
    const missing = values.filter((value) => !text.includes(`\`${value}\``) && !text.includes(`| ${value} |`));
    expect(missing).toEqual([]);
  });
});
