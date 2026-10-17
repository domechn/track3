// Parallel Agent Scheduler
//
// Takes an AnalysisPlan, groups tasks by their dependency chain, and
// executes independent tasks concurrently.  Each batch waits for all
// its predecessors to complete before starting dependent tasks.
//
// Inspired by Codex's spawn-sub-agent pattern: each sub-task is
// an "agent" with its own status lifecycle.

import { runSkill } from "../tools";
import type { SkillContext } from "../skills/types";
import { trace } from "../skills/functions/trace";
import { redactSecrets } from "../../security/redact";
import type {
  AnalysisPlan,
  OrchestratorEvent,
  SubTaskDefinition,
  SubTaskResult,
} from "./types";

// ── Execute a plan and yield events ──

export async function* executePlan(
  plan: AnalysisPlan,
  ctx: SkillContext,
  signal?: AbortSignal,
): AsyncGenerator<OrchestratorEvent> {
  if (plan.tasks.length === 0) {
    return;
  }

  // Build a map for O(1) lookups
  const defs = new Map<string, SubTaskDefinition>();
  for (const t of plan.tasks) {
    defs.set(t.id, t);
  }

  // Track which tasks have finished or failed
  const results = new Map<string, SubTaskResult>();

  // Topological sort by dependency depth so we know what's ready
  const depth = computeDepths(plan.tasks, defs);

  // Group tasks by depth = run same-depth tasks in parallel
  const depthGroups = groupByDepth(plan.tasks, depth);
  const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);

  for (const level of sortedDepths) {
    if (signal?.aborted) break;

    const group = depthGroups.get(level)!;

    for (let offset = 0; offset < group.length; offset += 4) {
      if (signal?.aborted) break;
      const batch = group.slice(offset, offset + 4);
      const ready = batch.filter((task) =>
        task.dependsOn.every((id) => results.get(id)?.status === "completed"),
      );
      for (const task of batch.filter((task) => !ready.includes(task))) {
        const result: SubTaskResult = {
          id: task.id, skillName: task.skillName, status: "failed",
          description: task.description, error: "Prerequisite task failed",
        };
        results.set(task.id, result);
        yield {
          kind: "agent_error", taskId: task.id, skillName: task.skillName,
          description: task.description, error: result.error!,
        };
      }
      for (const task of ready) {
        yield {
          kind: "agent_start",
          taskId: task.id,
          skillName: task.skillName,
          description: task.description,
        };
      }

      const batchResults = await Promise.allSettled(
        ready.map((task) => executeSingleTask(task, ctx, signal)),
      );

      for (let i = 0; i < ready.length; i++) {
        const task = ready[i]!;
        const settled = batchResults[i]!;

        if (settled.status === "fulfilled") {
          const result = settled.value;
          results.set(task.id, result);
          if (result.status === "completed") {
            yield {
              kind: "agent_complete",
              taskId: task.id,
              skillName: task.skillName,
              description: task.description,
              result,
            };
            if (result.text) {
              yield {
                kind: "agent_result",
                taskId: task.id,
                skillName: task.skillName,
                text: result.text ?? "",
              };
            }
          } else {
            yield {
              kind: "agent_error",
              taskId: task.id,
              skillName: task.skillName,
              description: task.description,
              error: result.error ?? "Unknown error",
            };
          }
        } else {
          const err = redactSecrets(settled.reason?.message ?? String(settled.reason));
          results.set(task.id, {
            id: task.id,
            skillName: task.skillName,
            status: "failed",
            description: task.description,
            error: err,
          });
          yield {
            kind: "agent_error",
            taskId: task.id,
            skillName: task.skillName,
            description: task.description,
            error: err,
          };
        }
      }
    }
  }
}

// ── Execute one skill ──

async function executeSingleTask(
  task: SubTaskDefinition,
  ctx: SkillContext,
  signal?: AbortSignal,
): Promise<SubTaskResult> {
  trace("SCHEDULER: executeSingleTask");
  try {
    const skillResult = await runSkill(
      task.skillName,
      task.args,
      { ...ctx, signal: signal ?? ctx.signal },
    );

    if (!skillResult.ok) {
      return {
        id: task.id,
        skillName: task.skillName,
        status: "failed",
        description: task.description,
        error: skillResult.error,
      };
    }

    trace("SCHEDULER: executeSingleTask ok", task.id, task.skillName, "text:", skillResult.result.text?.slice(0, 100));
    return {
      id: task.id,
      skillName: task.skillName,
      status: "completed",
      description: task.description,
      data: skillResult.result.data,
      text: skillResult.result.text,
    };
  } catch (err: any) {
    return {
      id: task.id,
      skillName: task.skillName,
      status: "failed",
      description: task.description,
      error: redactSecrets(err?.message ?? String(err)),
    };
  }
}

// ── Dependency helpers ──

function computeDepths(
  tasks: SubTaskDefinition[],
  defs: Map<string, SubTaskDefinition>,
): Map<string, number> {
  const depth = new Map<string, number>();

  function resolve(id: string): number {
    if (depth.has(id)) return depth.get(id)!;
    const def = defs.get(id);
    if (!def || def.dependsOn.length === 0) {
      depth.set(id, 0);
      return 0;
    }
    const parentDepths = def.dependsOn.map(resolve);
    const d = Math.max(...parentDepths) + 1;
    depth.set(id, d);
    return d;
  }

  for (const t of tasks) {
    resolve(t.id);
  }

  return depth;
}

function groupByDepth(
  tasks: SubTaskDefinition[],
  depth: Map<string, number>,
): Map<number, SubTaskDefinition[]> {
  const groups = new Map<number, SubTaskDefinition[]>();
  for (const t of tasks) {
    const d = depth.get(t.id) ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(t);
  }
  return groups;
}

/** Get all completed results from a batch of scheduled executions */
export function collectResults(
  results: Map<string, SubTaskResult>,
): SubTaskResult[] {
  return Array.from(results.values()).filter(
    (r) => r.status === "completed",
  );
}
