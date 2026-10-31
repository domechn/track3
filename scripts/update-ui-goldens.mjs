#!/usr/bin/env node
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const sorted = (values) => [...new Set(values)].sort();
const catalogs = [
  "src/i18n/locales/en.json",
  "src/i18n/locales/zh.json",
  "src/mobile/en.json",
  "src/mobile/zh.json",
];

function files(dir) {
  return readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((entry) => {
      const name = `${dir}/${entry.name}`;
      return entry.isDirectory() ? files(name) : [name];
    });
}

const sourceFiles = files("src").filter((file) =>
  /\.(?:ts|tsx|js|jsx)$/.test(file)
  && !/\/(?:test|__tests__)\//.test(file)
  && !/\.(?:test|spec)\./.test(file));
const uiFiles = sourceFiles.filter((file) =>
  file.startsWith("src/components/") || file.startsWith("src/mobile/components/"));

function storageKeys() {
  const literals = [];
  const constants = {};
  for (const file of sourceFiles) {
    const text = read(file);
    for (const match of text.matchAll(/(["'`])(track3-[^"'`\s]+)\1/g)) literals.push(match[2]);
    for (const match of text.matchAll(/\b(?:const|let)\s+(\w*(?:_KEY|StorageKey|LocalStorageKey))\s*(?::[^=\n]+)?=\s*(["'`])([^"'`]+)\2/g)) {
      constants[`${file}:${match[1]}`] = match[3];
    }
  }
  const theme = [...read("src/components/common/theme/index.tsx")
    .match(/export type Theme = ([^;]+);/)[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const mobileTheme = [...read("src/mobile/components/common/theme/index.tsx")
    .match(/export type Theme = ([^;]+);/)[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const locale = [...read("src/i18n/index.tsx")
    .match(/export const SUPPORTED_LOCALES:[^=]+=\s*\[([^\]]+)\]/)[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  const mobileLocaleSource = read("src/mobile/i18n.tsx")
    .match(/export \{[^}]*SUPPORTED_LOCALES[^}]*\} from "([^"]+)"/s)?.[1];
  const onboarding = [...read("src/middlelayers/onboarding-storage.ts")
    .match(/export type OnboardingState = ([^\n]+)/)[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  return { literals: sorted(literals), constants, theme, mobileTheme, locale, mobileLocaleSource, onboarding };
}

const persistenceLine = /localStorage|sessionStorage|invoke\(|@tauri-apps\/plugin-(?:fs|sql|store|dialog)|writeTextFile|JSON\.(?:stringify|parse)|_KEY\b|track3-|trackEventWithClientID|save[A-Z]\w*\(|update[A-Z]\w*\(|delete[A-Z]\w*\(|record[A-Z]\w*\(|cooldownSeconds|initParams|runtimeToPersisted|persistedToRuntime|convertFormDataToConfigurationData|RadioGroupItem value=/;
function uiPersistenceInventory() {
  const result = {};
  for (const file of uiFiles) {
    const lines = read(file).split("\n")
      .filter((line) => persistenceLine.test(line))
      .map((line) => line.trim().replace(/\s+/g, " "));
    if (lines.length) result[file] = lines;
  }
  return result;
}

function routes() {
  const result = {};
  for (const file of ["src/components/index/index.tsx", "src/mobile/components/index/index.tsx"]) {
    const text = read(file);
    const settingsStart = text.indexOf('path="settings"');
    const settingsEnd = text.indexOf('path="coins/:symbol"', settingsStart);
    result[file] = sorted([...text.matchAll(/\bpath="([^"]+)"/g)].map((match) => {
      const value = match[1];
      if (value.startsWith("/")) return value;
      if (match.index > settingsStart && match.index < settingsEnd && value !== "*") {
        return `/settings/${value}`;
      }
      return `/${value}`;
    }));
  }
  for (const file of ["src/components/settings/index.tsx", "src/mobile/components/settings/index.tsx"]) {
    result[file] = sorted([...read(file).matchAll(/\bhref:\s*"([^"]+)"/g)].map((match) => match[1]));
  }
  return result;
}

function configIds() {
  const text = read("src/middlelayers/configuration.ts");
  const ids = {};
  for (const match of text.matchAll(/\bconst\s+(\w+Id)\s*=\s*"(\d+)"/g)) ids[match[1]] = match[2];
  const sync = {};
  for (const match of read("src/middlelayers/sync/config-keys.ts")
    .matchAll(/^\s*(?:"(\d+)"|(rebalance)):\s*\{\s*category:\s*"([^"]+)",\s*encrypted:\s*(true|false)/gm)) {
    sync[match[1] ?? match[2]] = { category: match[3], encrypted: match[4] === "true" };
  }
  const encode = text.match(/qc === "([^"]+)" \? (\d+) : (\d+)/);
  const decode = text.match(/val === (\d+) \? "([^"]+)" : "([^"]+)"/);
  if (!encode || !decode) throw new Error("Cannot find quote colour encoding");
  return {
    ids,
    sync,
    quoteColor: {
      encode: { [encode[1]]: Number(encode[2]), [decode[3]]: Number(encode[3]) },
      decode: { [decode[1]]: decode[2], [encode[3]]: decode[3] },
    },
  };
}

function telemetryEvents() {
  const eventArguments = [];
  for (const file of sourceFiles) {
    for (const match of read(file).matchAll(/\btrackEventWithClientID\(\s*("([^"]+)"|`([^`]+)`)/g)) {
      eventArguments.push(match[2] ?? `\`${match[3]}\``);
    }
  }
  return sorted(eventArguments);
}

function i18nKeys() {
  return Object.fromEntries(catalogs.map((file) => [
    file,
    Object.keys(JSON.parse(read(file))).sort(),
  ]));
}

const snapshots = {
  "storage-keys": storageKeys,
  "ui-persistence-inventory": uiPersistenceInventory,
  routes,
  "config-ids": configIds,
  "telemetry-events": telemetryEvents,
  "i18n-keys-0.9.4": i18nKeys,
};

if (process.argv[2] === "--print" && Object.hasOwn(snapshots, process.argv[3])) {
  console.log(JSON.stringify(snapshots[process.argv[3]]()));
} else if (process.argv[2] === "--update" && process.argv.length === 3) {
  if (process.env.CI || process.env.GOLDEN_UPDATE_APPROVED !== "1") {
    throw new Error("Golden update requires GOLDEN_UPDATE_APPROVED=1 outside CI");
  }
  mkdirSync(path.join(root, "tests/golden"), { recursive: true });
  for (const [name, snapshot] of Object.entries(snapshots)) {
    writeFileSync(path.join(root, "tests/golden", `${name}.json`),
      `${JSON.stringify(snapshot(), null, 2)}\n`);
    console.log(`updated tests/golden/${name}.json`);
  }
} else {
  console.error("usage: node scripts/update-ui-goldens.mjs --print <name> | --update");
  process.exitCode = 2;
}
