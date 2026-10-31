#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const base = process.argv[2];
if (!base) {
  console.error("usage: node scripts/ui-refactor-guard.mjs <base-ref>");
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const exception = process.env.FORMAT_EXCEPTION_APPROVED === "true";
const catalogs = [
  "src/i18n/locales/en.json",
  "src/i18n/locales/zh.json",
  "src/mobile/en.json",
  "src/mobile/zh.json",
];
const csvKeys = new Set([
  "symbol", "current", "target", "deviation", "action", "value", "quantity",
  "note", "missingPrice", "belowThreshold", "cashReserveAmount", "buy",
  "sell", "noTrade",
].map((name) => `rebalance.${name}`));
const insightMessageKeys = new Set([
  "stale", "staleLegacy", "partial", "concentration", "stablecoins",
  "mover", "newAsset", "exitedAsset", "unusual", "goalReached",
  "goalNear", "alert", "drift",
].map((name) => `insights.${name}`));
const protectedLine = /localStorage|sessionStorage|invoke\(|@tauri-apps\/plugin-(?:fs|sql|store|dialog)|writeTextFile|JSON\.(?:stringify|parse)|_KEY\b|track3-|trackEventWithClientID|save[A-Z]\w*\(|update[A-Z]\w*\(|delete[A-Z]\w*\(|record[A-Z]\w*\(|cooldownSeconds|initParams|runtimeToPersisted|persistedToRuntime|convertFormDataToConfigurationData|RadioGroupItem value=/;

function isAllowed(file) {
  return /^(?:src\/components\/|src\/mobile\/components\/)/.test(file)
    || /^(?:src\/style\.css|src\/mobile\/ios-style\.css|tailwind\.config\.js)$/.test(file)
    || /^src\/i18n\/locales\/[^/]+\.json$/.test(file)
    || /^src\/mobile\/(?:en|zh)\.json$/.test(file)
    || /^src\/utils\/(?:color|chart-theme|legend)\.ts$/.test(file)
    || /^tests\/e2e\/(?:[^/]+\.spec\.ts|[^/]+-(?:scenes|captures)\.ts)$/.test(file)
    || /^public\/.+\.(?:png|jpg|jpeg|webp|gif|svg|ico|avif)$/.test(file)
    || /^docs\/ui\/.+/.test(file);
}

function isUi(file) {
  return /^(?:src\/components\/|src\/mobile\/components\/)/.test(file);
}

function isFrozenKey(key) {
  return /^(?:assistant\.action\.(?:preview|result|status)\.|insights\.window\.)/.test(key)
    || insightMessageKeys.has(key)
    || key.startsWith("goals.kind.")
    || key === "goals.alertTriggered"
    || csvKeys.has(key);
}

const failures = [];
try {
  git("rev-parse", "--verify", base);
  const range = `${base}...HEAD`;
  const files = git("diff", "--name-only", "--no-renames", "-z", range)
    .split("\0").filter(Boolean);

  if (!exception) {
    for (const file of files) {
      if (!isAllowed(file)) failures.push(`denied path: ${file}`);
      if (!isUi(file)) continue;
      const diff = git("diff", "--no-ext-diff", "--no-renames", "-U0", range, "--", file);
      for (const line of diff.split("\n")) {
        if (!/^[+-](?![+-])/.test(line)) continue;
        if (protectedLine.test(line.slice(1))) {
          failures.push(`protected UI line in ${file}: ${line}`);
        }
      }
    }

    for (const file of catalogs) {
      let oldCatalog;
      let newCatalog;
      try {
        oldCatalog = JSON.parse(git("show", `${base}:${file}`));
        newCatalog = JSON.parse(git("show", `HEAD:${file}`));
      } catch (error) {
        failures.push(`cannot compare catalog ${file}: ${error.message}`);
        continue;
      }
      for (const [key, value] of Object.entries(oldCatalog)) {
        if (!Object.hasOwn(newCatalog, key)) {
          failures.push(`removed i18n key in ${file}: ${key}`);
        } else if (isFrozenKey(key) && newCatalog[key] !== value) {
          failures.push(`changed frozen i18n value in ${file}: ${key}`);
        }
      }
    }
  }
} catch (error) {
  failures.push(`git diff failed: ${error.message}`);
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`ui-refactor-guard passed${exception ? " (owner exception)" : ""}`);
