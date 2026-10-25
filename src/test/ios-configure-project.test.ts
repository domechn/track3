import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("normalizes a Tauri rewritten Info.plist to the committed project form", () => {
  const directory = mkdtempSync(join(tmpdir(), "track3-ios-project-"));
  try {
    const apple = join(directory, "src-tauri/gen/apple");
    mkdirSync(join(apple, "track3_iOS"), { recursive: true });
    writeFileSync(join(directory, "src-tauri/tauri.conf.json"), '{"version":"0.9.0"}');
    writeFileSync(join(apple, "project.yml"), [
      "      PRODUCT_NAME: Track3",
      "        CFBundleShortVersionString: 0.9.0",
      "        CFBundleVersion: 0.9.0",
      "    entitlements:",
      "      path: track3_iOS/track3_iOS.entitlements",
      "",
    ].join("\n"));
    const info = join(apple, "track3_iOS/Info.plist");
    writeFileSync(info, "<key>CFBundleShortVersionString</key><string>0.9.0</string>\n<key>CFBundleVersion</key><string>0.9.0</string>");
    const script = resolve("scripts/ios/configure-project.py");
    const first = spawnSync("python3", [script], { cwd: directory, encoding: "utf8" });
    expect(first.status, first.stderr).toBe(0);
    const normalized = readFileSync(info, "utf8");
    expect(normalized).toContain("<string>$(MARKETING_VERSION)</string>");
    expect(normalized).toContain("<string>$(CURRENT_PROJECT_VERSION)</string>");
    expect(normalized.endsWith("\n")).toBe(true);
    const second = spawnSync("python3", [script], { cwd: directory, encoding: "utf8" });
    expect(second.status, second.stderr).toBe(0);
    expect(readFileSync(info, "utf8")).toBe(normalized);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
