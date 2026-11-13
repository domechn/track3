import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./workflow-secrets-lint.mjs", import.meta.url));
const workflows = fileURLToPath(new URL("../.github/workflows", import.meta.url));

function lintFixture(contents) {
  const directory = mkdtempSync(join(tmpdir(), "track3-workflow-lint-"));
  try {
    writeFileSync(join(directory, "fixture.yml"), contents);
    return spawnSync(process.execPath, [script, directory], { encoding: "utf8" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("rejects updater signing secrets in a pull request workflow", () => {
  const result = lintFixture(`
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ secrets.TAURI_PRIVATE_KEY }}"
`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fixture\.yml.*TAURI_PRIVATE_KEY/);
});

test("accepts a pull request workflow without updater signing secrets", () => {
  const result = lintFixture(`
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ secrets.GITHUB_TOKEN }}"
`);
  assert.equal(result.status, 0, result.stderr);
});

test("allows updater signing secrets in a release-only workflow", () => {
  const result = lintFixture(`
on:
  push:
    branches: [release]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ secrets.TAURI_PRIVATE_KEY }}"
`);
  assert.equal(result.status, 0, result.stderr);
});

test("repository workflows pass the signing secret lint", () => {
  const result = spawnSync(process.execPath, [script, workflows], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
