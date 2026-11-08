import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const guard = join(import.meta.dirname, "theme-raw-colors-guard.mjs");

test("shell declarations reject raw colors unless a reason is attached", () => {
  const directory = mkdtempSync(join(tmpdir(), "track3-shell-guard-"));
  try {
    const fixture = join(directory, "fixture.css");
    writeFileSync(fixture, ".t3-fidelity-sidebar { background: #000; }\n");
    let result = spawnSync(process.execPath, [guard, fixture], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /fixture\.css.*background.*#000/);

    writeFileSync(fixture, ".t3-fidelity-sidebar { /* theme-exempt: brand sample */ background: #000; }\n");
    result = spawnSync(process.execPath, [guard, fixture], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);

    writeFileSync(fixture, ".feature-card { background: #000; }\n.mobile-tab-bar { border-color: white; }\n");
    result = spawnSync(process.execPath, [guard, fixture], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /mobile-tab-bar.*border-color.*white/);
    assert.doesNotMatch(result.stderr, /feature-card/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("shell TSX rejects raw color utilities", () => {
  const directory = mkdtempSync(join(tmpdir(), "track3-shell-guard-"));
  try {
    const fixture = join(directory, "index.tsx");
    writeFileSync(fixture, '<aside className="bg-black text-white" />\n');
    const result = spawnSync(process.execPath, [guard, fixture], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /bg-black/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("all shell rails, chat headers, tab icons, and semantic shell elements reject raw colors", () => {
  const directory = mkdtempSync(join(tmpdir(), "track3-shell-guard-"));
  try {
    const fixture = join(directory, "fixture.css");
    for (const selector of [
      ".t3-desktop-rail", ".t3-fidelity-rail-live", ".t3-fidelity-rail-refresh-container",
      ".fidelity-records-rail-collapsed", ".fidelity-chat-header-primary",
      ".mobile-tab-icon", "nav", "aside", "header",
    ]) {
      writeFileSync(fixture, `${selector} { background: #000; }\n`);
      const result = spawnSync(process.execPath, [guard, fixture], { encoding: "utf8" });
      assert.equal(result.status, 1, `${selector}: ${result.stderr}`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("tag and count selectors reject raw hex, numeric HSL, and named colors", () => {
  const directory = mkdtempSync(join(tmpdir(), "track3-tag-guard-"));
  try {
    const fixture = join(directory, "fixture.css");
    for (const selector of [
      ".t3-tag", ".fidelity-badge", ".fd-change-chip", ".fidelity-pill",
      ".coin-fidelity-heading h1 b", ".fd-header-alerts span",
    ]) {
      for (const color of ["#fff", "hsl(120 50% 50%)", "white"]) {
        writeFileSync(fixture, `${selector} { color: ${color}; }\n`);
        const result = spawnSync(process.execPath, [guard, fixture], { encoding: "utf8" });
        assert.equal(result.status, 1, `${selector}: ${color}: ${result.stderr}`);
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("non-tag names containing tag or age do not trigger the tag guard", () => {
  const directory = mkdtempSync(join(tmpdir(), "track3-tag-guard-"));
  try {
    const fixture = join(directory, "fixture.css");
    writeFileSync(fixture, ".percentage { color: #fff; }\n.stage { color: white; }\n.status-tag { color: #fff; }\n");
    const result = spawnSync(process.execPath, [guard, fixture], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /status-tag/);
    assert.doesNotMatch(result.stderr, /percentage|stage/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
