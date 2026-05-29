import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

import { openTrack3Database, resolveDatabasePath } from "../lib/db.mjs";
import { createTrack3HistoryService } from "../lib/queries.mjs";

const FIRST_SNAPSHOT_AT = "2026-01-01T00:00:00.000Z";
const SECOND_SNAPSHOT_AT = "2026-01-10T00:00:00.000Z";
const CLI_PATH = fileURLToPath(
  new URL("../bin/track3-history.mjs", import.meta.url),
);

test("resolves the macOS Track3 database path", () => {
  assert.equal(
    resolveDatabasePath({
      platform: "darwin",
      homeDir: "/Users/alice",
      env: {},
    }),
    "/Users/alice/Library/Application Support/dev.track3.track3/track3.db",
  );
});

test("queries dates, timeline, latest holdings, and same-symbol asset types", async () => {
  await withFixtureDatabase((fixturePath) => {
    const database = openTrack3Database({ dbPath: fixturePath });
    try {
      const service = createTrack3HistoryService(database);

      const dates = service.queryDates();
      assert.deepEqual(
        dates.map((dateRecord) => dateRecord.createdAt),
        [SECOND_SNAPSHOT_AT, FIRST_SNAPSHOT_AT],
      );
      assert.equal(dates[0].assetCount, 4);
      assert.equal(dates[0].totalValue, 100100);

      const timeline = service.queryTimeline({
        start: new Date(FIRST_SNAPSHOT_AT),
        end: new Date(SECOND_SNAPSHOT_AT),
      });
      assert.deepEqual(
        timeline.points.map((point) => point.totalValue),
        [61050, 100100],
      );

      const latest = service.queryLatest({ includeZero: true });
      assert.equal(latest.createdAt, SECOND_SNAPSHOT_AT);
      assert.equal(latest.totalValue, 100100);

      const latestInRange = service.queryLatest({
        end: new Date(FIRST_SNAPSHOT_AT),
        includeZero: true,
      });
      assert.equal(latestInRange.createdAt, FIRST_SNAPSHOT_AT);
      assert.equal(latestInRange.totalValue, 61050);

      const aaplAssets = latest.assets.filter(
        (asset) => asset.symbol === "AAPL",
      );
      assert.deepEqual(
        aaplAssets.map(
          (asset) => `${asset.assetType}:${asset.symbol}:${asset.value}`,
        ),
        ["stock:AAPL:1100", "crypto:AAPL:0"],
      );

      const stockAapl = service.queryAsset({
        symbol: "AAPL",
        assetType: "stock",
      });
      assert.equal(stockAapl.latest?.value, 1100);
      assert.equal(stockAapl.series.length, 2);
    } finally {
      database.close();
    }
  });
});

test("compares snapshots and calculates BTC profit", async () => {
  await withFixtureDatabase((fixturePath) => {
    const database = openTrack3Database({ dbPath: fixturePath });
    try {
      const service = createTrack3HistoryService(database);

      const comparison = service.queryCompare({
        leftUuid: "snapshot-1",
        rightUuid: "snapshot-2",
      });
      assert.equal(comparison.left.totalValue, 61050);
      assert.equal(comparison.right.totalValue, 100100);
      assert.equal(comparison.totalDelta, 39050);

      const btcDelta = comparison.assets.find(
        (asset) => asset.assetType === "crypto" && asset.symbol === "BTC",
      );
      assert.equal(btcDelta.valueDelta, 35000);
      assert.equal(btcDelta.amountDelta, 0.5);

      const removedCryptoAapl = comparison.removedPositions.find(
        (asset) => asset.assetType === "crypto" && asset.symbol === "AAPL",
      );
      assert.equal(removedCryptoAapl.valueDelta, -50);

      const profit = service.queryPnl({
        start: new Date(FIRST_SNAPSHOT_AT),
        end: new Date(SECOND_SNAPSHOT_AT),
        symbol: "BTC",
        assetType: "crypto",
      });
      assert.equal(profit.coins.length, 1);
      assert.equal(Math.round(profit.total), 14000);
      assert.equal(Math.round(profit.coins[0].percentage), 23);
    } finally {
      database.close();
    }
  });
});

test("prints skill-friendly JSON from the CLI", async () => {
  await withFixtureDatabase((fixturePath) => {
    const result = runCli(fixturePath, [
      "timeline",
      "--from",
      FIRST_SNAPSHOT_AT,
      "--to",
      SECOND_SNAPSHOT_AT,
      "--format",
      "json",
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const output = JSON.parse(result.stdout);
    assert.equal(output.command, "timeline");
    assert.equal(output.metadata.rowCount, 2);
    assert.deepEqual(
      output.data.points.map((point) => point.totalValue),
      [61050, 100100],
    );
  });
});

test("supports the main CLI command family against a fixture database", async () => {
  await withFixtureDatabase((fixturePath) => {
    const jsonCommands = [
      ["doctor"],
      ["dates", "--limit", "2"],
      ["snapshots", "--limit", "2", "--include-transactions"],
      ["latest", "--include-zero"],
      ["asset", "--symbol", "AAPL", "--asset-type", "stock"],
      ["transactions", "--symbol", "BTC", "--asset-type", "crypto"],
      [
        "pnl",
        "--symbol",
        "BTC",
        "--asset-type",
        "crypto",
        "--from",
        FIRST_SNAPSHOT_AT,
        "--to",
        SECOND_SNAPSHOT_AT,
      ],
      ["compare", "--left-uuid", "snapshot-1", "--right-uuid", "snapshot-2"],
      ["top", "--limit", "2"],
    ];

    for (const commandArgs of jsonCommands) {
      const result = runCli(fixturePath, commandArgs);
      assert.equal(
        result.status,
        0,
        `${commandArgs.join(" ")}\n${result.stderr}`,
      );
      assert.equal(result.stderr, "", commandArgs.join(" "));
      const output = JSON.parse(result.stdout);
      assert.equal(output.command, commandArgs[0]);
      assert.ok(output.metadata.generatedAt);
    }

    const csvResult = runCli(fixturePath, [
      "export",
      "--query",
      "timeline",
      "--from",
      FIRST_SNAPSHOT_AT,
      "--to",
      SECOND_SNAPSHOT_AT,
      "--format",
      "csv",
    ]);
    assert.equal(csvResult.status, 0, csvResult.stderr);
    assert.equal(csvResult.stderr, "");
    assert.match(csvResult.stdout, /totalValue/);
    assert.match(csvResult.stdout, /61050/);
  });
});

async function withFixtureDatabase(callback) {
  const directory = await mkdtemp(join(tmpdir(), "track3-history-"));
  const fixturePath = join(directory, "track3.db");
  createFixtureDatabase(fixturePath);

  try {
    return await callback(fixturePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function createFixtureDatabase(fixturePath) {
  const database = new DatabaseSync(fixturePath);
  try {
    database.exec(`
      CREATE TABLE assets_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        wallet TEXT NOT NULL,
        asset_type TEXT NOT NULL DEFAULT 'crypto',
        symbol TEXT NOT NULL,
        amount REAL NOT NULL,
        value REAL NOT NULL,
        price REAL NOT NULL
      );
      CREATE UNIQUE INDEX unique_uuid_asset_type_symbol_wallet
        ON assets_v2 (uuid, asset_type, symbol, wallet);
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL,
        assetID INTEGER NOT NULL,
        asset_type TEXT NOT NULL DEFAULT 'crypto',
        wallet TEXT NOT NULL,
        symbol TEXT NOT NULL,
        amount REAL NOT NULL,
        price REAL NOT NULL,
        txnType TEXT NOT NULL,
        txnCreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const insertAsset = database.prepare(`
      INSERT INTO assets_v2
        (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTransaction = database.prepare(`
      INSERT INTO transactions
        (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAsset.run(
      "snapshot-1",
      FIRST_SNAPSHOT_AT,
      "wallet-a",
      "crypto",
      "BTC",
      1,
      40000,
      40000,
    );
    insertAsset.run(
      "snapshot-1",
      FIRST_SNAPSHOT_AT,
      "wallet-a",
      "crypto",
      "ETH",
      10,
      20000,
      2000,
    );
    insertAsset.run(
      "snapshot-1",
      FIRST_SNAPSHOT_AT,
      "broker-a",
      "stock",
      "AAPL",
      5,
      1000,
      200,
    );
    insertAsset.run(
      "snapshot-1",
      FIRST_SNAPSHOT_AT,
      "wallet-b",
      "crypto",
      "AAPL",
      100,
      50,
      0.5,
    );
    insertAsset.run(
      "snapshot-2",
      SECOND_SNAPSHOT_AT,
      "wallet-a",
      "crypto",
      "BTC",
      1.5,
      75000,
      50000,
    );
    insertAsset.run(
      "snapshot-2",
      SECOND_SNAPSHOT_AT,
      "wallet-a",
      "crypto",
      "ETH",
      8,
      24000,
      3000,
    );
    insertAsset.run(
      "snapshot-2",
      SECOND_SNAPSHOT_AT,
      "broker-a",
      "stock",
      "AAPL",
      5,
      1100,
      220,
    );
    insertAsset.run(
      "snapshot-2",
      SECOND_SNAPSHOT_AT,
      "wallet-b",
      "crypto",
      "AAPL",
      0,
      0,
      0.4,
    );

    insertTransaction.run(
      "snapshot-2",
      5,
      "crypto",
      "wallet-a",
      "BTC",
      0.5,
      42000,
      "buy",
      "2026-01-05T00:00:00.000Z",
      SECOND_SNAPSHOT_AT,
      SECOND_SNAPSHOT_AT,
    );
    insertTransaction.run(
      "snapshot-2",
      6,
      "crypto",
      "wallet-a",
      "ETH",
      2,
      2800,
      "sell",
      "2026-01-06T00:00:00.000Z",
      SECOND_SNAPSHOT_AT,
      SECOND_SNAPSHOT_AT,
    );
  } finally {
    database.close();
  }
}

function runCli(fixturePath, args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args, "--db", fixturePath], {
    encoding: "utf8",
  });
}
