import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const generator = fileURLToPath(new URL("./update-ui-goldens.mjs", import.meta.url));
const frozenTheme = JSON.parse(readFileSync(fileURLToPath(new URL("../tests/golden/storage-keys.json", import.meta.url)), "utf8")).theme;

function storageKeysFor(mobileProvider, desktopProvider = 'export type { Theme } from "@/middlelayers/ui-state/appearance";\n') {
  const cwd = mkdtempSync(path.join(tmpdir(), "track3-theme-golden-"));
  const put = (name, contents) => {
    const file = path.join(cwd, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  };
  try {
    put("src/middlelayers/ui-state/appearance.ts", 'export const THEME_VALUES = ["dark", "light", "system"] as const;\n');
    put("src/components/common/theme/index.tsx", desktopProvider);
    put("src/mobile/components/common/theme/index.tsx", mobileProvider);
    put("src/i18n/index.tsx", 'export const SUPPORTED_LOCALES: readonly string[] = ["en", "zh"];\n');
    put("src/mobile/i18n.tsx", 'export { SUPPORTED_LOCALES } from "@/i18n";\n');
    put("src/middlelayers/onboarding-storage.ts", 'export type OnboardingState = "ready";\n');
    const result = spawnSync(process.execPath, [generator, "--print", "storage-keys"], { cwd, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("reads an independent desktop theme union", () => {
  const snapshot = storageKeysFor(
    'export type { Theme } from "@/middlelayers/ui-state/appearance";\n',
    'export type Theme = "dark" | "light" | "system" | "sepia";\n',
  );
  assert.deepEqual(snapshot.theme, ["dark", "light", "system", "sepia"]);
  assert.notDeepEqual(snapshot.theme, frozenTheme);
});

test("resolves a desktop theme re-export to its source values", () => {
  const snapshot = storageKeysFor('export type Theme = "light" | "system";\n');
  assert.deepEqual(snapshot.theme, ["dark", "light", "system"]);
});

test("reads an independent mobile theme union", () => {
  const snapshot = storageKeysFor('export type Theme = "light" | "system";\n');
  assert.deepEqual(snapshot.theme, ["dark", "light", "system"]);
  assert.deepEqual(snapshot.mobileTheme, ["light", "system"]);
});

test("resolves a mobile theme re-export to its source values", () => {
  const snapshot = storageKeysFor('export type { Theme } from "@/middlelayers/ui-state/appearance";\n');
  assert.deepEqual(snapshot.mobileTheme, ["dark", "light", "system"]);
});

