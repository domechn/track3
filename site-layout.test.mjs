import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { chromium } from "playwright";

const pageUrl = new URL("index.html", import.meta.url).href;
let browser;

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open(width, colorScheme = "dark") {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme });
  await page.route(/^https?:\/\//, (route) => route.abort());
  await page.goto(pageUrl);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

function contrast(foreground, background) {
  const luminance = (color) => {
    const channels = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/)?.slice(1).map(Number);
    assert.ok(channels, `opaque RGB color expected: ${color}`);
    const [r, g, b] = channels.map((n) => {
      const value = n / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("source chips render at 32px and each group has equal tiles", async () => {
  for (const width of [1440, 390]) {
    const page = await open(width);
    await page.locator(".source-grid img").evaluateAll((images) => Promise.all(images.map((img) => {
      img.loading = "eager";
      return img.decode();
    })));
    const groups = await page.locator(".source-grid").evaluateAll((lists) => lists.map((list) => ({
      logos: [...list.querySelectorAll("img")].map((img) => {
        const rect = img.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
      tileSizes: [...list.children].map((tile) => {
        const rect = tile.getBoundingClientRect();
        return [rect.width, rect.height];
      }),
    })));
    assert.equal(groups.length, 2);
    for (const group of groups) {
      assert.ok(group.logos.every(({ width, height }) => width === 32 && height === 32), `${width}: icon boxes ${JSON.stringify(group.logos)}`);
      assert.ok(group.tileSizes.every(([w, h]) => w === group.tileSizes[0][0] && h === group.tileSizes[0][1]), `${width}: tile sizes ${JSON.stringify(group.tileSizes)}`);
    }
    await page.close();
  }
});

test("desktop screenshots scroll inside the mobile viewport without page overflow", async () => {
  for (const colorScheme of ["dark", "light"]) {
    for (const width of [390, 768, 1024]) {
      const page = await open(width, colorScheme);
      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
        previews: [...document.querySelectorAll(".screen-strip")].map((strip) => ({
          width: strip.clientWidth,
          content: strip.scrollWidth,
          focusable: strip.tabIndex >= 0,
        })),
      }));
      assert.equal(metrics.page, metrics.viewport, `${width} ${colorScheme}: horizontal overflow`);
      if (width === 390) {
        assert.equal(metrics.previews.length, 4);
        assert.ok(metrics.previews.every(({ width: viewport, content, focusable }) => content >= 900 && content > viewport && focusable), `${colorScheme}: mobile previews ${JSON.stringify(metrics.previews)}`);
      } else {
        assert.ok(metrics.previews.every(({ focusable }) => !focusable), `${colorScheme}: desktop previews should be skipped by Tab`);
      }
      await page.close();
    }
  }
});

test("mobile screenshot strips can be focused without JavaScript", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, javaScriptEnabled: false });
  await page.goto(pageUrl);
  const strips = await page.locator(".screen-strip").evaluateAll((elements) => elements.map((el) => ({
    focusable: el.tabIndex === 0,
    scrollable: el.scrollWidth > el.clientWidth,
  })));
  assert.equal(strips.length, 4);
  assert.ok(strips.every(({ focusable, scrollable }) => focusable && scrollable), JSON.stringify(strips));
  await page.close();
});

test("desktop screenshot labels do not announce scrolling", async () => {
  for (const javaScriptEnabled of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, javaScriptEnabled });
    await page.goto(pageUrl);
    const labels = await page.locator(".screen-strip").evaluateAll((elements) => elements.map((el) => el.getAttribute("aria-label")));
    assert.equal(labels.length, 4);
    assert.ok(labels.every((label) => label && !label.includes("Scroll to explore")), `${javaScriptEnabled}: ${JSON.stringify(labels)}`);
    await page.close();
  }
});

test("hero bleed stays inside the page with visible scrollbars", async () => {
  const shownBrowser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  try {
    for (const width of [1280, 1366, 1440, 1920]) {
      const page = await shownBrowser.newPage({ viewport: { width, height: 900 } });
      await page.route(/^https?:\/\//, (route) => route.abort());
      await page.goto(pageUrl);
      const { pageWidth, visibleWidth } = await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        visibleWidth: document.documentElement.clientWidth,
      }));
      assert.equal(pageWidth, visibleWidth, `${width}: horizontal page overflow`);
      await page.close();
    }
  } finally {
    await shownBrowser.close();
  }
});

test("every mobile screenshot strip has a visible keyboard focus ring", async () => {
  const page = await open(390);
  for (const strip of await page.locator(".screen-strip").all()) {
    await strip.evaluate((el) => {
      el.scrollIntoView({ block: "center", behavior: "instant" });
      el.focus({ preventScroll: true });
    });
    const { x, y, color, visible } = await strip.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top - 5),
        color: getComputedStyle(el).outlineColor,
        visible: el.matches(":focus-visible"),
      };
    });
    assert.ok(visible);
    const screenshot = await page.screenshot();
    const pixel = await page.evaluate(async ({ data, x, y }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      context.drawImage(image, -x, -y);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }, { data: screenshot.toString("base64"), x, y });
    assert.equal(`rgb(${pixel.join(", ")})`, color, `focus ring hidden on ${await strip.getAttribute("aria-label")}`);
  }
  await page.close();
});

test("the hero screenshot exposes its scroll label as a group", async () => {
  const page = await open(390);
  assert.equal(await page.getByRole("group", { name: "Scroll to explore the Track3 Overview screenshot" }).count(), 1);
  await page.close();
});

test("hero uses a balanced grid and keeps its capture inside the content grid", async () => {
  const page = await open(1440);
  const metrics = await page.evaluate(() => {
    const grid = getComputedStyle(document.querySelector(".hero-grid")).gridTemplateColumns.split(" ").map(parseFloat);
    return {
      copyShare: grid[0] / (grid[0] + grid[1]),
      imageWidth: document.querySelector(".shot img").getBoundingClientRect().width,
    };
  });
  assert.ok(metrics.copyShare >= 0.4 && metrics.copyShare <= 0.43, `hero copy share ${metrics.copyShare}`);
  assert.ok(metrics.imageWidth >= 700, `hero image width ${metrics.imageWidth}px`);
  await page.close();
});

test("hero capture does not overlap the copy at desktop widths", async () => {
  for (const width of [1280, 1366, 1440]) {
    const page = await open(width);
    const { textRight, imageLeft } = await page.evaluate(() => ({
      textRight: document.querySelector(".hero .lead").getBoundingClientRect().right,
      imageLeft: document.querySelector(".shot img").getBoundingClientRect().left,
    }));
    assert.ok(textRight <= imageLeft, `${width}: text ends at ${textRight}, image starts at ${imageLeft}`);
    await page.close();
  }
});

test("primary action and Pro pill have AA text contrast from their color tokens", async () => {
  for (const colorScheme of ["dark", "light"]) {
    const page = await open(1440, colorScheme);
    const styles = await page.evaluate(() => {
      const tokens = getComputedStyle(document.documentElement);
      const tokenColor = (name) => {
        const probe = document.createElement("span");
        probe.style.color = `hsl(${tokens.getPropertyValue(name).trim()})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      const action = getComputedStyle(document.querySelector(".hero .btn.primary"));
      const nav = getComputedStyle(document.querySelector("header .btn.primary"));
      const pro = getComputedStyle(document.querySelector(".source-grid small"));
      return {
        tokens: {
          action: tokenColor("--accent-action"),
          onAction: tokenColor("--on-accent-action"),
          pro: tokenColor("--surface-2"),
          onPro: tokenColor("--foreground"),
        },
        action: { foreground: action.color, background: action.backgroundColor, fontSize: action.fontSize, height: document.querySelector(".hero .btn.primary").getBoundingClientRect().height },
        nav: { foreground: nav.color, background: nav.backgroundColor },
        pro: { foreground: pro.color, background: pro.backgroundColor, fontSize: pro.fontSize },
      };
    });
    assert.equal(styles.action.background, styles.tokens.action, `${colorScheme}: primary background token`);
    assert.equal(styles.action.foreground, styles.tokens.onAction, `${colorScheme}: primary text token`);
    assert.ok(contrast(styles.tokens.onAction, styles.tokens.action) >= 4.5, `${colorScheme}: primary action contrast`);
    assert.deepEqual(styles.nav, { foreground: styles.action.foreground, background: styles.action.background }, `${colorScheme}: nav action differs`);
    assert.ok(parseFloat(styles.action.fontSize) >= 16 && styles.action.height >= 48, `${colorScheme}: primary action size`);
    assert.equal(styles.pro.background, styles.tokens.pro, `${colorScheme}: Pro background token`);
    assert.equal(styles.pro.foreground, styles.tokens.onPro, `${colorScheme}: Pro text token`);
    assert.ok(contrast(styles.tokens.onPro, styles.tokens.pro) >= 4.5, `${colorScheme}: Pro contrast`);
    assert.ok(parseFloat(styles.pro.fontSize) >= 12, `${colorScheme}: Pro font size`);
    await page.close();
  }
});

test("device brands retain their casing in kickers on every page", async () => {
  const pages = [
    ...readdirSync(new URL(".", import.meta.url)).filter((file) => file.endsWith(".html") && !file.startsWith("google")),
    ...readdirSync(new URL("docs/", import.meta.url)).filter((file) => file.endsWith(".html")).map((file) => `docs/${file}`),
  ];
  for (const file of pages) {
    const page = await browser.newPage();
    await page.goto(new URL(file, import.meta.url).href);
    const brands = await page.locator(".kicker").evaluateAll((elements) => elements.flatMap((el) => {
      const match = el.textContent.match(/\bios\b|\biphone\b|\bipad\b/gi);
      if (!match) return [];
      return [{
        names: match,
        spans: [...el.querySelectorAll("span")].map((span) => ({
          text: span.textContent,
          transform: getComputedStyle(span).textTransform,
        })),
      }];
    }));
    for (const { names, spans } of brands) {
      for (const name of names) assert.equal(name, { ios: "iOS", iphone: "iPhone", ipad: "iPad" }[name.toLowerCase()], `${file}: brand spelling`);
      assert.equal(spans.map(({ text }) => text).join(" & "), names.join(" & "), `${file}: wrapped brand names`);
      assert.ok(spans.every(({ transform }) => transform === "none"), `${file}: brand casing`);
    }
    if (file === "index.html" || file === "download.html") assert.equal(brands.length, 1, file);
    await page.close();
  }
});

test("feature captures fade into frames that follow the system theme", async () => {
  for (const colorScheme of ["light", "dark"]) {
    const page = await open(1440, colorScheme);
    for (const name of ["Cost basis", "Rebalance"]) {
      const frame = page.getByRole("group", { name: `Track3 ${name} screenshot` });
      const screenshot = await frame.screenshot();
      const rgb = await page.evaluate(async (data) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        context.drawImage(image, -Math.floor(image.width / 2), -(image.height - 4));
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      }, screenshot.toString("base64"));
      assert.ok(rgb.every((channel) => colorScheme === "light" ? channel >= 225 : channel <= 35), `${colorScheme} ${name}: bottom pixel ${rgb}`);
    }
    await page.close();
  }
});

test("OKX and Bybit logo tiles show each name once", async () => {
  const page = await open(1440);
  for (const name of ["OKX", "Bybit"]) {
    const tile = page.locator(".source-grid li").filter({ has: page.locator(`img[src$="${name === "OKX" ? "okex" : "bybit"}-logo.svg"]`) });
    assert.equal(await tile.evaluate((el) => el.textContent.trim()), name);
    assert.equal(await tile.locator("img").getAttribute("alt"), "");
  }
  await page.close();
});

test("privacy disclosure has one marker", async () => {
  const page = await open(1440);
  const arrow = await page.locator(".privacy-details summary").evaluate((el) => getComputedStyle(el, "::after").content);
  assert.equal(arrow, "none");
  await page.close();
});

test("core views use distinct captures in each system scheme", async () => {
  for (const colorScheme of ["dark", "light"]) {
    const page = await open(1440, colorScheme);
    const images = await page.evaluate(() => {
      const visible = (shot) => [...shot.querySelectorAll("img")].find((image) => getComputedStyle(image).display !== "none");
      const [hero, summary, cost, rebalance] = [...document.querySelectorAll(".desktop-preview .theme-shot")].map(visible);
      return {
        hero: hero.currentSrc,
        summary: summary.currentSrc,
        cost: cost.currentSrc,
        rebalance: rebalance.currentSrc,
        summaryAlt: summary.alt,
      };
    });
    assert.match(images.hero, new RegExp(`overview-${colorScheme}\\.webp$`));
    assert.match(images.summary, new RegExp(`profit-${colorScheme}\\.webp$`));
    assert.match(images.cost, new RegExp(`cost-basis-${colorScheme}\\.webp$`));
    assert.match(images.rebalance, new RegExp(`rebalance-${colorScheme}\\.webp$`));
    assert.equal(new Set([images.hero, images.summary, images.cost, images.rebalance]).size, 4);
    assert.match(images.summaryAlt, /Summary.*profit/i);
    await page.close();
  }
});

test("light desktop captures have light navigation rails and matching content density", async () => {
  const page = await browser.newPage();
  for (const name of ["overview", "profit", "cost-basis", "rebalance"]) {
    const light = readFileSync(new URL(`images/desktop/${name}-light.webp`, import.meta.url));
    const rail = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/webp;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return [...context.getImageData(24, 200, 1, 1).data].slice(0, 3);
    }, light.toString("base64"));
    assert.ok(rail.every((channel) => channel >= 220), `${name}: dark rail ${rail}`);
    const darkSize = statSync(new URL(`images/desktop/${name}-dark.webp`, import.meta.url)).size;
    assert.ok(light.length / darkSize >= 0.75 && light.length / darkSize <= 1.25,
      `${name}: light/dark size ratio ${(light.length / darkSize).toFixed(2)}`);
  }
  await page.close();
});
