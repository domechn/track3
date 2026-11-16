#!/usr/bin/env node
// Prints a Markdown list of the failed and flaky tests in a Playwright JSON report.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function summarize(report) {
  const found = { unexpected: [], flaky: [] };
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        found[test.status]?.push(`${test.projectName} › ${spec.file}:${spec.line} › ${spec.title}`);
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  (report.suites ?? []).forEach(walk);
  const section = (title, tests) =>
    tests.length ? [`### ${title} (${tests.length})`, ...tests.map((test) => `- ${test}`), ""] : [];
  return [
    ...section("Failed browser tests", found.unexpected),
    ...section("Flaky browser tests (passed on retry)", found.flaky),
    ...(found.unexpected.length + found.flaky.length ? [] : ["No failed or flaky browser tests."]),
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(summarize(JSON.parse(readFileSync(process.argv[2], "utf8"))));
}
