import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type WorkflowStep = {
  uses?: string;
  run?: string;
  "timeout-minutes"?: number;
  with?: Record<string, unknown>;
};

type WorkflowJob = {
  if?: string;
  needs?: string | string[];
  "runs-on"?: string;
  "timeout-minutes"?: number;
  steps?: WorkflowStep[];
  strategy?: {
    matrix?: unknown;
  };
};

type Workflow = {
  jobs: Record<string, WorkflowJob>;
};

const workflowPath = resolve(
  process.cwd(),
  ".github/workflows/test-on-pr.yaml",
);
const pinnedTauriAction =
  "tauri-apps/tauri-action@84b9d35b5fc46c1e45415bdb6144030364f7ebc5";

describe("pull request workflow", () => {
  it("bounds every job and retries timed apt installs with a package cache", async () => {
    const workflow = parse(await readFile(workflowPath, "utf8")) as Workflow;
    for (const job of Object.values(workflow.jobs)) {
      expect(job["timeout-minutes"]).toBeGreaterThan(0);
      // Options sit between the command and "install", so match the pair, not the literal phrase.
      const aptStep = job.steps?.find(({ run }) => /apt[-_]get\b[^\n]*\binstall\b/.test(run ?? ""));
      if (!aptStep) continue;
      expect(aptStep["timeout-minutes"]).toBeGreaterThan(0);
      expect(aptStep.run).toContain("Acquire::Retries=3");
      expect(aptStep.run).toContain("Acquire::http::Timeout=30");
      expect(job.steps?.some(({ uses, with: options }) =>
        uses === "actions/cache@v4" && String(options?.path).includes("apt-archives"),
      )).toBe(true);
    }
  });

  it("runs a stable quality gate and a pre-check before every packaging matrix", async () => {
    const workflow = parse(
      await readFile(workflowPath, "utf8"),
    ) as Workflow;
    const quality = workflow.jobs.quality;

    expect(quality).toBeDefined();
    expect(quality["runs-on"]).toBe("ubuntu-22.04");

    const qualitySteps = quality.steps ?? [];
    expect(qualitySteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uses: "actions/setup-node@v4",
          with: expect.objectContaining({ "node-version": 24 }),
        }),
        expect.objectContaining({
          uses: "dtolnay/rust-toolchain@stable",
          with: expect.objectContaining({ toolchain: "1.94.1" }),
        }),
      ]),
    );

    const commands = qualitySteps
      .map(({ run }) => run ?? "")
      .join("\n");
    expect(commands).toContain("corepack prepare yarn@4.9.2 --activate");
    expect(commands).toContain("corepack yarn install --immutable");
    // The coverage run executes every test file once and enforces the thresholds.
    expect(commands).toContain("corepack yarn test:coverage");
    expect(commands).not.toMatch(/corepack yarn test(?![:\w])/);
    expect(commands).toContain("corepack yarn build");
    expect(commands).toContain("cargo test --locked --all-targets");
    expect(commands).toContain("cargo check --locked");

    const packagingJobs = Object.values(workflow.jobs).filter(({ steps }) =>
      steps?.some(({ uses }) => uses === pinnedTauriAction),
    );
    expect(packagingJobs.length).toBeGreaterThan(0);
    for (const job of packagingJobs) {
      expect(job.needs).toBe("pre-check");
      expect(job.strategy?.matrix).toBeDefined();
    }
  });

  it("keeps the original check names and never reports them as skipped", async () => {
    const workflow = parse(await readFile(workflowPath, "utf8")) as Workflow;
    for (const name of ["quality", "e2e", "compat-094", "test-tauri"]) {
      const job = workflow.jobs[name];
      expect(job, name).toBeDefined();
      expect([job.needs].flat(), name).toContain("pre-check");
      // A job skipped by a failed dependency counts as a passing required check.
      expect(job.if, name).toMatch(/always\(\)|!cancelled\(\)/);
      expect(job.steps?.some(({ run }) => run?.includes("needs.pre-check.result")), name).toBe(true);
    }
    expect([workflow.jobs.e2e.needs].flat()).toContain("e2e-shard");
    const shardCommands = (workflow.jobs["e2e-shard"].steps ?? []).map(({ run }) => run ?? "").join("\n");
    expect(shardCommands).toContain("corepack yarn test:e2e");
    expect(shardCommands).toContain("--shard=${{ matrix.shard }}/");
  });
});
