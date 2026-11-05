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
  const tokens = (pattern) => {
    const match = css.match(pattern);
    assert.ok(match, `missing token block: ${pattern}`);
    return Object.fromEntries([...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map(([, key, value]) => [key, value.trim()]));
  };
  const dark = tokens(/:root\s*\{([^}]+)\}/);
  const light = tokens(/:root\[data-theme="light"\]\s*\{([^}]+)\}/);
  const skip = css.match(/\.skip-link\s*\{([^}]+)\}/)?.[1];
  assert.match(skip, /background:\s*hsl\(var\(--accent-data\)\)/);
  assert.match(skip, /color:\s*hsl\(var\(--accent-ink\)\)/);
  const luminance = (hsl) => {
    const [, hue, saturation, lightness] = hsl.match(/^(\d+) (\d+)% (\d+)%$/).map(Number);
    const a = saturation / 100 * Math.min(lightness / 100, 1 - lightness / 100);
    const channel = (n) => {
      const k = (n + hue / 30) % 12;
      const srgb = lightness / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    };
    return channel(0) * 0.2126 + channel(8) * 0.7152 + channel(4) * 0.0722;
  };
  for (const [theme, variables] of [["dark", dark], ["light", { ...dark, ...light }]]) {
    const foreground = luminance(variables["--accent-ink"]);
    const background = luminance(variables["--accent-data"]);
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
