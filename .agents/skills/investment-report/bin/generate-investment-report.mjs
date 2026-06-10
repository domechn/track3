#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  defaultOutputPath,
  normalizeReportInput,
  writeInvestmentShareHtml,
} from "../lib/report-generator.mjs";

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || !options.input) {
    printHelp();
    return;
  }

  const payload = await loadPayload(options.input);
  const report = applyOverrides(payload, options);
  const outputPath = resolve(options.output ?? defaultOutputPath(report));
  const finalPath = await writeInvestmentShareHtml(report, outputPath);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        outputPath: finalPath,
        privacy: normalizeReportInput(report).privacy,
      },
      null,
      2,
    )}\n`,
  );
}

async function loadPayload(inputPath) {
  const resolvedPath = resolve(inputPath);
  const content = await readFile(resolvedPath, "utf8");
  return JSON.parse(content);
}

function applyOverrides(payload, options) {
  const report = structuredClone(payload);
  report.title = options.title ?? report.title;
  report.subtitle = options.subtitle ?? report.subtitle;
  report.currency = options.currency ?? report.currency;
  report.language = options.language ?? report.language;
  report.period = {
    ...(report.period ?? {}),
    from: options.from ?? report.period?.from,
    to: options.to ?? report.period?.to,
    label: options.label ?? report.period?.label,
  };
  report.privacy = {
    ...(report.privacy ?? {}),
    ...(options.showAmounts !== undefined
      ? { showAmounts: options.showAmounts }
      : {}),
    ...(options.showAllocationAmounts !== undefined
      ? { showAllocationAmounts: options.showAllocationAmounts }
      : {}),
    ...(options.showTickers !== undefined
      ? { showTickers: options.showTickers }
      : {}),
  };
  return report;
}

function parseArgs(tokens) {
  const options = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = toCamelCase(rawKey);
    const value =
      inlineValue !== undefined
        ? inlineValue
        : tokens[index + 1] && !tokens[index + 1].startsWith("--")
          ? tokens[++index]
          : true;
    options[key] = coerce(value);
  }

  return options;
}

function coerce(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function printHelp() {
  process.stdout.write(
    `Usage:\n  node .agents/skills/investment-report/bin/generate-investment-report.mjs --input <report.json> [--output <report.html>]\n\nOptions:\n  --input <path>                    JSON payload path\n  --output <path>                   HTML output path\n  --title <text>                    Override title\n  --subtitle <text>                 Override subtitle\n  --from <date>                     Override period start\n  --to <date>                       Override period end\n  --label <text>                    Override period label\n  --currency <code>                 Override currency\n  --language zh-CN|en-US            Override language\n  --show-amounts true|false         Toggle summary amounts\n  --show-allocation-amounts true|false\n  --show-tickers true|false         Toggle asset names\n`,
  );
}
