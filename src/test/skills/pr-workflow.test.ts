import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type WorkflowStep = {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};

type WorkflowJob = {
  needs?: string | string[];
  "runs-on"?: string;
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
  it("runs a stable quality gate before every packaging matrix", async () => {
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
    expect(commands).toContain("corepack yarn test");
    expect(commands).toContain("corepack yarn test:coverage");
    expect(commands.indexOf("corepack yarn test")).toBeLessThan(
      commands.indexOf("corepack yarn test:coverage"),
    );
    expect(commands).toContain("corepack yarn build");
    expect(commands).toContain("cargo test --locked --all-targets");
    expect(commands).toContain("cargo check --locked");

    const packagingJobs = Object.values(workflow.jobs).filter(
      ({ strategy }) => strategy?.matrix !== undefined,
    );
    expect(packagingJobs.length).toBeGreaterThan(0);
    for (const job of packagingJobs) {
      expect(job.needs).toBe("quality");
      expect(job.steps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uses: pinnedTauriAction }),
        ]),
      );
    }
  });
});
