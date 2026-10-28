import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL(".", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

test("GitHub Pages uses the new domain", () => {
  assert.equal(read("CNAME"), "track3.dev");
});

test("page metadata uses the new domain", () => {
  for (const [file, path] of [
    ["index.html", "/"],
    ["download.html", "/download.html"],
    ["success.html", "/success.html"],
    ["cancel.html", "/cancel.html"],
  ]) {
    const html = read(file);
    const url = `https://track3.dev${path}`;
    assert.ok(html.includes(`property="og:url" content="${url}"`), file);
    assert.ok(html.includes(`rel="canonical" href="${url}"`), file);
    assert.match(
      html,
      /property="og:image"\s+content="https:\/\/track3\.dev\/images\/social-overview\.jpg"/,
      file,
    );
    assert.match(
      html,
      /name="twitter:image"\s+content="https:\/\/track3\.dev\/images\/social-overview\.jpg"/,
      file,
    );
  }
});

test("checkout status uses the new API domain", () => {
  assert.ok(
    read("success.html").includes(
      '"https://api.track3.dev/api/stripe?action=checkout-status&session_id="',
    ),
  );
});

test("no HTML file contains the previous domain", () => {
  // Google's verification token is plain text, not a site page.
  const htmlFiles = readdirSync(root).filter(
    (file) => file.endsWith(".html") && file !== "google4935d9759bd7d76d.html",
  );
  const previousDomain = ["domc", "me"].join(".");
  assert.ok(htmlFiles.length > 0);
  for (const file of htmlFiles) {
    assert.ok(!read(file).includes(previousDomain), file);
  }
});

test("Google Search Console verification file has the exact token", () => {
  assert.equal(
    read("google4935d9759bd7d76d.html"),
    "google-site-verification: google4935d9759bd7d76d.html\n",
  );
});
