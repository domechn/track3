import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromium } from "@playwright/test";

const root = new URL("../", import.meta.url);
const file = (name) => readFileSync(new URL(name, root));
const pngSize = (name) => {
  const data = file(name);
  assert.equal(data.subarray(1, 4).toString(), "PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
};
const pngColor = (name) => {
  const data = file(name);
  assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", name);
  assert.equal(data.subarray(12, 16).toString(), "IHDR", name);
  return [data[24], data[25]];
};

test("Tauri PNGs are RGBA 8-bit", () => {
  for (const name of ["src-tauri/app-icon.png", ...readdirSync(new URL("src-tauri/icons/", root))
    .filter((name) => name.endsWith(".png")).map((name) => `src-tauri/icons/${name}`)]) {
    assert.deepEqual(pngColor(name), [8, 6], name);
  }
});

test("exported desktop, README, and iOS PNGs have their requested dimensions", () => {
  for (const [name, size] of [
    ["src-tauri/icons/icon.png", 1024],
    ["src-tauri/icons/32x32.png", 32],
    ["src-tauri/icons/128x128.png", 128],
    ["src-tauri/icons/128x128@2x.png", 256],
    ...[30, 44, 71, 89, 107, 142, 150, 284, 310].map((size) => [`src-tauri/icons/Square${size}x${size}Logo.png`, size]),
    ["src-tauri/icons/StoreLogo.png", 50],
    ["images/app-icon.png", 512],
    ["src-tauri/app-icon.png", 1024],
  ]) assert.deepEqual(pngSize(name), [size, size], name);
  const catalog = JSON.parse(file("src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/Contents.json"));
  for (const entry of catalog.images) {
    const size = Number(entry.size.split("x")[0]) * Number(entry.scale[0]);
    const name = `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/${entry.filename}`;
    assert.deepEqual(pngSize(name), [size, size], name);
  }
});

test("iOS catalog matches the PNGs produced by the CI icon command", () => {
  const output = mkdtempSync(join(tmpdir(), "track3-brand-test-"));
  try {
    execFileSync("corepack", ["yarn", "tauri", "icon", new URL("src-tauri/app-icon.png", root).pathname, "--output", output], {
      cwd: root, stdio: "pipe", timeout: 600_000,
    });
    for (const name of readdirSync(output).filter((name) => name.endsWith(".png"))) {
      const data = readFileSync(join(output, name));
      assert.deepEqual([data[24], data[25]], [8, 6], name);
    }
    for (const density of readdirSync(join(output, "android"))) {
      for (const name of readdirSync(join(output, "android", density)).filter((name) => name.endsWith(".png"))) {
        const data = readFileSync(join(output, "android", density, name));
        assert.deepEqual([data[24], data[25]], [8, 6], `android/${density}/${name}`);
      }
    }
    const catalogPath = "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/";
    const catalog = JSON.parse(file(`${catalogPath}Contents.json`));
    const names = catalog.images.map((entry) => entry.filename).sort();
    assert.deepEqual(readdirSync(join(output, "ios")).filter((name) => name.endsWith(".png")).sort(), names);
    for (const name of names) {
      assert.deepEqual(file(`${catalogPath}${name}`), readFileSync(join(output, "ios", name)), name);
    }
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("desktop icon export preserves the existing icon names", () => {
  assert.equal(existsSync(new URL("src-tauri/icons/64x64.png", root)), false);
});

test("desktop ICO and ICNS contain the expected icon sizes", () => {
  const ico = file("src-tauri/icons/icon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, index) => ico[6 + index * 16] || 256);
  for (const size of [16, 24, 32, 48, 64, 256]) assert.ok(sizes.includes(size), `ICO ${size}px`);
  const icns = file("src-tauri/icons/icon.icns");
  assert.equal(icns.subarray(0, 4).toString(), "icns");
  assert.equal(icns.readUInt32BE(4), icns.length);
  const kinds = new Set();
  for (let offset = 8; offset < icns.length;) {
    const kind = icns.subarray(offset, offset + 4).toString();
    const length = icns.readUInt32BE(offset + 4);
    assert.ok(length >= 8 && offset + length <= icns.length, `ICNS ${kind} chunk`);
    kinds.add(kind);
    offset += length;
  }
  for (const kind of ["is32", "il32", "ic07", "ic08", "ic09", "ic10"]) {
    assert.ok(kinds.has(kind), `ICNS ${kind}`);
  }
});

test("16px and 32px Windows icons rasterize directly from the SVG", async () => {
  const source = file("docs/brand/app-icon-dark.svg").toString("base64");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 32, height: 32 }, deviceScaleFactor: 1 });
    const ico = file("src-tauri/icons/icon.ico");
    for (const size of [16, 32]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<html><body style="margin:0"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${source}"></body></html>`);
      await page.locator("img").evaluate((image) => image.decode());
      const index = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => i).find((i) => ico[6 + 16 * i] === size);
      assert.notEqual(index, undefined);
      const offset = ico.readUInt32LE(6 + 16 * index + 12);
      const length = ico.readUInt32LE(6 + 16 * index + 8);
      const png = ico.subarray(offset, offset + length);
      assert.equal(png.subarray(1, 4).toString(), "PNG", `ICO ${size}px`);
      assert.equal(png.readUInt32BE(16), size, `ICO ${size}px width`);
      assert.equal(png.readUInt32BE(20), size, `ICO ${size}px height`);
      const difference = await page.evaluate(async (encoded) => {
        const actual = new Image();
        actual.src = `data:image/png;base64,${encoded}`;
        await actual.decode();
        const pixels = (image) => {
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, canvas.width, canvas.height).data;
        };
        const expectedPixels = pixels(document.querySelector("img"));
        const actualPixels = pixels(actual);
        let sum = 0;
        for (let i = 0; i < expectedPixels.length; i += 4) {
          for (let channel = 0; channel < 3; channel++) {
            sum += Math.abs(expectedPixels[i + channel] - actualPixels[i + channel]);
          }
        }
        return sum / (expectedPixels.length / 4 * 3);
      }, png.toString("base64"));
      assert.ok(difference < 4, `ICO ${size}px mean RGB difference ${difference}`);
    }
  } finally {
    await browser.close();
  }
});
