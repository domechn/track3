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
  needs?: string | string[];
  "runs-on"?: string;
  "timeout-minutes"?: number;
  steps?: WorkflowStep[];
  strategy?: {
    matrix?: unknown;
  };
};

type Workflow = {
  concurrency?: {
    group?: string;
    "cancel-in-progress"?: boolean;
  };
  jobs: Record<string, WorkflowJob>;
};

const workflowPath = resolve(
  process.cwd(),
  ".github/workflows/publish.yaml",
);
const tauriActionSha =
  "tauri-apps/tauri-action@84b9d35b5fc46c1e45415bdb6144030364f7ebc5";

describe("publish workflow", () => {
  it("bounds release jobs and retries timed apt installs with a package cache", async () => {
    const workflow = parse(await readFile(workflowPath, "utf8")) as Workflow;
    for (const job of Object.values(workflow.jobs)) {
      expect(job["timeout-minutes"]).toBeGreaterThan(0);
      const aptStep = job.steps?.find(({ run }) => run?.includes("apt-get install"));
      if (!aptStep) continue;
      expect(aptStep["timeout-minutes"]).toBeGreaterThan(0);
      expect(aptStep.run).toContain("Acquire::Retries=3");
      expect(aptStep.run).toContain("Acquire::http::Timeout=30");
      expect(job.steps?.some(({ uses, with: options }) =>
        uses === "actions/cache@v4" && String(options?.path).includes("apt-archives"),
      )).toBe(true);
    }
  });

  it("builds one draft and finalizes it after every platform upload", async () => {
    const workflow = parse(
      await readFile(workflowPath, "utf8"),
    ) as Workflow;

    expect(workflow.concurrency?.group).toContain("${{ github.sha }}");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);

    const prepare = workflow.jobs["prepare-release"];
    const packaging = workflow.jobs["publish-tauri"];
    const finalizer = workflow.jobs["finalize-release"];
    expect(prepare).toBeDefined();
    expect(packaging.needs).toBe("prepare-release");
    expect(finalizer.needs).toEqual(
      expect.arrayContaining(["prepare-release", "publish-tauri"]),
    );
    expect(finalizer["runs-on"]).toBe("ubuntu-22.04");

    const prepareCommands = (prepare.steps ?? [])
      .map(({ run }) => run ?? "")
      .join("\n");
    expect(prepareCommands).toContain("draft=true");

    const tauriSteps = (packaging.steps ?? []).filter(({ uses }) =>
      uses?.startsWith("tauri-apps/tauri-action@"),
    );
    expect(tauriSteps).toHaveLength(1);
    expect(tauriSteps[0]).toEqual(
      expect.objectContaining({
        uses: tauriActionSha,
        with: expect.objectContaining({
          releaseDraft: true,
          includeUpdaterJson: false,
        }),
      }),
    );

    const matrixJobs = Object.values(workflow.jobs).filter(
      ({ strategy }) => strategy?.matrix !== undefined,
    );
    expect(matrixJobs).toEqual([packaging]);

    const finalizeCommands = (finalizer.steps ?? [])
      .map(({ run }) => run ?? "")
      .join("\n");
    expect(finalizeCommands).toContain("corepack yarn update-release");
  });
});
