import test from "node:test";
import assert from "node:assert/strict";
import { recommendedCta } from "./site-cta.mjs";

test("iPhone visitors are sent to sideload instructions", () => {
  assert.deepEqual(recommendedCta({ os: "ios" }), {
    label: "iPhone & iPad install steps",
    href: "./download.html#ios",
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
