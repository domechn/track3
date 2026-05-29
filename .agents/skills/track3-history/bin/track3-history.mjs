#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createTrack3HistoryService } from "../lib/queries.mjs";
import { openTrack3Database, resolveExistingDatabasePath } from "../lib/db.mjs";
import {
  createCommandOutput,
  printError,
  printOutput,
} from "../lib/format.mjs";

const SUPPORTED_COMMANDS = new Set([
  "doctor",
  "dates",
  "snapshots",
  "timeline",
  "latest",
  "asset",
  "transactions",
  "pnl",
  "compare",
  "top",
  "export",
]);

ensureCleanSqliteWarnings();
main();

function ensureCleanSqliteWarnings() {
  if (process.env.TRACK3_HISTORY_WARNING_REEXEC === "1") {
    return;
  }
  if (
    process.execArgv.some((argument) => argument.startsWith("--no-warnings"))
  ) {
    return;
  }

  const result = spawnSync(
    process.execPath,
    [
      ...process.execArgv,
      "--no-warnings=ExperimentalWarning",
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TRACK3_HISTORY_WARNING_REEXEC: "1",
      },
    },
  );

  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  const format = options.format ?? "json";

  if (!command || command === "help" || options.help) {
    printHelp();
    return;
  }

  if (!SUPPORTED_COMMANDS.has(command)) {
    printError(new Error(`Unknown command: ${command}`), format);
    process.exitCode = 1;
    return;
  }

  let database;
  try {
    const dbPath = resolveExistingDatabasePath({ dbPath: options.db });
    database = openTrack3Database({ dbPath });
    const service = createTrack3HistoryService(database, { dbPath });
    const effectiveCommand = command === "export" ? options.query : command;
    if (command === "export" && !effectiveCommand) {
      throw new Error("export requires --query <command>");
    }
    if (command === "export" && !SUPPORTED_COMMANDS.has(effectiveCommand)) {
      throw new Error(`Unsupported export query: ${effectiveCommand}`);
    }
    const data = executeCommand(service, effectiveCommand, options);
    const warnings = data?.warnings ?? [];
    const output = createCommandOutput(
      command,
      scrubParameters(options),
      data,
      warnings,
    );
    printOutput(output, format);
  } catch (error) {
    printError(error, format);
    process.exitCode = 1;
  } finally {
    database?.close();
  }
}

function executeCommand(service, command, options) {
  switch (command) {
    case "doctor":
      return service.queryDoctor();
    case "dates":
      return { dates: service.queryDates(options) };
    case "snapshots":
      return service.querySnapshots({
        start: options.from ?? options.start,
        end: options.to ?? options.end,
        limit: options.limit,
        gather: options.raw ? false : options.gather !== false,
        includeTransactions: Boolean(options.includeTransactions),
      });
    case "timeline":
      return service.queryTimeline({
        start: options.from ?? options.start,
        end: options.to ?? options.end,
        maxPoints: options.maxPoints,
      });
    case "latest":
      return service.queryLatest({
        assetType: options.assetType,
        start: options.from ?? options.start,
        end: options.to ?? options.end,
        includeZero: Boolean(options.includeZero),
        groupByWallet: Boolean(options.groupByWallet),
      });
    case "asset":
      return service.queryAsset({
        symbol: options.symbol,
        assetType: options.assetType,
        start: options.from ?? options.start,
        end: options.to ?? options.end,
        maxPoints: options.maxPoints,
        transactionLimit: options.transactionLimit,
      });
    case "transactions":
      return service.queryTransactions({
        start: options.from ?? options.start,
        end: options.to ?? options.end,
        symbol: options.symbol,
        assetType: options.assetType,
        wallet: options.wallet,
        txnType: options.txnType,
        limit: options.limit,
      });
    case "pnl":
      return service.queryPnl({
        start: options.from ?? options.start,
        end: options.to ?? options.end,
        symbol: options.symbol,
        assetType: options.assetType,
      });
    case "compare":
      return service.queryCompare({
        leftUuid: options.leftUuid,
        rightUuid: options.rightUuid,
        leftDate: options.leftDate,
        rightDate: options.rightDate,
      });
    case "top":
      return service.queryTop({
        start: options.from ?? options.start,
        end: options.to ?? options.end,
        limit: options.limit,
        by: options.by,
        assetType: options.assetType,
      });
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
}

function parseArguments(tokens) {
  const [command, ...optionTokens] = tokens;
  const options = {};

  for (let tokenIndex = 0; tokenIndex < optionTokens.length; tokenIndex += 1) {
    const token = optionTokens[tokenIndex];
    if (!token.startsWith("--")) {
      continue;
    }

    if (token.startsWith("--no-")) {
      options[toCamelCase(token.slice(5))] = false;
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = toCamelCase(rawKey);
    if (inlineValue !== undefined) {
      options[key] = coerceValue(inlineValue);
      continue;
    }

    const nextToken = optionTokens[tokenIndex + 1];
    if (nextToken && !nextToken.startsWith("--")) {
      options[key] = coerceValue(nextToken);
      tokenIndex += 1;
    } else {
      options[key] = true;
    }
  }

  return { command, options };
}

function scrubParameters(options) {
  const result = { ...options };
  delete result.db;
  return result;
}

function coerceValue(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

function toCamelCase(value) {
  return value.replaceAll(/-([a-z])/g, (_match, character) =>
    character.toUpperCase(),
  );
}

function printHelp() {
  process.stdout.write(`Track3 historical data CLI

Usage:
  node .claude/skills/track3-history/bin/track3-history.mjs <command> [options]

Commands:
  doctor        Inspect the local Track3 SQLite database and schema
  dates         List snapshot dates and totals
  snapshots     Return historical snapshots grouped by uuid
  timeline      Return total portfolio value over time
  latest        Return latest holdings and allocation
  asset         Drill into one symbol, optionally with --asset-type
  transactions  Query transaction history
  pnl           Calculate range profit from snapshots and transactions
  compare       Compare two snapshots or dates
  top           List top assets by cumulative or latest value
  export        Run another query with --query and print JSON/CSV/table

Common options:
  --db <path>              Override database path
  --from <iso> --to <iso>  Date range
  --format json|csv|table  Output format, default json
  --limit <n>              Limit rows where supported
  --max-points <n>         Downsample time series
  --symbol <symbol>        Asset symbol for asset/pnl/transactions
  --asset-type crypto|stock
`);
}
