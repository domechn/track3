import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

describe("coin and stock logo guard", () => {
  it("keeps renderers free of coin logo assets and helpers", () => {
    const offenders = sourceFiles(root)
      .filter((path) =>
        /\b(?:getAssetLogoKey|resolveAssetLogoSrc|getDefaultAssetLogo|shouldDownloadCryptoLogo|downloadCoinLogos|getImageApiPath|coinLogo|logoMap)\b|(?:stock-default-logo|\/assets\/coins\/)|data-label=\{symbol\.slice/.test(
          readFileSync(path, "utf8"),
        ),
      )
      .map((path) => path.slice(root.length + 1));

    expect(offenders).toEqual([]);
  });
});
