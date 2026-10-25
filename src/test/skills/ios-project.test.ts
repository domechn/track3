import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { expect, it } from "vitest";

it("configures the committed Xcode files in the form left by Tauri iOS build", () => {
  const cwd = mkdtempSync(join(tmpdir(), "track3-ios-project-"));
  try {
    const apple = join(cwd, "src-tauri/gen/apple");
    mkdirSync(join(apple, "track3_iOS"), { recursive: true });
    mkdirSync(join(apple, "track3.xcodeproj"), { recursive: true });
    copyFileSync(resolve("src-tauri/gen/apple/project.yml"), join(apple, "project.yml"));
    copyFileSync(resolve("src-tauri/gen/apple/track3.xcodeproj/project.pbxproj"), join(apple, "track3.xcodeproj/project.pbxproj"));
    copyFileSync(resolve("src-tauri/gen/apple/track3_iOS/Info.plist"), join(apple, "track3_iOS/Info.plist"));
    writeFileSync(join(cwd, "src-tauri/tauri.conf.json"), '{"version":"1.2.3"}');
    const configure = () => execFileSync("python3", [resolve("scripts/ios/configure-project.py")], { cwd });
    configure();
    const project = readFileSync(join(apple, "track3.xcodeproj/project.pbxproj"), "utf8");
    const plist = readFileSync(join(apple, "track3_iOS/Info.plist"), "utf8");
    expect(project).toContain('PRODUCT_NAME = "Track3";');
    expect(project).not.toContain("PRODUCT_NAME = Track3;");
    expect(plist).toContain("<key>CFBundleShortVersionString</key>\n\t<string>$(MARKETING_VERSION)</string>");
    expect(plist).toContain("<key>CFBundleVersion</key>\n\t<string>$(CURRENT_PROJECT_VERSION)</string>");
    expect(plist.endsWith("\n")).toBe(true);
    configure();
    expect(readFileSync(join(apple, "track3.xcodeproj/project.pbxproj"), "utf8")).toBe(project);
    expect(readFileSync(join(apple, "track3_iOS/Info.plist"), "utf8")).toBe(plist);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
