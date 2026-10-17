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
  let checks = 0;
  const check = (valid: boolean, message: string) => {
    checks++;
    if (!valid) failures.push(message);
  };
  const matchTools = (expected: ExpectedTool[], observed: ExpectedTool[], label: string) => {
    check(
      expected.length === observed.length &&
        expected.every((item) => observed.some((candidate) =>
          candidate.name === item.name && matchesShape(candidate.args, item.args),
        )),
      `${label}: expected ${expected.map((item) => item.name).join(", ") || "none"}`,
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
    check(!actual.tools.some((tool) => tool.name === name), `forbidden tool: ${name}`);
  }
  for (const text of golden.rubric.mustContain) {
    check(actual.answer.toLowerCase().includes(text.toLowerCase()), `answer missing: ${text}`);
  }
  for (const text of golden.rubric.mustNotContain) {
    check(!actual.answer.toLowerCase().includes(text.toLowerCase()), `answer contains forbidden: ${text}`);
  }
  check(actual.rounds <= (golden.maxRounds ?? 5), "tool loop exceeded round budget");
  check(!actual.tools.some((tool) => tool.error), "tool execution failed");
  return { passed: failures.length === 0, score: (checks - failures.length) / checks, failures };
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

export function compareBaseline(report: { aggregate: number }, baseline: number, threshold: number, mustPassFailed: boolean): boolean {
  return !mustPassFailed && report.aggregate >= baseline - threshold;
}
