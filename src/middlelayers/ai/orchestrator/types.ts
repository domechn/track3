// Orchestrator core types.
// See scheduler.ts and index.ts for the event-driven execution loop.

// ── Sub-task lifecycle ──

export type SubTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface SubTaskDefinition {
  /** Unique id within a plan (e.g. "t1", "t2"). */
  id: string;
  /** Name of the registered AI skill to invoke. */
  skillName: string;
  /** Arguments forwarded to the skill. */
  args: Record<string, unknown>;
  /** Human label shown in agent-activity blocks. */
  description: string;
  /**
   * IDs of tasks that must complete before this one starts.
   * Empty array means no dependency (eligible for parallel dispatch).
   */
  dependsOn: string[];
}

export interface SubTaskResult {
  id: string;
  skillName: string;
  status: SubTaskStatus;
  /** Copied from the SubTaskDefinition for use in UI rendering. */
  description: string;
  data?: unknown;
  text?: string;
  error?: string;
}

// ── Analysis plan ──

export interface AnalysisPlan {
  /** The user's original query. */
  query: string;
  /** Sub-tasks to execute. */
  tasks: SubTaskDefinition[];
  /**
   * Whether the final output should go through the self-critique
   * refinement loop. Enabled for multi-tool or analytical queries.
   */
  requiresRefinement: boolean;
  /**
   * How many refinement rounds to run (0 = skip refinement).
   * 1 is usually enough.
   */
  maxOptimizerRounds: number;
}

// ── Provider-independent LLM call (non-streaming) ──

export interface LlmCallParams {
  endpoint: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
}

export interface LlmCallResult {
  content: string;
  ok: boolean;
  error?: string;
}

// ── Events yielded by the orchestrator ──

export type OrchestratorEvent =
  | { kind: "agent_start"; taskId: string; skillName: string; description: string }
  | { kind: "agent_complete"; taskId: string; skillName: string; description: string; result: SubTaskResult }
  | { kind: "agent_error"; taskId: string; skillName: string; description: string; error: string }
  | { kind: "agent_result"; taskId: string; skillName: string; text: string }
  | { kind: "synthesizing" }
  | { kind: "optimizing"; round: number; totalRounds: number }
  | { kind: "text"; delta: string }
  | { kind: "error"; message: string }
  | { kind: "done" };

// ── Orchestrator options ──

export interface OrchestratorOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  baseCurrency: { currency: string; rate: number; alias: string; symbol: string };
  signal?: AbortSignal;
  // Whether to skip the LLM-based analyzer (useful for tests or fixed plans).
  skipAnalyzer?: boolean;
  // Override plan (used when skipAnalyzer is true or plan is pre-computed).
  planOverride?: AnalysisPlan;
}
