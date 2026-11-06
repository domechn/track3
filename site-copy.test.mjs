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
    assert.doesNotMatch(html, /subscribe on this website/i, file);
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

test("home page explains desktop subscription and existing Pro keys", () => {
  const html = read("index.html").replace(/\s+/g, " ");
  assert.match(
    html,
    /Subscribe inside the desktop app: Settings → System → Subscribe\. Already have a licence key\? Enter it under Settings → System → Pro license\./,
  );
});

test("Pro prices and inclusions remain intact", () => {
  const pro = read("index.html").match(/<section id="pro"[\s\S]*?<\/section>/)?.[0];
  assert.ok(pro);
  assert.match(pro, /\$9\.99\s*<small>\/ month<\/small>/);
  assert.match(pro, /\$83\.99\s*<small>\/ year<\/small>/);
  assert.match(pro, /About 30% less than monthly\./);
  assert.match(pro, /Both plans include/);
});

test("checkout cancellation and download page point to an in-app subscription", () => {
  const cancel = read("cancel.html").replace(/\s+/g, " ");
  assert.match(cancel, /No charge was made\. You can subscribe any time in the desktop app under Settings → System → Subscribe\./);
  assert.match(cancel, /Settings → System → Pro license/);
  assert.match(read("download.html").replace(/\s+/g, " "), /Track3 is free\. Pro adds more chains and the assistant; subscribe inside the app\./);
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
