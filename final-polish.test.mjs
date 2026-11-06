import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const url = new URL("index.html", import.meta.url).href;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open(width, scheme = "dark", forced) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme });
  await page.route(/^https?:\/\//, route => route.abort());
  if (forced) await page.addInitScript(value => localStorage.setItem("track3-theme", value), forced);
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

function contrast(fg, bg) {
  const l = color => {
    const rgb = color.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number).map(v => {
      v /= 255;
      return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    });
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const a = l(fg), b = l(bg);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test("source tiles have labelled, equal 20px neutral icons", async () => {
  for (const scheme of ["dark", "light"]) {
    const page = await open(1440, scheme);
    const tiles = await page.locator(".source-grid li").evaluateAll(items => items.map(tile => {
      const icon = tile.querySelector("img, svg");
      const rect = icon.getBoundingClientRect();
      return { label: tile.textContent.trim(), alt: icon.getAttribute("alt"), width: rect.width, height: rect.height, filter: getComputedStyle(icon).filter };
    }));
    assert.equal(tiles.length, 20);
    assert.ok(tiles.every(t => t.label && t.alt === "" && t.width === 20 && t.height === 20), JSON.stringify(tiles));
    assert.equal(new Set(tiles.map(t => t.filter)).size, 1, `${scheme}: different icon filters`);
    await page.close();
  }
});

test("source icons are decoded before the source section is opened", async () => {
  const page = await open(390);
  const readiness = await page.locator(".source-grid img").evaluateAll(images => images.map(img => ({
    complete: img.complete,
    width: img.naturalWidth,
  })));
  assert.ok(readiness.every(image => image.complete && image.width > 0), JSON.stringify(readiness));
  await page.close();
});

test("source symbols occupy comparable area inside their boxes", async () => {
  const page = await open(1440);
  const files = [...new Set(await page.locator(".source-grid img").evaluateAll(images => images.map(img => img.getAttribute("src"))))];
  for (const file of files) {
    const mime = file.endsWith(".png") ? "image/png" : "image/svg+xml";
    const data = `data:${mime};base64,${readFileSync(new URL(file, import.meta.url)).toString("base64")}`;
    const box = await page.evaluate(async source => {
      const img = new Image();
      img.src = source;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 20;
      const context = canvas.getContext("2d");
      const scale = Math.min(20 / img.naturalWidth, 20 / img.naturalHeight);
      const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
      context.drawImage(img, (20 - width) / 2, (20 - height) / 2, width, height);
      const pixels = context.getImageData(0, 0, 20, 20).data;
      let minX = 20, maxX = -1, minY = 20, maxY = -1;
      for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
        if (pixels[(y * 20 + x) * 4 + 3] < 128) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      return { width: maxX - minX + 1, height: maxY - minY + 1, innerCurve: pixels[(9 * 20 + 8) * 4 + 3] };
    }, data);
    assert.ok(box.width >= 12 && box.height >= 12, `${file}: ${JSON.stringify(box)}`);
    if (file.endsWith("coinbase-logo.png")) assert.ok(box.width >= 17 && box.height >= 17, `${file}: ${JSON.stringify(box)}`);
    if (file.endsWith("sui-symbol.svg")) assert.ok(box.innerCurve >= 128, `${file}: missing inner curve`);
  }
  await page.close();
});

test("app icon is touch-sized and has transparent corners", async () => {
  const page = await open(390);
  const data = readFileSync(new URL("images/app-icon.png", import.meta.url)).toString("base64");
  const icon = await page.evaluate(async base64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return { width: image.naturalWidth, height: image.naturalHeight, cornerAlpha: context.getImageData(0, 0, 1, 1).data[3] };
  }, data);
  assert.ok(icon.width >= 180 && icon.height >= 180, JSON.stringify(icon));
  assert.equal(icon.cornerAlpha, 0);
  await page.close();
});

test("hero copy has 48px gutter and capture ends at the content edge", async () => {
  for (const width of [1280, 1440, 1920]) {
    const page = await open(width);
    const m = await page.evaluate(() => {
      const copy = document.querySelector(".hero-copy").getBoundingClientRect();
      const shot = document.querySelector(".hero .shot").getBoundingClientRect();
      const wrap = document.querySelector(".hero .wrap");
      const right = wrap.getBoundingClientRect().right - parseFloat(getComputedStyle(wrap).paddingRight);
      return { gutter: shot.left - copy.right, shotRight: shot.right, gridRight: right, mask: getComputedStyle(document.querySelector(".hero .shot img")).maskImage };
    });
    assert.ok(m.gutter >= 48, `${width}: gutter ${m.gutter}`);
    assert.ok(m.shotRight <= m.gridRight + 1, `${width}: screenshot clipped at ${m.shotRight}, grid ${m.gridRight}`);
    assert.match(m.mask, /120px/);
    await page.close();
  }
});

test("header controls are 44px with current theme icon, tooltip, and contrasted borders", async () => {
  for (const [scheme, forced, expected] of [["dark", null, "Auto"], ["dark", "light", "Light"], ["light", "dark", "Dark"], ["light", null, "Auto"]]) {
    const page = await open(390, scheme, forced);
    const m = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const rect = el => el.getBoundingClientRect();
      const controls = [q(".mobile-menu summary"), q(".theme-control"), q("header .btn")];
      return {
        heights: controls.map(el => rect(el).height),
        gaps: [rect(controls[1]).left - rect(controls[0]).right, rect(controls[2]).left - rect(controls[1]).right],
        icon: [...q(".theme-control").querySelectorAll(".theme-icon")].filter(el => getComputedStyle(el).display !== "none").map(el => el.classList[1]),
        title: q(".theme-control").title,
        label: q(".theme-control").getAttribute("aria-label"),
        menuIcon: !!q(".mobile-menu summary svg"),
        border: getComputedStyle(q(".theme-control")).borderTopColor,
        background: getComputedStyle(q(".theme-control")).backgroundColor,
        borders: controls.map(el => getComputedStyle(el).borderTopColor),
        pageBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    assert.deepEqual(m.heights, [44, 44, 44]);
    assert.ok(Math.abs(m.gaps[0] - m.gaps[1]) <= 1, JSON.stringify(m.gaps));
    assert.deepEqual(m.icon, [`theme-icon--${expected.toLowerCase()}`]);
    assert.equal(m.title, `Theme: ${expected}`);
    assert.equal(m.label, `Theme: ${expected}`);
    assert.ok(m.menuIcon);
    assert.ok(contrast(m.border, m.background) >= 3, `${scheme}/${forced}: border ${m.border} on ${m.background}`);
    assert.ok(m.borders.every(color => contrast(color, m.pageBackground) >= 3), `${scheme}/${forced}: header borders ${m.borders}`);
    await page.close();
  }
});

test("mobile strips reach the right edge and swipe captions are legible", async () => {
  for (const scheme of ["dark", "light"]) {
    const page = await open(390, scheme);
    const m = await page.evaluate(() => ({
      skipBottom: document.querySelector(".skip-link").getBoundingClientRect().bottom,
      strips: [...document.querySelectorAll(".desktop-preview")].map(preview => {
        const strip = preview.querySelector(".screen-strip");
        const hint = preview.querySelector(".swipe-hint");
        return {
          right: strip.getBoundingClientRect().right,
          scrollable: strip.scrollWidth > strip.clientWidth,
          size: parseFloat(getComputedStyle(hint).fontSize),
          fg: getComputedStyle(hint).color,
          bg: getComputedStyle(document.body).backgroundColor,
        };
      }),
    }));
    assert.ok(m.skipBottom <= 0, `skip link visible at ${m.skipBottom}`);
    assert.ok(m.strips.every(s => Math.abs(s.right - 390) <= 1 && s.scrollable && s.size >= 13 && contrast(s.fg, s.bg) >= 4.5), JSON.stringify(m.strips));
    await page.close();
  }
});

test("pricing inclusion card fills the width beneath equal price cards", async () => {
  const page = await open(1440);
  const cards = await page.locator(".plans .card").evaluateAll(items => items.map(item => {
    const r = item.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
  }));
  assert.equal(cards[0].height, cards[1].height);
  assert.ok(cards[2].top > cards[0].bottom);
  assert.ok(Math.abs(cards[2].left - cards[0].left) <= 1);
  assert.ok(Math.abs(cards[2].right - cards[1].right) <= 1);
  await page.close();
});

test("Pro inclusions use the available card width without crowding mobile", async () => {
  for (const width of [1440, 1024, 390]) {
    const page = await open(width);
    const tops = await page.locator(".limits li").evaluateAll(items => items.map(item => Math.round(item.getBoundingClientRect().top)));
    if (width === 390) assert.ok(tops[1] > tops[0], `${width}: mobile list is not stacked`);
    else assert.equal(tops[1], tops[0], `${width}: desktop card has an empty column`);
    await page.close();
  }
});

test("core screenshots share edges and copy starts at screenshot top", async () => {
  const page = await open(1440);
  const rows = await page.locator(".feature").evaluateAll(items => items.map(item => {
    const shot = item.querySelector(".screen").getBoundingClientRect();
    const copy = item.querySelector(".feature-copy").getBoundingClientRect();
    return { left: shot.left, right: shot.right, top: shot.top, copyTop: copy.top };
  }));
  assert.ok(rows.every(r => Math.abs(r.copyTop - r.top) <= 1), JSON.stringify(rows));
  assert.ok(rows.every(r => Math.abs(r.left - rows[0].left) <= 1 && Math.abs(r.right - rows[0].right) <= 1), JSON.stringify(rows));
  await page.close();
});

test("privacy phrase stays together and the GitHub link has a mobile target and underline", async () => {
  for (const width of [390, 768, 1440]) {
    const page = await open(width);
    const phrase = page.locator(".facts > div").nth(2).locator(".nowrap");
    const parts = await phrase.evaluate(p => {
      const node = p.firstChild, text = node.textContent, start = 0;
      if (text !== "end-to-end") throw new Error(`Unexpected phrase: ${text}`);
      const out = [];
      for (let i = start; i < start + 10; i++) {
        const range = document.createRange();
        range.setStart(node, i); range.setEnd(node, i + 1);
        out.push(range.getBoundingClientRect().top);
      }
      return out;
    });
    assert.equal(new Set(parts).size, 1, `${width}: end-to-end wraps`);
    assert.equal(await page.locator(".hero .meta span").textContent(), "·");
    const link = page.locator(".quiet-link");
    if (width === 390) assert.ok((await link.boundingBox()).height >= 44);
    await link.hover();
    assert.notEqual(await link.evaluate(el => getComputedStyle(el).textDecorationLine), "none");
    await link.focus();
    assert.notEqual(await link.evaluate(el => getComputedStyle(el).textDecorationLine), "none");
    await page.close();
  }
});

test("system and forced themes fit every review viewport without external requests", async () => {
  for (const width of [1440, 1024, 768, 390]) {
    for (const [scheme, forced] of [["dark", null], ["light", null], ["light", "dark"], ["dark", "light"]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: scheme });
      const external = [];
      page.on("request", request => {
        if (/^https?:\/\//.test(request.url())) external.push(request.url());
      });
      await page.route(/^https?:\/\//, route => route.abort());
      if (forced) await page.addInitScript(value => localStorage.setItem("track3-theme", value), forced);
      await page.goto(url);
      const m = await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        visibleShot: [...document.querySelectorAll(".hero .theme-shot img")].filter(img => getComputedStyle(img).display !== "none").map(img => img.className),
        headerTop: document.querySelector(".site-header").getBoundingClientRect().top,
        skipBottom: document.querySelector(".skip-link").getBoundingClientRect().bottom,
      }));
      assert.equal(m.pageWidth, m.viewport, `${width} ${scheme}/${forced}: page overflow`);
      assert.deepEqual(m.visibleShot, [`theme-image--${forced || scheme}`], `${width} ${scheme}/${forced}: visible hero`);
      assert.equal(m.headerTop, 0);
      assert.ok(m.skipBottom <= 0);
      assert.deepEqual(external, []);
      await page.close();
    }
  }
});
