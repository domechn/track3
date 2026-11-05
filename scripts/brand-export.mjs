import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { trackLogoPeaks, trackLogoStrokeWidth } from "../src/components/brand/track-logo-paths.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = (path) => join(root, path);
const write = (path, content) => {
  mkdirSync(dirname(target(path)), { recursive: true });
  writeFileSync(target(path), content);
};

const colors = {
  light: { primary: "hsl(213 63% 43%)", tint: "hsl(213 63% 65%)", tile: "#FFFFFF", edge: "#E2E2E6" },
  dark: { primary: "hsl(213 63% 56%)", tint: "hsl(213 63% 73%)", tile: "#0E0E10", edge: "#2A2A2F" },
};
const svg = (contents) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">${contents}</svg>\n`;
const peaks = (primary, tint) => trackLogoPeaks.map((points, index) => {
  const color = index ? tint : primary;
  return `<polygon points="${points}" fill="${color}" stroke="${color}" stroke-width="${trackLogoStrokeWidth}" stroke-linejoin="round"/>`;
}).join("");
const tile = (theme, ios = false) => {
  const palette = colors[theme];
  const backdrop = ios
    ? `<rect width="28" height="28" fill="${palette.tile}"/>`
    : `<rect x=".0275" y=".0275" width="27.945" height="27.945" rx="6.16" fill="${palette.tile}" stroke="${palette.edge}" stroke-width=".055"/>`;
  return svg(backdrop + peaks(palette.primary, palette.tint));
};

write("docs/brand/logo-mark.svg", svg(`<style>
  :root { --peak-primary: ${colors.light.primary}; --peak-tint: ${colors.light.tint}; }
  @media (prefers-color-scheme: dark) { :root { --peak-primary: ${colors.dark.primary}; --peak-tint: ${colors.dark.tint}; } }
</style>${peaks("var(--peak-primary)", "var(--peak-tint)")} `));
write("docs/brand/app-icon-light.svg", tile("light"));
write("docs/brand/app-icon-dark.svg", tile("dark"));
write("docs/brand/app-icon-ios.svg", tile("dark", true));
write("docs/brand/logo-mono.svg", svg(peaks("currentColor", "currentColor")));
for (const theme of ["light", "dark"]) {
  write(`public/track3-${theme}.svg`, svg(peaks(colors[theme].primary, colors[theme].tint)));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
const render = async (sourcePath, size, outputPath, rgba = false) => {
  const source = readFileSync(target(sourcePath), "utf8");
  const data = Buffer.from(source).toString("base64");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${data}"></body></html>`);
  await page.locator("img").evaluate((image) => image.decode());
  let png = await page.screenshot({ omitBackground: true });
  if (rgba && png[25] !== 6) {
    const base64 = await page.evaluate(async (encoded) => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1];
    }, png.toString("base64"));
    png = Buffer.from(base64, "base64");
  }
  if (rgba && (png[24] !== 8 || png[25] !== 6)) throw new Error("Tauri PNG must be RGBA 8-bit");
  if (outputPath) write(outputPath, png);
  return png;
};

const sharpenIco = async () => {
  const original = readFileSync(target("src-tauri/icons/icon.ico"));
  const count = original.readUInt16LE(4);
  const directory = Buffer.from(original.subarray(0, 6 + 16 * count));
  const images = [];
  let offset = directory.length;
  for (let index = 0; index < count; index++) {
    const entry = 6 + 16 * index;
    const size = original[entry] || 256;
    const oldOffset = original.readUInt32LE(entry + 12);
    const oldLength = original.readUInt32LE(entry + 8);
    const image = size <= 32
      ? await render("docs/brand/app-icon-dark.svg", size)
      : original.subarray(oldOffset, oldOffset + oldLength);
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    images.push(image);
    offset += image.length;
  }
  write("src-tauri/icons/icon.ico", Buffer.concat([directory, ...images]));
};

const temporary = mkdtempSync(join(tmpdir(), "track3-brand-export-"));
try {
  await render("docs/brand/app-icon-dark.svg", 1024, "src-tauri/icons/icon.png", true);
  await render("docs/brand/app-icon-dark.svg", 512, "images/app-icon.png");
  await render("docs/brand/app-icon-ios.svg", 1024, "src-tauri/app-icon.png", true);

  execFileSync("corepack", ["yarn", "tauri", "icon", target("src-tauri/icons/icon.png"), "--output", temporary], {
    cwd: root, stdio: "pipe", timeout: 600_000,
  });
  for (const name of readdirSync(temporary)) {
    if (!/\.(png|ico|icns)$/.test(name) || name === "64x64.png") continue;
    copyFileSync(join(temporary, name), target(`src-tauri/icons/${name}`));
    if (name.endsWith(".png") && name !== "icon.png") {
      const png = readFileSync(target(`src-tauri/icons/${name}`));
      await render("docs/brand/app-icon-dark.svg", png.readUInt32BE(16), `src-tauri/icons/${name}`, true);
    }
  }
  // Tauri's default icon.png is 512px; retain the requested 1024px master.
  await render("docs/brand/app-icon-dark.svg", 1024, "src-tauri/icons/icon.png", true);
  await sharpenIco();

  const catalogDir = "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset";
  execFileSync("corepack", ["yarn", "tauri", "icon", target("src-tauri/app-icon.png"), "--output", temporary], {
    cwd: root, stdio: "pipe", timeout: 600_000,
  });
  const catalog = JSON.parse(readFileSync(target(`${catalogDir}/Contents.json`), "utf8"));
  for (const entry of catalog.images) {
    copyFileSync(join(temporary, "ios", entry.filename), target(`${catalogDir}/${entry.filename}`));
  }
} finally {
  await browser.close();
  rmSync(temporary, { recursive: true, force: true });
}
console.log("Track3 brand SVGs, desktop icons, README image, and iOS catalog regenerated.");
