import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const guard = fileURLToPath(new URL("./ui-refactor-guard.mjs", import.meta.url));
const catalogs = [
  "src/i18n/locales/en.json",
  "src/i18n/locales/zh.json",
  "src/mobile/en.json",
  "src/mobile/zh.json",
];

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function put(cwd, name, contents) {
  mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
  writeFileSync(path.join(cwd, name), contents);
}

function fixture(fn) {
  const cwd = mkdtempSync(path.join(tmpdir(), "track3-ui-guard-"));
  git(cwd, "init", "-q");
  git(cwd, "config", "user.email", "test@example.invalid");
  git(cwd, "config", "user.name", "Test");
  put(cwd, "src/components/card.tsx", "export const card = 1;\n");
  put(cwd, "src/middlelayers/x.ts", "export const x = 1;\n");
  for (const name of catalogs) {
    put(cwd, name, JSON.stringify({
      "ordinary.key": "old",
      "rebalance.symbol": "Symbol",
      "assistant.action.preview.example": "Preview",
      "assistant.action.approve": "Approve",
    }) + "\n");
  }
  git(cwd, "add", ".");
  git(cwd, "commit", "-qm", "base");
  const base = git(cwd, "rev-parse", "HEAD");
  fn({ cwd, base, put: (name, contents) => put(cwd, name, contents) });
  git(cwd, "add", ".");
  git(cwd, "commit", "-qm", "change");
  return { cwd, base, result: spawnSync("node", [guard, base], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORMAT_EXCEPTION_APPROVED: "false" },
  }) };
}

function check(name, change, expectedStatus, expectedOutput, exception = false) {
  test(name, () => {
    const { cwd, base, result } = fixture(change);
    try {
      const actual = exception
        ? spawnSync("node", [guard, base], {
          cwd,
          encoding: "utf8",
          env: { ...process.env, FORMAT_EXCEPTION_APPROVED: "true" },
        })
        : result;
      assert.equal(actual.status, expectedStatus, actual.stderr);
      assert.match(actual.stdout + actual.stderr, expectedOutput);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
}

check("allows a presentation-only component edit", ({ put }) => {
  put("src/components/card.tsx", "export const card = 2;\n");
}, 0, /passed/);

check("denies a middlelayer edit", ({ put }) => {
  put("src/middlelayers/x.ts", "export const x = 2;\n");
}, 1, /src\/middlelayers\/x.ts/);

check("accepts a denied path with an approved exception", ({ put }) => {
  put("src/middlelayers/x.ts", "export const x = 2;\n");
}, 0, /passed/, true);

check("rejects a storage write inside an allowed component", ({ put }) => {
  put("src/components/card.tsx", "localStorage.setItem('new-key', 'x');\n");
}, 1, /localStorage/);

check("rejects removal of an existing catalog key", ({ put }) => {
  put(catalogs[0], JSON.stringify({
    "rebalance.symbol": "Symbol",
    "assistant.action.preview.example": "Preview",
    "assistant.action.approve": "Approve",
  }) + "\n");
}, 1, /ordinary.key/);

check("rejects a frozen CSV label edit", ({ put }) => {
  put(catalogs[0], JSON.stringify({
    "ordinary.key": "old",
    "rebalance.symbol": "Ticker",
    "assistant.action.preview.example": "Preview",
    "assistant.action.approve": "Approve",
  }) + "\n");
}, 1, /rebalance.symbol/);

check("allows translation of non-persisted action button copy", ({ put }) => {
  put(catalogs[0], JSON.stringify({
    "ordinary.key": "old",
    "rebalance.symbol": "Symbol",
    "assistant.action.preview.example": "Preview",
    "assistant.action.approve": "Confirm",
  }) + "\n");
}, 0, /passed/);
