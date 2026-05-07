import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlatformDownloads,
  detectPlatform,
  pickAssetForTarget,
  pickRecommendedAsset,
  resolveLatestDownloadUrl,
} from "./download-page.mjs";

const assets = [
  {
    name: "track3_0.6.1_aarch64.dmg",
    browser_download_url:
      "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_aarch64.dmg",
  },
  {
    name: "track3_0.6.1_x64.dmg",
    browser_download_url:
      "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_x64.dmg",
  },
  {
    name: "track3_0.6.1_x64-setup.exe",
    browser_download_url:
      "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_x64-setup.exe",
  },
  {
    name: "track3_0.6.1_x64_en-US.msi",
    browser_download_url:
      "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_x64_en-US.msi",
  },
  {
    name: "track3_0.6.1_amd64.AppImage",
    browser_download_url:
      "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_amd64.AppImage",
  },
  {
    name: "track3_0.6.1_amd64.deb",
    browser_download_url:
      "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_amd64.deb",
  },
  {
    name: "track3-0.6.1-1.x86_64.rpm",
    browser_download_url:
      "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3-0.6.1-1.x86_64.rpm",
  },
  {
    name: "track3_0.6.1_x64-setup.exe.sig",
    browser_download_url:
      "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_x64-setup.exe.sig",
  },
];

test("detectPlatform identifies Apple Silicon Macs from userAgentData", () => {
  const platform = detectPlatform({
    userAgentData: {
      platform: "macOS",
      architecture: "arm",
    },
    userAgent: "Mozilla/5.0",
    platform: "MacIntel",
  });

  assert.deepEqual(platform, {
    os: "macos",
    arch: "arm64",
    confidence: "high",
    label: "macOS (Apple Silicon)",
  });
});

test("detectPlatform identifies Windows x64 from the user agent fallback", () => {
  const platform = detectPlatform({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0 Safari/537.36",
    platform: "Win32",
  });

  assert.deepEqual(platform, {
    os: "windows",
    arch: "x64",
    confidence: "medium",
    label: "Windows",
  });
});

test("buildPlatformDownloads groups installable assets and excludes signatures", () => {
  const downloads = buildPlatformDownloads(assets);

  assert.deepEqual(
    downloads.macos.arm64.map((asset) => asset.name),
    ["track3_0.6.1_aarch64.dmg"],
  );
  assert.deepEqual(
    downloads.windows.x64.map((asset) => asset.name),
    ["track3_0.6.1_x64-setup.exe", "track3_0.6.1_x64_en-US.msi"],
  );
  assert.deepEqual(
    downloads.linux.x64.map((asset) => asset.name),
    [
      "track3_0.6.1_amd64.AppImage",
      "track3_0.6.1_amd64.deb",
      "track3-0.6.1-1.x86_64.rpm",
    ],
  );
});

test("pickRecommendedAsset prefers the best installer for each supported platform", () => {
  const downloads = buildPlatformDownloads(assets);

  assert.equal(
    pickRecommendedAsset(downloads, { os: "macos", arch: "arm64" }).name,
    "track3_0.6.1_aarch64.dmg",
  );
  assert.equal(
    pickRecommendedAsset(downloads, { os: "macos", arch: "x64" }).name,
    "track3_0.6.1_x64.dmg",
  );
  assert.equal(
    pickRecommendedAsset(downloads, { os: "windows", arch: "x64" }).name,
    "track3_0.6.1_x64-setup.exe",
  );
  assert.equal(
    pickRecommendedAsset(downloads, { os: "linux", arch: "x64" }).name,
    "track3_0.6.1_amd64.AppImage",
  );
  assert.equal(
    pickRecommendedAsset(downloads, { os: "macos", arch: "unknown" }),
    null,
  );
});

test("pickAssetForTarget returns the requested installer kind when available", () => {
  const downloads = buildPlatformDownloads(assets);

  assert.equal(
    pickAssetForTarget(downloads, {
      os: "windows",
      arch: "x64",
      kind: "msi",
    }).name,
    "track3_0.6.1_x64_en-US.msi",
  );
  assert.equal(
    pickAssetForTarget(downloads, {
      os: "linux",
      arch: "x64",
      kind: "rpm",
    }).name,
    "track3-0.6.1-1.x86_64.rpm",
  );
  assert.equal(
    pickAssetForTarget(downloads, {
      os: "macos",
      arch: "arm64",
      kind: "app-tar-gz",
    }),
    null,
  );
});

test("resolveLatestDownloadUrl builds the newest installer URL from latest.json metadata", () => {
  const latestMetadata = {
    version: "0.6.1",
  };

  assert.equal(
    resolveLatestDownloadUrl(latestMetadata, {
      os: "macos",
      arch: "arm64",
      kind: "dmg",
    }),
    "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_aarch64.dmg",
  );
  assert.equal(
    resolveLatestDownloadUrl(latestMetadata, {
      os: "windows",
      arch: "x64",
      kind: "exe",
    }),
    "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3_0.6.1_x64-setup.exe",
  );
  assert.equal(
    resolveLatestDownloadUrl(latestMetadata, {
      os: "linux",
      arch: "x64",
      kind: "rpm",
    }),
    "https://github.com/domechn/track3/releases/download/app-v0.6.1/track3-0.6.1-1.x86_64.rpm",
  );
});
