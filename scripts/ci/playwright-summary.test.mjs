import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize } from "./playwright-summary.mjs";

const spec = (title, status) => ({ title, file: "a.spec.ts", line: 3, tests: [{ projectName: "desktop", status }] });

test("lists failed and flaky tests from nested suites and leaves passing tests out", () => {
  const summary = summarize({
    suites: [{ specs: [spec("passes", "expected")], suites: [{ specs: [spec("breaks", "unexpected"), spec("wobbles", "flaky")] }] }],
  });
  assert.match(summary, /### Failed browser tests \(1\)\n- desktop › a\.spec\.ts:3 › breaks/);
  assert.match(summary, /### Flaky browser tests \(passed on retry\) \(1\)\n- desktop › a\.spec\.ts:3 › wobbles/);
  assert.doesNotMatch(summary, /passes/);
});

test("says so when nothing failed or flaked", () => {
  assert.equal(summarize({ suites: [{ specs: [spec("passes", "expected")] }] }), "No failed or flaky browser tests.");
});
