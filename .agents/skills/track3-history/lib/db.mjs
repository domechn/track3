import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);

export const APP_IDENTIFIER = "dev.track3.track3";
export const DATABASE_NAME = "track3.db";

const REQUIRED_SCHEMA = {
  assets_v2: [
    "id",
    "uuid",
    "createdAt",
    "wallet",
    "asset_type",
    "symbol",
    "amount",
    "value",
    "price",
  ],
  transactions: [
    "id",
    "uuid",
    "assetID",
    "asset_type",
    "wallet",
    "symbol",
    "amount",
    "price",
    "txnType",
    "txnCreatedAt",
    "createdAt",
    "updatedAt",
  ],
};

let sqliteModule;
let warningHandlerInstalled = false;

export function resolveDatabasePath(options = {}) {
  if (options.dbPath) {
    return resolve(options.dbPath);
  }

  return resolveDatabaseCandidates(options)[0];
}

export function resolveExistingDatabasePath(options = {}) {
  if (options.dbPath) {
    return resolve(options.dbPath);
  }

  const candidates = resolveDatabaseCandidates(options);
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function resolveDatabaseCandidates(options = {}) {
  const platform = options.platform ?? process.platform;
  const homeDirectory = options.homeDir ?? homedir();
  const env = options.env ?? process.env;

  if (platform === "darwin") {
    return [
      join(
        homeDirectory,
        "Library",
        "Application Support",
        APP_IDENTIFIER,
        DATABASE_NAME,
      ),
    ];
  }

  if (platform === "win32") {
    const appDataDirectory =
      env.APPDATA ?? join(homeDirectory, "AppData", "Roaming");
    return [join(appDataDirectory, APP_IDENTIFIER, DATABASE_NAME)];
  }

  const dataHome = env.XDG_DATA_HOME ?? join(homeDirectory, ".local", "share");
  const configHome = env.XDG_CONFIG_HOME ?? join(homeDirectory, ".config");
  return [
    join(dataHome, APP_IDENTIFIER, DATABASE_NAME),
    join(configHome, APP_IDENTIFIER, DATABASE_NAME),
  ];
}

export function openTrack3Database(options = {}) {
  const dbPath = resolveExistingDatabasePath(options);
  if (!existsSync(dbPath)) {
    throw new Error(`Track3 database not found: ${dbPath}`);
  }

  const { DatabaseSync } = loadSqliteModule();
  return new DatabaseSync(dbPath, { readOnly: true });
}

export function inspectTrack3Database(database, options = {}) {
  const tables = Object.entries(REQUIRED_SCHEMA).map(
    ([tableName, requiredColumns]) => {
      const exists = tableExists(database, tableName);
      const columns = exists ? tableColumns(database, tableName) : [];
      const missingColumns = requiredColumns.filter(
        (column) => !columns.includes(column),
      );
      const rowCount = exists ? countRows(database, tableName) : 0;

      return {
        name: tableName,
        exists,
        rowCount,
        columns,
        missingColumns,
      };
    },
  );

  const assetsTable = tables.find((table) => table.name === "assets_v2");
  const canQueryAssets =
    assetsTable?.exists && assetsTable.missingColumns.length === 0;
  const snapshotStats = canQueryAssets
    ? database
        .prepare(
          `SELECT
            COUNT(DISTINCT uuid) AS snapshotCount,
            MIN(createdAt) AS earliestSnapshotAt,
            MAX(createdAt) AS latestSnapshotAt
          FROM assets_v2`,
        )
        .get()
    : {
        snapshotCount: 0,
        earliestSnapshotAt: null,
        latestSnapshotAt: null,
      };

  const warnings = [];
  for (const table of tables) {
    if (!table.exists) {
      warnings.push(`Missing required table: ${table.name}`);
    }
    if (table.missingColumns.length > 0) {
      warnings.push(
        `Table ${table.name} is missing columns: ${table.missingColumns.join(", ")}`,
      );
    }
  }

  return {
    dbPath: options.dbPath,
    ok: warnings.length === 0,
    tables,
    snapshotCount: Number(snapshotStats.snapshotCount ?? 0),
    earliestSnapshotAt: snapshotStats.earliestSnapshotAt ?? null,
    latestSnapshotAt: snapshotStats.latestSnapshotAt ?? null,
    warnings,
  };
}

function loadSqliteModule() {
  if (!sqliteModule) {
    installSqliteWarningHandler();
    sqliteModule = require("node:sqlite");
  }
  return sqliteModule;
}

function installSqliteWarningHandler() {
  if (
    warningHandlerInstalled ||
    process.env.TRACK3_HISTORY_SHOW_WARNINGS === "1"
  ) {
    return;
  }

  warningHandlerInstalled = true;
  process.on("warning", (warning) => {
    if (
      warning.name === "ExperimentalWarning" &&
      warning.message.toLowerCase().includes("sqlite")
    ) {
      return;
    }

    process.stderr.write(`${warning.name}: ${warning.message}\n`);
  });
}

function tableExists(database, tableName) {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

function tableColumns(database, tableName) {
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);
}

function countRows(database, tableName) {
  const row = database
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .get();
  return Number(row.count ?? 0);
}
