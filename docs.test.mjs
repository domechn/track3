import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL(".", import.meta.url);
const pages = ["docs/index.html", "docs/binance.html", "docs/okx.html"];
const read = (file) => readFileSync(new URL(file, root), "utf8");

test("exchange docs have one heading, page metadata, and a checked date", () => {
  for (const file of pages) {
    assert.ok(existsSync(new URL(file, root)), `${file} exists`);
    const html = read(file);
    const url = `https://track3.dev/${file}`;
    assert.equal([...html.matchAll(/<h1\b/gi)].length, 1, `${file} h1`);
    assert.match(html, /<title>[^<]+<\/title>/, file);
    assert.match(html, /<meta name="description" content="[^"]+" \/>/, file);
    assert.ok(html.includes(`rel="canonical" href="${url}"`), file);
    assert.ok(html.includes(`property="og:url" content="${url}"`), file);
    assert.match(html, /property="og:title" content="[^"]+"/, file);
    assert.match(html, /property="og:description" content="[^"]+"/, file);
    assert.match(html, /name="twitter:card" content="summary_large_image"/, file);
    assert.match(html, /name="twitter:title" content="[^"]+"/, file);
    assert.match(html, /name="twitter:description" content="[^"]+"/, file);
    assert.match(html, /name="twitter:image" content="https:\/\/track3\.dev\/images\/social-overview\.jpg"/, file);
    assert.match(html, /Last checked: 2026-10-29/, file);
    assert.match(html, /class="skip-link" href="#main"/, file);
  }
});

test("exchange docs links work locally and external links use HTTPS", () => {
  for (const file of pages) {
    const html = read(file);
    const pageUrl = new URL(`https://track3.dev/${file}`);
    for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
      const target = new URL(href, pageUrl);
      if (target.origin !== pageUrl.origin) {
        assert.equal(target.protocol, "https:", `${file}: ${href}`);
        continue;
      }
      const path = target.pathname === "/" ? "/index.html" : target.pathname;
      const targetFile = new URL(`.${path}`, root);
      assert.ok(existsSync(targetFile), `${file}: ${href}`);
      if (target.hash) {
        assert.ok(readFileSync(targetFile, "utf8").includes(`id="${decodeURIComponent(target.hash.slice(1))}"`), `${file}: ${href}`);
      }
    }
  }
});

test("docs skip link text has AA contrast in light and dark themes", () => {
  const css = read("site.css");
  const rule = (pattern) => {
    const match = css.match(pattern);
    assert.ok(match, `missing CSS rule: ${pattern}`);
    return Object.fromEntries([...match[1].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
  };
  const light = rule(/:root\s*\{([^}]+)\}/);
  const dark = rule(/@media \(prefers-color-scheme: dark\)\s*\{\s*\.docs-page\s*\{([^}]+)\}/);
  const skip = rule(/\.skip-link\s*\{([^}]+)\}/);
  const luminance = (value) => {
    let hex = value.replace("#", "");
    if (hex.length === 3) hex = [...hex].map((digit) => digit + digit).join("");
    assert.match(hex, /^[\da-f]{6}$/i);
    const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    return channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  };
  for (const [theme, variables] of [["light", light], ["dark", { ...light, ...dark }]]) {
    const resolve = (value) => value.startsWith("var(") ? variables[value.slice(4, -1)] : value;
    const foreground = luminance(resolve(skip.color));
    const background = luminance(resolve(skip.background));
    const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    assert.ok(contrast >= 4.5, `${theme} skip link contrast: ${contrast.toFixed(2)}:1`);
  }
});

test("exchange docs exclude old domain and unreleased distribution terms", () => {
  for (const file of pages) {
    const html = read(file);
    assert.doesNotMatch(html, /domc\.me/i, file);
    assert.doesNotMatch(html, /App Store|TestFlight|AltStore|sideload/i, file);
  }
});

test("home and download link to docs from desktop nav, mobile nav, and footer", () => {
  for (const file of ["index.html", "download.html"]) {
    const html = read(file);
    for (const area of ["nav", 'div class="menu-links"', "footer"]) {
      const start = html.indexOf(`<${area}`);
      assert.ok(start >= 0, `${file}: ${area}`);
      const end = html.indexOf(area === "footer" ? "</footer>" : area === "nav" ? "</nav>" : "</div>", start);
      assert.match(html.slice(start, end), /href="\.\/docs\/index\.html"[^>]*>Docs<\/a\s*>/, `${file}: ${area}`);
    }
  }
});
