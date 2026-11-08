#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import postcss from "postcss";

const shellSelector = /\.(?:t3-desktop-rail|t3-fidelity-sidebar|t3-fidelity-rail(?:-[\w-]+)?|t3-fidelity-topbar(?:-[\w-]+)?|t3-fidelity-ranges|t3-fidelity-stamp|t3-topbar(?:-[\w-]+)?|t3-records-toolbar(?:-[\w-]+)?|t3-overview-heading|fidelity-records-rail(?:-[\w-]+)?|fidelity-chat-header(?:-[\w-]+)?|mobile-sidebar(?:-collapse)?|mobile-rail-[\w-]+|mobile-tab(?:-bar|-badge|-icon)?|mobile-topbar(?:-[\w-]+)?|mobile-sheet-handle|mobile-sheet-heading)(?![\w-])|#app-top-bar(?![\w-])|(?:^|[,\s>+~])(?:nav|aside|header)\b/;
const tagSelector = /\.(?:(?:[\w-]+-)?(?:badge|tag|chip|pill)(?:-[\w-]+)?|fd-header-alerts)(?![\w-])|\.coin-fidelity-heading\s+h1\s+b\b/;
const rawColor = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(\s*(?:\d|\.)|\b(?:white|black)\b/i;
const rawUtility = /\b(?:bg|text|border|ring|stroke|fill)-(?:white|black)(?:\/\d+)?\b/;
const exemption = /theme-exempt:\s*\S+/;
const errors = [];

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : extname(path) === ".css" ? [path] : [];
  });
}

const files = process.argv.length > 2 ? process.argv.slice(2) : [
  ...filesUnder("src"),
  "src/components/sidebar/index.tsx",
  "src/components/fidelity-rail.tsx",
  "src/components/index/index.tsx",
  "src/mobile/components/index/index.tsx",
  "src/mobile/components/mobile/navigation.tsx",
];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const label = relative(process.cwd(), file) || file;
  if (extname(file) === ".css") {
    postcss.parse(text, { from: file }).walkRules((rule) => {
      if (!shellSelector.test(rule.selector) && !tagSelector.test(rule.selector)) return;
      rule.walkDecls((decl) => {
        if (!rawColor.test(decl.value)) return;
        const previous = decl.prev();
        if (previous?.type === "comment" && exemption.test(previous.text)) return;
        errors.push(`${label}:${decl.source.start.line} ${rule.selector} ${decl.prop}: ${decl.value}`);
      });
    });
  } else if (extname(file) === ".tsx") {
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      const match = line.match(rawColor) ?? line.match(rawUtility);
      if (match && !exemption.test(line) && !exemption.test(lines[index - 1] ?? "")) {
        errors.push(`${label}:${index + 1} ${line.trim()}`);
      }
    });
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
