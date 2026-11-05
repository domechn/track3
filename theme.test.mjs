import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "playwright";

const root = new URL(".", import.meta.url);
const pages = [
  ...readdirSync(root).filter((name) => name.endsWith(".html") && !name.startsWith("google")),
  ...readdirSync(new URL("docs/", root)).filter((name) => name.endsWith(".html")).map((name) => `docs/${name}`),
];
// Logo geometry: change LOGO_PATH here, then replace every copy; the test enforces this.
const LOGO_PATH = "M7 89 42 13l23 50-13 26H7Zm57-26 22-50 35 76H76L64 63Z";
let browser;
let server;
let origin;

before(async () => {
  server = createServer((request, response) => {
    const file = new URL(`.${decodeURIComponent(request.url.split("?")[0])}`, root);
    try {
      const content = readFileSync(file);
      const type = file.pathname.endsWith(".css") ? "text/css"
        : file.pathname.endsWith(".js") ? "text/javascript"
          : file.pathname.endsWith(".svg") ? "image/svg+xml"
            : file.pathname.endsWith(".webp") ? "image/webp"
              : file.pathname.endsWith(".woff2") ? "font/woff2" : "text/html";
      response.writeHead(200, { "Content-Type": type }).end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

async function open(file = "index.html", { saved, scheme = "dark", javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({ colorScheme: scheme, javaScriptEnabled, viewport: { width: 1440, height: 900 } });
  if (saved) await context.addInitScript((theme) => localStorage.setItem("track3-theme", theme), saved);
  const page = await context.newPage();
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(origin)) external.push(request.url());
  });
  await page.route(/^https?:\/\//, (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(new URL(file, origin).href);
  return { page, context, external };
}

test("each page starts in the saved theme and exposes the same theme control", async () => {
  for (const file of pages) {
    const { page, context, external } = await open(file, { saved: "light", scheme: "dark" });
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light", file);
    assert.equal(await page.locator(".theme-control").getAttribute("aria-label"), "Theme: light", file);
    assert.equal(await page.locator(".theme-control").getAttribute("aria-pressed"), null, file);
    assert.equal(await page.locator(".theme-control").isVisible(), true, file);
    assert.equal(await page.locator(".theme-control").evaluate((button) => Math.round(button.getBoundingClientRect().height)), 44, file);
    assert.equal(await page.locator('link[data-icon-theme="light"]').getAttribute("media"), "all", file);
    assert.equal(await page.locator('link[data-icon-theme="dark"]').getAttribute("media"), "not all", file);
    assert.equal(await page.locator('link[rel="icon"][type="image/png"]').getAttribute("href"),
      file.startsWith("docs/") ? "../images/app-icon.png" : "images/app-icon.png", file);
    assert.deepEqual(external, [], `${file}: external requests`);
    await context.close();
  }
});

test("saved theme is applied before the stylesheet request", async () => {
  const context = await browser.newContext({ colorScheme: "light" });
  await context.addInitScript(() => localStorage.setItem("track3-theme", "dark"));
  const page = await context.newPage();
  let themeAtStylesheet;
  await page.route("**/site.css", async (route) => {
    themeAtStylesheet = await page.locator("html").getAttribute("data-theme");
    await route.continue();
  });
  await page.goto(new URL("index.html", origin).href);
  assert.equal(themeAtStylesheet, "dark");
  await context.close();
});

test("inline header and footer marks render on every page", async () => {
  for (const file of pages) {
    const { page, context } = await open(file);
    const screenshot = await page.locator(".brand-mark").screenshot();
    const pixels = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, image.width, image.height).data;
      let filled = 0;
      for (let index = 3; index < rgba.length; index += 4) if (rgba[index]) filled++;
      return filled;
    }, screenshot.toString("base64"));
    assert.ok(pixels > 100, `${file}: blank logo`);
    assert.equal(await page.locator(".brand-mark use, .footer-mark use").count(), 0, `${file}: external mark reference`);
    assert.equal(await page.locator(".brand-mark path, .footer-mark path").count(), 2, `${file}: inline mark geometry`);
    await context.close();
  }
});

test("every inline and favicon mark uses the canonical logo geometry", async () => {
  for (const file of pages) {
    const { page, context } = await open(file);
    const paths = await page.locator(".brand-mark path, .footer-mark path").evaluateAll((marks) => marks.map((mark) => mark.getAttribute("d")));
    assert.deepEqual(paths, [LOGO_PATH, LOGO_PATH], file);
    await context.close();
  }
  for (const file of ["images/favicon-light.svg", "images/favicon-dark.svg"]) {
    const svg = readFileSync(new URL(file, root), "utf8");
    assert.equal(svg.match(/<path\b[^>]*\bd="([^"]+)"/)?.[1], LOGO_PATH, file);
  }
});

test("control cycles auto, light, dark, persists the single key, and restores auto", async () => {
  const { page, context } = await open();
  const control = page.locator(".theme-control");
  for (const [label, attribute, stored, visibleImage] of [
    ["Theme: auto", null, null, "dark"],
    ["Theme: light", "light", "light", "light"],
    ["Theme: dark", "dark", "dark", "dark"],
    ["Theme: auto", null, null, "dark"],
  ]) {
    assert.equal(await control.getAttribute("aria-label"), label);
    assert.equal(await control.getAttribute("aria-pressed"), null);
    assert.equal(await page.locator("html").getAttribute("data-theme"), attribute);
    assert.equal(await page.locator(".shot .theme-image--" + visibleImage).isVisible(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem("track3-theme")), stored);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), stored ? ["track3-theme"] : []);
    await control.click();
  }
  await context.close();
});

test("invalid saved choice falls back to system preference", async () => {
  const { page, context } = await open("index.html", { saved: "garbage", scheme: "light" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), null);
  assert.equal(await page.locator(".theme-control").getAttribute("aria-label"), "Theme: auto");
  assert.equal(await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor), "rgb(247, 247, 248)");
  await context.close();
});

test("theme script fits the 1 KB budget", () => {
  assert.ok(readFileSync(new URL("theme.js", root)).byteLength <= 1024);
});

test("without JavaScript, the control stays hidden and system colors and shots work", async () => {
  for (const scheme of ["light", "dark"]) {
    const { page, context } = await open("index.html", { scheme, javaScriptEnabled: false });
    assert.equal(await page.locator(".theme-control").isVisible(), false);
    assert.equal(await page.locator("html").getAttribute("data-theme"), null);
    assert.equal(await page.locator(".shot .theme-image--" + scheme).isVisible(), true);
    assert.equal(await page.locator(".shot .theme-image--" + (scheme === "light" ? "dark" : "light")).isVisible(), false);
    await context.close();
  }
});

test("every referenced CSS token resolves in forced light and dark and text contrast is AA", async () => {
  const css = readFileSync(new URL("site.css", root), "utf8");
  const tokens = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]))];
  const contrast = (foreground, background) => {
    const luminance = (rgb) => {
      const values = rgb.match(/\d+/g).slice(0, 3).map((n) => Number(n) / 255);
      const [r, g, b] = values.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  for (const saved of ["light", "dark"]) {
    const { page, context } = await open("index.html", { saved, scheme: saved === "light" ? "dark" : "light" });
    const values = await page.evaluate((names) => {
      const rootStyle = getComputedStyle(document.querySelector(".hero-preview"));
      const body = getComputedStyle(document.body);
      const action = getComputedStyle(document.querySelector(".hero .btn.primary"));
      const lead = getComputedStyle(document.querySelector(".hero .lead"));
      return {
        missing: names.filter((name) => !rootStyle.getPropertyValue(name).trim()),
        body: [body.color, body.backgroundColor],
        lead: [lead.color, body.backgroundColor],
        action: [action.color, action.backgroundColor],
      };
    }, tokens);
    assert.deepEqual(values.missing, [], `${saved}: missing tokens`);
    for (const [name, pair] of Object.entries(values).filter(([name]) => name !== "missing")) {
      assert.ok(contrast(...pair) >= 4.5, `${saved}: ${name} contrast ${contrast(...pair)}`);
    }
    await context.close();
  }
});

test("forced and system light define the same complete color tokens", () => {
  const css = readFileSync(new URL("site.css", root), "utf8");
  const tokens = (selector) => {
    const block = css.match(selector)?.[1];
    assert.ok(block, `missing color block: ${selector}`);
    return Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
      .map(([, name, value]) => [name, value.trim()]));
  };
  const dark = tokens(/:root\s*\{([^}]+)\}/);
  const system = tokens(/@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([^}]+)\}/);
  const forced = tokens(/:root\[data-theme="light"\]\s*\{([^}]+)\}/);
  assert.deepEqual(system, forced);
  assert.deepEqual(Object.keys(forced).sort(), Object.entries(dark)
    .filter(([, value]) => /^\d+\s+\d+%\s+\d+%$/.test(value)).map(([name]) => name).sort());
});

test("the visible hero has eager high priority in each resolved theme", async () => {
  for (const [saved, scheme, visible] of [
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
    [undefined, "light", "light"],
    [undefined, "dark", "dark"],
  ]) {
    const { page, context } = await open("index.html", { saved, scheme });
    const images = await page.locator(".hero-preview img").evaluateAll((items) => items.map((image) => ({
      theme: image.className.split("--")[1],
      loading: image.loading,
      priority: image.fetchPriority,
    })));
    assert.deepEqual(images.find((image) => image.theme === visible),
      { theme: visible, loading: "eager", priority: "high" });
    assert.deepEqual(images.find((image) => image.theme !== visible),
      { theme: visible === "light" ? "dark" : "light", loading: "lazy", priority: "low" });
    await context.close();
  }
});

test("only the chosen screenshot variant is requested, including below the fold", async () => {
  for (const [saved, scheme, expected] of [
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
    [undefined, "light", "light"],
    [undefined, "dark", "dark"],
  ]) {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
    if (saved) await context.addInitScript((theme) => localStorage.setItem("track3-theme", theme), saved);
    const page = await context.newPage();
    const requests = [];
    const failed = [];
    const external = [];
    page.on("request", (request) => {
      if (!request.url().startsWith(origin)) external.push(request.url());
      if (/images\/(?:desktop|ios)\//.test(request.url())) requests.push(request.url().split("/").pop());
    });
    page.on("response", (response) => {
      if (/images\/(?:desktop|ios)\//.test(response.url()) && !response.ok()) failed.push(response.url());
    });
    await page.route(/^https?:\/\//, (route) => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(new URL("index.html", origin).href);
    for (const shot of await page.locator(".theme-shot").all()) await shot.scrollIntoViewIfNeeded();
    await page.waitForLoadState("networkidle");
    const visible = await page.locator(".theme-shot").evaluateAll((shots) => shots.map((shot) => {
      const shown = [...shot.querySelectorAll("img")].filter((image) => getComputedStyle(image).display !== "none");
      return shown.map((image) => ({ name: image.getAttribute("src").split("/").pop(), loaded: image.complete && image.naturalWidth > 0 }));
    }));
    assert.ok(visible.every((images) => images.length === 1), `${expected}: ${JSON.stringify(visible)}`);
    assert.ok(visible.every((images) => images[0].loaded), `${expected}: unloaded images ${JSON.stringify(visible)}`);
    assert.deepEqual(failed, [], `${expected}: failed requests`);
    assert.deepEqual(external, [], `${expected}: external requests`);
    assert.deepEqual(new Set(requests), new Set(visible.flat().map((image) => image.name)), `${expected}: unexpected image requests`);
    assert.ok(requests.includes(expected === "light" ? "overview-light.webp" : "overview-dark.webp"), `${expected}: hero ${requests}`);
    for (const variant of ["overview", "profit", "cost-basis", "rebalance"]) {
      assert.ok(!requests.includes(`${variant}-${expected === "light" ? "dark" : "light"}.webp`), `${expected}: fetched hidden ${variant}: ${requests}`);
    }
    await context.close();
  }
});
