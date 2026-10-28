import test from "node:test";
import assert from "node:assert/strict";
import { detectPlatform } from "./download-page.mjs";
import { recommendedCta } from "./site-cta.mjs";

test("iPhone visitors are sent to the coming-soon section", () => {
  assert.deepEqual(recommendedCta({ os: "ios" }), {
    label: "iPhone & iPad: coming soon",
    href: "./index.html#ios",
  });
});

test("desktop visitors are sent to platform-aware downloads", () => {
  assert.deepEqual(recommendedCta({ os: "windows" }), {
    label: "Download for Windows",
    href: "./download.html",
  });
  assert.deepEqual(recommendedCta({ os: "linux" }), {
    label: "Download for Linux",
    href: "./download.html",
  });
  assert.deepEqual(recommendedCta({ os: "macos" }), {
    label: "Download for macOS",
    href: "./download.html",
  });
});

test("Android visitors get a generic download CTA", () => {
  const platform = detectPlatform({
    platform: "Linux armv8l",
    userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36",
  });
  assert.deepEqual(recommendedCta(platform), {
    label: "Get Track3",
    href: "./download.html",
  });
});
