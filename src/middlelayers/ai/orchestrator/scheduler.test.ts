import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { executePlan } from "./scheduler";
import type { AnalysisPlan, OrchestratorEvent, SubTaskResult } from "./types";
import type { SkillContext } from "../skills/types";

// Mock the tool runner
vi.mock("../tools", () => ({
  runSkill: vi.fn(),
  getSkill: vi.fn(),
}));

import { runSkill } from "../tools";

const mockRunSkill = vi.mocked(runSkill);
const baseCtx: SkillContext = {
  baseCurrency: { currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" },
};

async function collectEvents(plan: AnalysisPlan, ctx: SkillContext): Promise<OrchestratorEvent[]> {
  const out: OrchestratorEvent[] = [];
  for await (const ev of executePlan(plan, ctx)) {
    out.push(ev);
  }
  return out;
}

beforeEach(() => {
  mockRunSkill.mockReset();
});

describe("orchestrator.scheduler", () => {
  it("yields nothing for an empty plan", async () => {
    const plan: AnalysisPlan = {
      query: "test",
      tasks: [],
      requiresRefinement: false,
      maxOptimizerRounds: 0,
    };
    const events = await collectEvents(plan, baseCtx);
    expect(events).toHaveLength(0);
  });

  it("executes a single task and yields start + complete events", async () => {
    mockRunSkill.mockResolvedValue({
      ok: true,
      result: { data: { total: 1000 }, text: "Total USD: 1000" },
    });

    const plan: AnalysisPlan = {
      query: "portfolio?",
      tasks: [
        {
          id: "t1",
          skillName: "portfolio_summary",
          args: { topN: 5 },
          description: "Fetch summary",
          dependsOn: [],
        },
      ],
      requiresRefinement: false,
      maxOptimizerRounds: 0,
    };

    const events = await collectEvents(plan, baseCtx);

    expect(events.filter((e) => e.kind === "agent_start")).toHaveLength(1);
    expect(events.filter((e) => e.kind === "agent_complete")).toHaveLength(1);
    expect(events.filter((e) => e.kind === "agent_error")).toHaveLength(0);

    const start = events.find((e) => e.kind === "agent_start")!;
    if (start.kind === "agent_start") {
      expect(start.taskId).toBe("t1");
      expect(start.skillName).toBe("portfolio_summary");
    }

    expect(mockRunSkill).toHaveBeenCalledTimes(1);
    expect(mockRunSkill).toHaveBeenCalledWith(
      "portfolio_summary",
      { topN: 5 },
      expect.objectContaining({ baseCurrency: baseCtx.baseCurrency }),
    );
  });

  it("executes parallel tasks concurrently (no dependencies)", async () => {
    let callCount = 0;
    mockRunSkill.mockImplementation(async () => {
      callCount++;
      // Simulate slow execution by yielding to event loop
      await new Promise((r) => setTimeout(r, 5));
      return {
        ok: true,
        result: { data: { callCount }, text: `result ${callCount}` },
      };
    });

    const plan: AnalysisPlan = {
      query: "how's my portfolio?",
      tasks: [
        { id: "t1", skillName: "portfolio_summary", args: {}, description: "Summary", dependsOn: [] },
        { id: "t2", skillName: "health_score", args: {}, description: "Health", dependsOn: [] },
      ],
      requiresRefinement: false,
      maxOptimizerRounds: 0,
    };

    const events = await collectEvents(plan, baseCtx);

    expect(events.filter((e) => e.kind === "agent_start")).toHaveLength(2);
    expect(events.filter((e) => e.kind === "agent_complete")).toHaveLength(2);
    expect(mockRunSkill).toHaveBeenCalledTimes(2);
  });

  it("executes dependent tasks sequentially", async () => {
    const executionOrder: string[] = [];
    mockRunSkill.mockImplementation(async (name: string) => {
      executionOrder.push(name);
      return {
        ok: true,
        result: { data: {}, text: `${name} done` },
      };
    });

    const plan: AnalysisPlan = {
      query: "complex analysis",
      tasks: [
        { id: "t1", skillName: "portfolio_summary", args: {}, description: "Summary", dependsOn: [] },
        { id: "t2", skillName: "health_score", args: {}, description: "Health", dependsOn: ["t1"] },
      ],
      requiresRefinement: false,
      maxOptimizerRounds: 0,
    };

    await collectEvents(plan, baseCtx);

    // t1 must complete before t2
    expect(executionOrder).toEqual(["portfolio_summary", "health_score"]);
  });

  it("yields agent_error when a skill fails", async () => {
    mockRunSkill.mockResolvedValue({
      ok: false,
      error: "Something went wrong",
    });

    const plan: AnalysisPlan = {
      query: "test",
      tasks: [
        { id: "t1", skillName: "portfolio_summary", args: {}, description: "Summary", dependsOn: [] },
      ],
      requiresRefinement: false,
      maxOptimizerRounds: 0,
    };

    const events = await collectEvents(plan, baseCtx);

    expect(events.filter((e) => e.kind === "agent_start")).toHaveLength(1);
    expect(events.filter((e) => e.kind === "agent_error")).toHaveLength(1);
    expect(events.filter((e) => e.kind === "agent_complete")).toHaveLength(0);

    const err = events.find((e) => e.kind === "agent_error")!;
    if (err.kind === "agent_error") {
      expect(err.error).toContain("Something went wrong");
    }
  });

  it("passes abort signal to skills", async () => {
    const controller = new AbortController();
    let skillAbortSignal: AbortSignal | undefined;

    mockRunSkill.mockImplementation(async (_name: string, _args: unknown, ctx: any) => {
      skillAbortSignal = ctx.signal;
      return { ok: true, result: { data: {} } };
    });

    const plan: AnalysisPlan = {
      query: "test",
      tasks: [
        { id: "t1", skillName: "portfolio_summary", args: {}, description: "Summary", dependsOn: [] },
      ],
      requiresRefinement: false,
      maxOptimizerRounds: 0,
    };

    await collectEvents(plan, { ...baseCtx, signal: controller.signal });

    expect(skillAbortSignal).toBe(controller.signal);
  });
});
