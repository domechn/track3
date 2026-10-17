export type ExpectedTool = { name: string; args: Record<string, unknown> };
export type ExpectedFact = { tool: string; path: string; value: unknown };
export type GoldenExpectation = {
  id: string;
  mustPass: boolean;
  expectedPlan: ExpectedTool[];
  expectedTools: ExpectedTool[];
  expectedFacts: ExpectedFact[];
  forbiddenTools: string[];
  rubric: { mustContain: string[]; mustNotContain: string[] };
  maxRounds?: number;
};
export type ActualTool = ExpectedTool & { result: unknown; error?: string };
export type ActualCase = {
  plan: ExpectedTool[];
  tools: ActualTool[];
  answer: string;
  rounds: number;
};

export function scoreGoldenCase(golden: GoldenExpectation, actual: ActualCase): { passed: boolean; score: number; failures: string[] } {
  const failures: string[] = [];
  let scoredChecks = 0;
  let scoredPasses = 0;
  const check = (valid: boolean, message: string, required = true) => {
    if (required || !valid) {
      scoredChecks++;
      if (valid) scoredPasses++;
    }
    if (!valid) failures.push(message);
  };
  const matchTools = (expected: ExpectedTool[], observed: ExpectedTool[], label: string) => {
    check(
      expected.length === observed.length &&
        expected.every((item) => observed.some((candidate) =>
          candidate.name === item.name && matchesShape(candidate.args, item.args),
        )),
      `${label}: expected ${expected.map((item) => item.name).join(", ") || "none"}`,
      expected.length > 0,
    );
  };

  matchTools(golden.expectedPlan, actual.plan, "plan");
  matchTools(golden.expectedTools, actual.tools, "tools");
  for (const fact of golden.expectedFacts) {
    const tool = actual.tools.find((item) => item.name === fact.tool);
    check(
      tool !== undefined && JSON.stringify(getPath(tool.result, fact.path)) === JSON.stringify(fact.value),
      `tool fact missing: ${fact.tool}.${fact.path} = ${String(fact.value)}`,
    );
  }
  for (const name of golden.forbiddenTools) {
    check(!actual.tools.some((tool) => tool.name === name), `forbidden tool: ${name}`, false);
  }
  for (const text of golden.rubric.mustContain) {
    check(actual.answer.toLowerCase().includes(text.toLowerCase()), `answer missing: ${text}`);
  }
  for (const text of golden.rubric.mustNotContain) {
    check(!actual.answer.toLowerCase().includes(text.toLowerCase()), `answer contains forbidden: ${text}`, false);
  }
  check(actual.rounds <= (golden.maxRounds ?? 5), "tool loop exceeded round budget", false);
  check(!actual.tools.some((tool) => tool.error), "tool execution failed", false);
  return { passed: failures.length === 0, score: scoredChecks ? scoredPasses / scoredChecks : 1, failures };
}

function matchesShape(actual: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== "object") return actual === expected;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.every((item, index) => matchesShape(actual[index], item));
  }
  return typeof actual === "object" && actual !== null &&
    Object.entries(expected).every(([key, value]) =>
      matchesShape((actual as Record<string, unknown>)[key], value),
    );
}

function getPath(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (value, key) => value && typeof value === "object"
      ? (value as Record<string, unknown>)[key]
      : undefined,
    data,
  );
}

export function compareBaseline(
  report: { aggregate: number },
  baseline: number,
  threshold: number,
  mustPassFailed: boolean,
  calibrated = true,
): boolean {
  return !mustPassFailed && (!calibrated || report.aggregate >= baseline - threshold);
}

export function parseJudgeScore(content: string): number | undefined {
  const match = content.match(/\{[^{}]*\}/);
  if (!match) return undefined;
  try {
    const score = (JSON.parse(match[0]) as { score?: unknown }).score;
    return typeof score === "number" && score >= 0 && score <= 1 ? score : undefined;
  } catch {
    return undefined;
  }
}

export function countToolRounds(prompts: string[]): number {
  return prompts.filter((prompt) =>
    prompt.includes("Track3 portfolio assistant") && !prompt.includes("synthesising"),
  ).length;
}

export function parsePlannedTools(content: string): ExpectedTool[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const value: unknown = JSON.parse(match[0]);
    if (!value || typeof value !== "object" || !("tasks" in value) || !Array.isArray(value.tasks)) return [];
    return value.tasks.flatMap((task: unknown) => {
      if (!task || typeof task !== "object" || !("skillName" in task) || typeof task.skillName !== "string" ||
        !("args" in task) || !task.args || typeof task.args !== "object" || Array.isArray(task.args)) return [];
      return [{ name: task.skillName, args: task.args as Record<string, unknown> }];
    });
  } catch {
    return [];
  }
}
