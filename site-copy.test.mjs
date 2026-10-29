import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL(".", import.meta.url);
const htmlFiles = [
  ...readdirSync(root).filter((file) => file.endsWith(".html")),
  ...readdirSync(new URL("docs/", root)).filter((file) => file.endsWith(".html")).map((file) => `docs/${file}`),
];
const read = (file) => readFileSync(new URL(file, root), "utf8");

test("HTML does not suggest unavailable mobile license entry or unsupported subscriptions", () => {
  for (const file of htmlFiles) {
    const html = read(file).replace(/\s+/g, " ");
    assert.doesNotMatch(html, /in-app subscriptions? (?:are|is) not supported/i, file);
    assert.doesNotMatch(html, /(?:desktop or |on )iPhone\/iPad/i, file);
    assert.doesNotMatch(html, /More → Settings → Pro and license/i, file);
  }
});

test("success page sends license holders to Pro license in the desktop app", () => {
  const html = read("success.html");
  assert.match(html, /Track3 desktop app/);
  assert.match(html, /Settings → System → Pro license/);
});

test("success page tells subscribers how to manage or cancel", () => {
  const html = read("success.html").replace(/\s+/g, " ");
  assert.match(html, /subscription[^.]*manage or cancel[^.]*desktop app/i);
  assert.doesNotMatch(html, /Subscriptions are also available in the desktop app/i);
});

test("home page identifies the desktop app for existing Pro keys", () => {
  const html = read("index.html").replace(/\s+/g, " ");
  assert.match(
    html,
    /Enter an existing Pro license key in the desktop app under Settings → System → Pro license/i,
  );
});

test("checkout pages do not pair mobile devices with license entry", () => {
  for (const file of ["success.html", "cancel.html"]) {
    for (const [, block] of read(file).matchAll(/<(?:p|li)\b[^>]*>([\s\S]*?)<\/(?:p|li)>/gi)) {
      const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      if (/\blicense\b/i.test(text)) {
        assert.doesNotMatch(text, /\b(?:iPhone|iPad)\b/i, file);
      }
    }
  }
});

test("HTML does not mention unreleased mobile distribution channels", () => {
  for (const file of htmlFiles) {
    const html = read(file).replace(/\s+/g, " ");
    assert.doesNotMatch(html, /App Store|TestFlight|AltStore|sideload/i, file);
  }
});
