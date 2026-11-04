import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const root = new URL(".", import.meta.url);
const pages = [
  ...readdirSync(root).filter((file) => file.endsWith(".html") && !file.startsWith("google")),
  ...readdirSync(new URL("docs/", root)).filter((file) => file.endsWith(".html")).map((file) => `docs/${file}`),
];
const read = (file) => readFileSync(new URL(file, root), "utf8");

test("home primary actions share the Download label", () => {
  const html = read("index.html");
  const labels = [...html.matchAll(/<a\b[^>]*class="btn primary"[^>]*>([\s\S]*?)<\/a\s*>/g)]
    .map(([, label]) => label.replace(/<[^>]+>/g, "").trim());
  assert.deepEqual(labels, ["Download", "Download", "Download"]);
});

test("home links to the full privacy notice", () => {
  assert.match(read("index.html"), /href="https:\/\/github\.com\/domechn\/track3\/blob\/master\/README\.md#notice"/);
});

test("every footer links to the source license", () => {
  for (const file of pages) {
    const footer = read(file).match(/<footer\b[\s\S]*?<\/footer>/i)?.[0];
    assert.ok(footer, `${file}: footer`);
    assert.match(footer, /href="https:\/\/github\.com\/domechn\/track3\/blob\/master\/LICENSE"[^>]*>License<\/a>/, file);
  }
});

test("every footer links the source claim to the repository", () => {
  for (const file of pages) {
    const footer = read(file).match(/<footer\b[\s\S]*?<\/footer>/i)?.[0];
    assert.match(footer, /href="https:\/\/github\.com\/domechn\/track3"[^>]*>Source available<\/a>/, file);
  }
});

test("pages make no third-party font or script requests", () => {
  for (const file of pages) {
    const html = read(file);
    for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      if (/^<script\b/i.test(tag) || /\brel="(?:stylesheet|preload|modulepreload)"/i.test(tag)) {
        assert.doesNotMatch(tag, /(?:src|href)="https?:\/\//i, `${file}: ${tag}`);
      }
    }
    assert.doesNotMatch(html, /(?:createElement\(['"]script['"]\)|static\.ads-twitter\.com)/i, file);
  }
  assert.doesNotMatch(read("site.css"), /url\(\s*['"]?https?:\/\//i);
});

test("every image has alt text and intrinsic dimensions", () => {
  for (const file of pages) {
    for (const [tag] of read(file).matchAll(/<img\b[^>]*>/gi)) {
      assert.match(tag, /\balt="[^"]*"/, `${file}: ${tag}`);
      assert.match(tag, /\bwidth="\d+"/, `${file}: ${tag}`);
      assert.match(tag, /\bheight="\d+"/, `${file}: ${tag}`);
    }
  }
});

test("social image exists and unreleased distribution claims are absent", () => {
  for (const file of pages) {
    const html = read(file);
    const image = html.match(/property="og:image"\s+content="https:\/\/track3\.dev\/([^"]+)"/);
    assert.ok(image, `${file}: og:image`);
    assert.ok(existsSync(new URL(image[1], root)), `${file}: ${image[1]}`);
    assert.doesNotMatch(html, /App Store|TestFlight|@\d+/i, file);
  }
});
