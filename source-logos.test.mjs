import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

const root = new URL(".", import.meta.url);
const app = new URL("../track3-merge5/src/assets/icons/", root);
const logoDir = new URL("images/logos/", root);
const manifestFile = new URL("manifest.json", logoDir);
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile)) : {};
const sourceFiles = [
  "binance-logo.svg", "okex-logo.svg", "bitget-logo.svg", "kraken-logo.svg",
  "gate-logo.svg", "coinbase-logo.png", "bybit-logo.svg", "htx-logo.svg",
  "mexc-logo.svg", "backpack-logo.svg", "ibkr-logo.svg", "btc-logo.svg",
  "eth-logo.svg", "sol-logo.svg", "doge-logo.svg", "ton-logo.svg",
  "sui-logo.svg", "tron-logo.svg",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("every source tile uses its corresponding app logo", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  const sources = html.match(/<section id="sources"[\s\S]*?<\/section>/)?.[0];
  assert.ok(sources);
  const actual = [...sources.matchAll(/<img src="images\/logos\/([^"]+)"[^>]*\/>/g)]
    .map((match) => ({
      file: match[1],
      alt: match[0].match(/\balt="([^"]*)"/)?.[1],
      width: match[0].match(/\bwidth="([^"]*)"/)?.[1],
      height: match[0].match(/\bheight="([^"]*)"/)?.[1],
    }));
  assert.deepEqual(actual.map(({ file }) => file), [
    "binance-logo.svg", "okex-logo.svg", "bitget-logo.svg", "kraken-logo.svg",
    "gate-logo.svg", "coinbase-logo.png", "bybit-logo.svg", "htx-logo.svg",
    "mexc-logo.svg", "backpack-logo.svg", "ibkr-logo.svg", "btc-logo.svg",
    "eth-logo.svg", "binance-logo.svg", "sol-logo.svg", "doge-logo.svg",
    "ton-logo.svg", "sui-logo.svg", "eth-logo.svg", "tron-logo.svg",
  ]);
  for (const { file, alt, width, height } of actual) {
    assert.ok(existsSync(new URL(file, logoDir)), file);
    assert.equal(alt, "", `${file}: decorative image has a visible label`);
    assert.equal(width, "32", file);
    assert.equal(height, "32", file);
  }
  assert.equal(readdirSync(logoDir).filter((file) => file.endsWith("-symbol.svg")).length, 0);
});

test("copied SVGs retain the app asset bytes", () => {
  for (const file of sourceFiles.filter((name) => name.endsWith(".svg"))) {
    const siteBytes = readFileSync(new URL(file, logoDir));
    const appFile = new URL(file, app);
    const expected = existsSync(appFile) ? hash(readFileSync(appFile)) : manifest[file];
    assert.equal(hash(siteBytes), expected, file);
    assert.equal(manifest[file], expected, `${file}: manifest differs from app asset`);
  }
});

test("all page logo references are local and exist", () => {
  const pages = [
    ...readdirSync(root).filter((name) => name.endsWith(".html")),
    ...readdirSync(new URL("docs/", root)).filter((name) => name.endsWith(".html")).map((name) => `docs/${name}`),
  ];
  for (const page of pages) {
    const html = readFileSync(new URL(page, root), "utf8");
    for (const match of html.matchAll(/\bsrc="([^"]*logos\/[^"]+)"/g)) {
      assert.ok(!/^https?:/.test(match[1]), `${page}: remote logo`);
      assert.ok(existsSync(new URL(match[1], new URL(page, root))), `${page}: ${match[1]}`);
    }
  }
});

test("source logo styles never recolor or mask the artwork", () => {
  const css = readFileSync(new URL("site.css", root), "utf8");
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    if (!rule[1].includes(".source-grid")) continue;
    assert.doesNotMatch(rule[2], /\b(?:filter|mask(?:-image)?)\s*:/, rule[1]);
  }
});

test("source chips display original colors at the same size in both themes", async () => {
  const browser = await chromium.launch();
  try {
    for (const colorScheme of ["dark", "light"]) {
      for (const width of [1440, 1024, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme });
        let external = 0;
        await page.route(/^https?:\/\//, (route) => { external++; return route.abort(); });
        await page.goto(new URL("index.html", root).href);
        const chips = await page.locator(".source-grid li").evaluateAll((tiles) => tiles.map((tile) => {
          const img = tile.querySelector("img");
          const rect = img.getBoundingClientRect();
          const style = getComputedStyle(img);
          return {
            label: tile.textContent.trim(), width: rect.width, height: rect.height,
            tileWidth: tile.getBoundingClientRect().width,
            tileHeight: tile.getBoundingClientRect().height,
            background: style.backgroundColor, border: style.borderWidth,
            radius: style.borderRadius, padding: style.padding, fit: style.objectFit,
            filter: style.filter, mask: style.maskImage, complete: img.complete && img.naturalWidth > 0,
          };
        }));
        assert.equal(chips.length, 20);
        assert.ok(chips.every((chip) =>
          chip.label && chip.complete && chip.width === 32 && chip.height === 32 &&
          chip.background === "rgb(255, 255, 255)" && chip.border === "1px" &&
          chip.radius === "6px" && chip.padding === "4px" &&
          chip.fit === "contain" && chip.filter === "none" && chip.mask === "none"
        ), `${colorScheme} ${width}: ${JSON.stringify(chips)}`);
        assert.equal(new Set(chips.map(({ tileWidth, tileHeight }) => `${tileWidth}x${tileHeight}`)).size, 1);
        assert.equal(external, 0);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test("Coinbase PNG keeps the app JPEG's decoded pixels", async () => {
  const siteBytes = readFileSync(new URL("coinbase-logo.png", logoDir));
  assert.equal(hash(siteBytes), manifest["coinbase-logo.png"].site);
  const appFile = new URL("coinbase-logo.jpg", app);
  if (!existsSync(appFile)) return;
  const appBytes = readFileSync(appFile);
  assert.equal(hash(appBytes), manifest["coinbase-logo.png"].app);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const same = await page.evaluate(async ([jpeg, png]) => {
      const pixels = async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return [...context.getImageData(0, 0, canvas.width, canvas.height).data];
      };
      const original = await pixels(`data:image/jpeg;base64,${jpeg}`);
      const converted = await pixels(`data:image/png;base64,${png}`);
      return original.length === converted.length && original.every((value, index) => value === converted[index]);
    }, [appBytes.toString("base64"), siteBytes.toString("base64")]);
    assert.ok(same);
  } finally {
    await browser.close();
  }
});
