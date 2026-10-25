import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import initSqlJs from "sql.js";
import md5 from "md5";
import { FakeS3, S3Error } from "../../src/middlelayers/sync/object-store";

const schemaFiles = [
  "assets_v2", "asset_prices", "transactions", "chat_sessions",
  "currency_rates", "configuration",
];

export async function installTauriBridge(page: Page, s3?: FakeS3, seedReviewContent = false, seedRebalanceProfile = false, emptyPortfolio = false, seedLockedSync = false, richPortfolio = false, slowOverview = false, lockedStartup = false, freshReviewData = false, slowAssistant = false, failDataQueries = false) {
  const SQL = await initSqlJs({
    locateFile: () => resolve("node_modules/sql.js/dist/sql-wasm.wasm"),
  });
  const db = new SQL.Database();
  for (const name of schemaFiles) {
    db.run(readFileSync(resolve(`src-tauri/migrations/init/${name}_up.sql`), "utf8"));
  }
  db.run(`
    CREATE TABLE refresh_operations (operation_uuid TEXT, created_at TEXT);
    INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      VALUES
      ('snapshot-old', '2024-01-01T00:00:00.000Z', 'wallet-1', 'crypto', 'BTC', 1, 40000, 40000),
      ('snapshot-new', '2024-01-02T00:00:00.000Z', 'wallet-1', 'crypto', 'BTC', 1, 42000, 42000);
    INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt)
      VALUES ('USD', 'US dollar', '$', 1, 0, '2099-01-01T00:00:00.000Z');
    INSERT INTO configuration (id, data) VALUES
      (997, '!ent:e2e:license'),
      (994, '!ent:e2e:ai'),
      (998, 'e2e-client');
  `);
  db.run("INSERT INTO configuration (id, data) VALUES (12, ?)",
    ["configs:\n  groupUSD: false\nothers:\n  - symbol: BTC\n    amount: 2\n"]);
  db.run("INSERT INTO configuration (id, data) VALUES (11, ?)", [
    "btc: {addresses: []}\nerc20: {addresses: []}\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n",
  ]);
  if (seedLockedSync) {
    db.run("INSERT INTO configuration (id, data) VALUES (991, ?)", [
      `!ent:e2e:${JSON.stringify({ enabled: true, endpoint: "https://s3.example.test", bucket: "track3", region: "us-east-1", accessKeyId: "e2e-access", secretAccessKey: "e2e-secret" })}`,
    ]);
  }
  if (emptyPortfolio) {
    db.run("DELETE FROM assets_v2");
    db.run("UPDATE configuration SET data = ? WHERE id = 12",
      ["configs:\n  groupUSD: false\nothers: []\n"]);
  }
  if (richPortfolio && !emptyPortfolio) {
    db.run("DELETE FROM assets_v2");
    db.run("INSERT INTO configuration (id, data) VALUES (6, '60')");
    const bitcoinAddress = "bc1q-demo-cold-storage";
    const solanaAddress = "demo-solana-wallet";
    const coinbaseIdentity = "coinbase-demo-key";
    const ibkrIdentity = "ibkr:demo-query";
    db.run("UPDATE configuration SET data = ? WHERE id = 11", [
      `btc:\n  addresses:\n    - address: ${bitcoinAddress}\n      alias: Cold storage\nsol:\n  addresses:\n    - address: ${solanaAddress}\n      alias: Solana wallet\nerc20: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n`,
    ]);
    db.run("INSERT INTO configuration (id, data) VALUES (10, ?)", [
      "!ent:e2e:exchanges:\n  - name: coinbase\n    alias: Main exchange\n    initParams:\n      apiKey: demo-key\n      secret: demo-secret\n",
    ]);
    db.run("INSERT INTO configuration (id, data) VALUES (20, ?)", [
      "!ent:e2e:brokers:\n  - name: ibkr\n    alias: Brokerage\n    initParams:\n      token: demo-token\n      queryId: demo-query\n",
    ]);
    const holdings = [
      { symbol: "BTC", type: "crypto", wallet: md5(bitcoinAddress), amount: 0.36, base: 28_000 },
      { symbol: "ETH", type: "crypto", wallet: md5(coinbaseIdentity), amount: 3.8, base: 12_000 },
      { symbol: "AAPL", type: "stock", wallet: md5(ibkrIdentity), amount: 43, base: 9_000 },
      { symbol: "SOL", type: "crypto", wallet: md5(solanaAddress), amount: 42, base: 7_000 },
      { symbol: "USDC", type: "crypto", wallet: md5(coinbaseIdentity), amount: 6_400, base: 6_400 },
      { symbol: "AVAX", type: "crypto", wallet: md5(coinbaseIdentity), amount: 81, base: 3_000 },
      { symbol: "LINK", type: "crypto", wallet: md5(coinbaseIdentity), amount: 90, base: 1_600 },
    ];
    const firstReviewDay = freshReviewData
      ? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 59))
      : new Date(Date.UTC(2026, 7, 24));
    for (let day = 0; day < 60; day++) {
      const uuid = `demo-${String(day).padStart(2, "0")}`;
      const createdAt = new Date(firstReviewDay.getTime() + day * 86400000).toISOString();
      const dailyMove = [0.004, -0.012, 0.008, 0.015, -0.006, 0.003, -0.009, 0.011, -0.004];
      const market = 0.86 + day * 0.004
        + (day >= 13 ? -0.055 : 0) + (day >= 27 ? 0.045 : 0)
        + (day >= 40 ? -0.035 : 0) + (day >= 51 ? 0.065 : 0)
        + dailyMove[day % dailyMove.length];
      for (const [index, holding] of holdings.entries()) {
        const value = Math.round(holding.base * (holding.symbol === "USDC"
          ? 1 : market * (1 + dailyMove[(day + index * 2) % dailyMove.length] * (index + 2))) * 100) / 100;
        db.run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid, createdAt, holding.wallet, holding.type, holding.symbol, holding.amount, value, value / holding.amount]);
      }
    }
    for (const [index, holding] of holdings.entries()) {
      const first = db.exec("SELECT id FROM assets_v2 WHERE uuid = 'demo-00' AND symbol = ?", [holding.symbol])[0]?.values[0];
      const last = db.exec("SELECT price, value FROM assets_v2 WHERE uuid = 'demo-59' AND symbol = ?", [holding.symbol])[0]?.values[0];
      if (!first || !last) throw new Error("Demo holding snapshot is missing");
      const costFactor = [0.78, 1.18, 0.86, 1.24, 1, 0.82, 1.26][index];
      db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'buy', ?)`,
      ["demo-00", first[0], holding.type, holding.wallet, holding.symbol,
        holding.amount, Number(last[0]) * costFactor, firstReviewDay.toISOString()]);
    }
    for (const [symbol, amount, saleFactor, day] of [
      ["SOL", 5, 1.08, 20],
      ["BTC", 0.08, 1.05, 40],
      ["ETH", 0.8, 0.82, 44],
    ] as const) {
      const holding = holdings.find((item) => item.symbol === symbol)!;
      const snapshot = `demo-${day}`;
      const row = db.exec("SELECT id, price FROM assets_v2 WHERE uuid = ? AND symbol = ?", [snapshot, symbol])[0]?.values[0];
      const latest = db.exec("SELECT price FROM assets_v2 WHERE uuid = 'demo-59' AND symbol = ?", [symbol])[0]?.values[0];
      if (!row || !latest) throw new Error("Demo sale snapshot is missing");
      const soldAt = new Date(Date.UTC(2026, 7, 24 + day)).toISOString();
      const repurchasedAt = new Date(Date.UTC(2026, 7, 24 + 55)).toISOString();
      db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'sell', ?)`,
      [snapshot, row[0], holding.type, holding.wallet, symbol, amount, Number(latest[0]) * saleFactor, soldAt]);
      db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'buy', ?)`,
      ["demo-55", row[0], holding.type, holding.wallet, symbol, amount, Number(latest[0]) * 0.96, repurchasedAt]);
    }
    if (!seedReviewContent) db.run("INSERT INTO configuration (id, data) VALUES (992, ?)", [
      `!ent:e2e:${JSON.stringify({
        snapshotUuid: "demo-59", dismissedIds: [],
        insights: [{ id: "new:crypto:SOL", severity: "info", messageKey: "insights.newAsset",
          data: { symbol: "SOL", value: 7298.27 } }],
      })}`,
    ]);
  }
  if (seedReviewContent) {
    db.run(`INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned, messageCount, preview)
      VALUES ('pinned-e2e', 'Pinned portfolio review', '2026-01-01', '2026-01-02', 1, 0, ''),
        ('recent-e2e', 'Recent portfolio review', '2026-01-01', '2026-01-03', 0, 0, '')`);
    db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
      VALUES ('snapshot-old', 1, 'crypto', 'wallet-1', 'BTC', 1, 40000, 'BUY', '2024-01-01T00:00:00.000Z')`);
    db.run("INSERT INTO configuration (id, data) VALUES (992, ?)", [
      `!ent:e2e:${JSON.stringify({
        snapshotUuid: "snapshot-new", dismissedIds: [],
        insights: [{ id: "new:crypto:BTC", severity: "info", messageKey: "insights.newAsset",
          data: { symbol: "BTC", value: 42000 } }],
      })}`,
    ]);
  }
  db.run(readFileSync(resolve("src-tauri/migrations/v08t09/history_snapshots_up.sql"), "utf8"));
  db.run(readFileSync(resolve("src-tauri/migrations/v08t09/rebalance_profiles_up.sql"), "utf8"));
  if (seedRebalanceProfile) {
    db.run("INSERT INTO rebalance_profiles (id, targets, tolerance_percent) VALUES (1, ?, 0)", [
      JSON.stringify([
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ]),
    ]);
  }
  db.run(readFileSync(resolve("src-tauri/migrations/v08t09/alerts_up.sql"), "utf8"));
  db.run(readFileSync(resolve("src-tauri/migrations/v08t09/sync_state_up.sql"), "utf8"));
  const config = JSON.stringify({
    endpoint: "https://assistant.test/v1",
    apiKey: "sk-e2e",
    model: "test-model",
    contextSize: 8192,
  });
  const files = new Map<string, string>();
  let exportedPath: string | null = null;
  const requests = new Map<number, { url: string; method?: string; headers?: Record<string, string> | [string, string][]; data?: number[] }>();
  const responses = new Map<number, { bytes: number[]; read: boolean; chunks?: number[][]; chunkIndex?: number }>();
  let nextRid = 1;
  let refreshes = 0;
  let sseCalls = 0;
  let haptics = 0;
  let shares = 0;

  const select = (query: string, values: unknown[] = []) => {
    const result = db.exec(query, values as any[]);
    return result.flatMap(({ columns, values: rows }) =>
      rows.map((row) => Object.fromEntries(columns.map((column, i) => [column, row[i]]))),
    );
  };
  const execute = (query: string, values: unknown[] = []) => {
    db.run(query, values as any[]);
    return [db.getRowsModified(), select("SELECT last_insert_rowid() AS id")[0]?.id ?? 0];
  };

  await page.exposeBinding("__e2eInvoke", async (_source, cmd: string, args: any, options?: any) => {
    if (cmd === "get_database_url") return "sqlite:e2e.db";
    if (cmd === "ios_startup_failure") return lockedStartup ? "Protected key unavailable" : null;
    if (cmd === "ios_retry_startup") return false;
    if (cmd === "ios_haptic") { haptics++; return null; }
    if (cmd === "ios_lock_enabled") return false;
    if (cmd === "ios_set_badge") return null;
    if (cmd === "query_binance_balance") {
      if (args.apiKey !== "e2e-api-key" || args.apiSecret !== "e2e-api-secret") {
        throw new Error("unexpected exchange credentials");
      }
      return {};
    }
    if (cmd === "ios_share_file") {
      if (!/^\/e2e\/cache\/[0-9a-f-]{36}\/track3-export-data\.json$/.test(args.path) || !files.has(args.path)) {
        throw new Error(`invalid export file: ${args.path}`);
      }
      shares++;
      return null;
    }
    if (cmd === "plugin:sql|load") return args.db;
    if (cmd === "plugin:sql|select") {
      if (failDataQueries && /\bassets_v2\b/i.test(args.query)) throw new Error("Demo database unavailable");
      if (slowOverview && /assets_v2/i.test(args.query)) await new Promise((resolve) => setTimeout(resolve, 1000));
      return select(args.query, args.values);
    }
    if (cmd === "plugin:sql|execute") return execute(args.query, args.values);
    if (cmd === "delete_sync_snapshot") {
      // Mirrors the Rust command: remove the snapshot's rows from every snapshot-scoped table.
      for (const table of ["asset_prices", "transactions", "assets_v2", "history_snapshots"]) {
        try { db.run(`DELETE FROM ${table} WHERE uuid = ?`, [args.uuid]); } catch { /* table absent in this fixture */ }
      }
      return null;
    }
    if (cmd === "import_sync_snapshot") {
      // Mirrors the Rust command: insert the snapshot's rows verbatim (idempotent by uuid).
      const snapshot = args.snapshot as { uuid: string; assets: any[]; prices: any[]; transactions: any[] };
      const existing = select("SELECT COUNT(*) AS n FROM assets_v2 WHERE uuid = ?", [snapshot.uuid])[0]?.n ?? 0;
      if (Number(existing) > 0) return false;
      const insert = (table: string, rows: Array<Record<string, unknown>>) => {
        for (const row of rows) {
          const columns = Object.keys(row);
          db.run(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
            columns.map((column) => row[column] as any));
        }
      };
      insert("assets_v2", snapshot.assets);
      insert("asset_prices", snapshot.prices);
      insert("transactions", snapshot.transactions);
      return true;
    }
    if (cmd === "plugin:path|resolve_directory") {
      if (args.directory === 16) return "/e2e/cache";
      if (args.directory === 6) return "/e2e/documents";
      return "/e2e/app";
    }
    if (cmd === "plugin:dialog|save") {
      exportedPath = `/e2e/documents/${args.options.defaultPath}`;
      files.set(exportedPath, "");
      return exportedPath;
    }
    if (cmd === "plugin:dialog|open") return exportedPath;
    if (cmd === "plugin:app|version") return "0.8.2";
    if (cmd === "plugin:app|tauri_version") return "2.11.1";
    if (cmd === "plugin:updater|check") return null;
    if (cmd === "plugin:event|listen") return nextRid++;
    if (cmd === "plugin:event|unlisten") return null;
    if (cmd === "download_coins_logos") return null;
    if (cmd === "encrypt") return `!ent:e2e:${args.data}`;
    if (cmd === "decrypt") {
      if (args.data === "!ent:e2e:license") return "e2e-license";
      if (args.data === "!ent:e2e:ai") return config;
      return String(args.data).replace(/^!ent:e2e:/, "");
    }
    if (cmd === "persist_refresh") {
      refreshes++;
      if (!args.operationUuid || !args.createdAt) throw new Error("invalid refresh payload");
      for (const asset of args.assets as Array<{
        wallet: string; assetType: string; symbol: string; amount: number; value: number; price: number;
      }>) {
        execute(`INSERT INTO assets_v2
          (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
          args.operationUuid, args.createdAt, asset.wallet, asset.assetType,
          asset.symbol, asset.amount, asset.value, asset.price,
        ]);
      }
      execute("INSERT INTO refresh_operations (operation_uuid, created_at) VALUES (?, ?)",
        [args.operationUuid, args.createdAt]);
      return null;
    }
    if (cmd === "delete_sync_snapshot") {
      db.run("BEGIN");
      try {
        for (const table of ["asset_prices", "transactions", "assets_v2"]) {
          execute(`DELETE FROM ${table} WHERE uuid = ?`, [args.uuid]);
        }
        db.run("COMMIT");
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
      return null;
    }
    if (cmd === "import_sync_snapshot") {
      const snapshot = args.snapshot;
      if (select("SELECT 1 FROM assets_v2 WHERE uuid = ? LIMIT 1", [snapshot.uuid]).length) return false;
      db.run("BEGIN");
      try {
        for (const [table, rows] of [
          ["assets_v2", snapshot.assets], ["asset_prices", snapshot.prices], ["transactions", snapshot.transactions],
        ] as const) {
          for (const row of rows) {
            const keys = Object.keys(row);
            execute(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, keys.map((key) => row[key]));
          }
        }
        db.run("COMMIT");
      } catch (error) {
        db.run("ROLLBACK");
        throw error;
      }
      return true;
    }
    if (cmd === "plugin:fs|exists") return files.has(args.path) ||
      (richPortfolio && /\/assets\/coins\/(btc|eth|sol|usdc|avax|link)\.png$/.test(args.path));
    if (cmd === "plugin:fs|mkdir") return null;
    if (cmd === "plugin:fs|copy_file") {
      const text = files.get(args.fromPath);
      if (text === undefined) throw new Error(`file missing: ${args.fromPath}`);
      files.set(args.toPath, text);
      return null;
    }
    if (cmd === "plugin:fs|stat") {
      const text = files.get(args.path);
      if (text === undefined) throw new Error(`file missing: ${args.path}`);
      return { size: new TextEncoder().encode(text).length, isFile: true, isDirectory: false, isSymlink: false, mtime: null, atime: null, birthtime: null, readonly: false };
    }
    if (cmd === "plugin:fs|remove") {
      files.delete(args.path);
      return null;
    }
    if (cmd === "plugin:fs|read_text_file") {
      const text = files.get(args.path);
      if (text === undefined) throw new Error(`file missing: ${args.path}`);
      return Array.from(new TextEncoder().encode(text));
    }
    if (cmd === "plugin:fs|write_text_file") {
      const path = decodeURIComponent(options.headers.path);
      files.set(path, new TextDecoder().decode(Uint8Array.from(Object.values(args))));
      return null;
    }
    if (cmd === "plugin:http|fetch") {
      const rid = nextRid++;
      requests.set(rid, args.clientConfig);
      return rid;
    }
    if (cmd === "plugin:http|fetch_send") {
      const request = requests.get(args.rid);
      if (!request) throw new Error("HTTP request missing");
      if (s3 && new URL(request.url).hostname === "s3.example.test") {
        const url = new URL(request.url);
        const key = decodeURIComponent(url.pathname.replace(/^\/track3\/?/, ""));
        const method = request.method ?? "GET";
        const headers = Array.isArray(request.headers) ? Object.fromEntries(request.headers) : request.headers ?? {};
        let status = 200;
        let bytes = new Uint8Array();
        let responseHeaders: Record<string, string> = {};
        try {
          if (url.searchParams.get("list-type") === "2") {
            const page = await s3.listObjectsV2({
              prefix: url.searchParams.get("prefix") ?? undefined,
              continuationToken: url.searchParams.get("continuation-token") ?? undefined,
            });
            const xml = `<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>${!!page.nextContinuationToken}</IsTruncated>${page.objects.map((object) =>
              `<Contents><Key>${encodeURIComponent(object.key)}</Key><ETag>${object.etag.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}</ETag><Size>${object.size}</Size><LastModified>${object.lastModified}</LastModified></Contents>`).join("")}${page.nextContinuationToken ? `<NextContinuationToken>${page.nextContinuationToken}</NextContinuationToken>` : ""}</ListBucketResult>`;
            bytes = new TextEncoder().encode(xml);
            responseHeaders = { "content-type": "application/xml" };
          } else if (method === "PUT") {
            const result = await s3.putObject(key, Uint8Array.from(request.data ?? []), {
              ...(headers["if-match"] ? { ifMatch: headers["if-match"] } : {}),
              ...(headers["if-none-match"] === "*" ? { ifNoneMatch: "*" } : {}),
            });
            responseHeaders = { etag: result.etag };
          } else if (method === "GET") {
            const result = await s3.getObject(key);
            if (!result) status = 404;
            else {
              bytes = result.body;
              responseHeaders = { etag: result.etag };
            }
          } else if (method === "HEAD") {
            const result = await s3.headObject(key);
            if (!result) status = 404;
            else responseHeaders = { etag: result.etag, "content-length": String(result.size) };
          } else if (method === "DELETE") {
            await s3.deleteObject(key);
            status = 204;
          } else {
            status = 400;
          }
        } catch (error) {
          if (error instanceof S3Error) status = error.status;
          else throw error;
        }
        const rid = nextRid++;
        responses.set(rid, { bytes: Array.from(bytes), read: false });
        return { status, statusText: status < 300 ? "OK" : "Error", url: request.url, headers: responseHeaders, rid };
      }
      let contentType = "application/json";
      let body = "{}";
      if (request.url.endsWith("/api/license/isPro")) {
        body = '{"isPro":true}';
      } else if (request.url.endsWith("/api/license")) {
        const action = JSON.parse(new TextDecoder().decode(Uint8Array.from(request.data ?? []))).action;
        body = action === "subscription-plans"
          ? '{"plans":[{"planType":"monthly","currency":"usd","unitAmountCents":1299,"interval":"month"},{"planType":"yearly","currency":"usd","unitAmountCents":9999,"interval":"year"}]}'
          : '{"planType":"yearly","status":"active","currentPeriodEnd":"2026-12-01T00:00:00.000Z","cancelAtPeriodEnd":false,"isLegacy":false}';
      } else if (request.url.endsWith("/api/coins/price")) {
        body = '{"data":{"BTC":42000,"USDT":1}}';
      } else if (request.url.endsWith("/api/coins/listStableCoins")) {
        body = '{"data":[{"symbol":"USDT"},{"symbol":"USDC"}]}';
      } else if (request.url.endsWith("/chat/completions")) {
        const input = JSON.parse(new TextDecoder().decode(Uint8Array.from(request.data ?? [])));
        if (input.stream === true) {
          const setupQuestion = JSON.stringify(input.messages).includes("Set BTC 40%, ETH 30%, USDT 30%");
          const portfolioQuestion = richPortfolio && JSON.stringify(input.messages).includes("How is my portfolio doing?");
          const afterProposal = input.messages.some((message: { role: string }) => message.role === "tool");
          if (request.url !== "https://assistant.test/v1/chat/completions"
            || input.model !== "test-model"
            || (!JSON.stringify(input.messages).includes("Say hello") && !setupQuestion && !portfolioQuestion)) {
            throw new Error("unexpected assistant request");
          }
          sseCalls++;
          contentType = "text/event-stream";
          body = setupQuestion ? [
            afterProposal
              ? `data: ${JSON.stringify({ choices: [{ delta: { content: "Review the target change above." } }] })}`
              : `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{
                index: 0, id: "setup-targets", type: "function",
                function: { name: "propose_action", arguments: JSON.stringify({
                  action: "save_rebalance_targets",
                  args: { targets: [
                    { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 40 },
                    { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 30 },
                    { kind: "asset", assetType: "crypto", symbol: "USDT", percent: 30 },
                  ], tolerancePercent: 0 },
                }) },
              }] } }] })}`,
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
            "data: [DONE]",
            "",
          ].join("\n\n") : [
            ...portfolioQuestion ? [] : ['data: {"choices":[{"delta":{"reasoning_content":"Let me think"}}]}'],
            `data: ${JSON.stringify({ choices: [{ delta: { content: portfolioQuestion
              ? "**Portfolio check**\n\nYour seven holdings have climbed over the past two months, with a few pullbacks along the way.\n\n- **Largest position:** Bitcoin remains the anchor.\n- **Positive contributor:** AAPL is above its cost basis.\n- **Watch closely:** ETH is below its cost basis.\n\nOpen Analytics for the full return breakdown."
              : "Hello from SSE" } }] })}`,
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
            "data: [DONE]",
            "",
          ].join("\n\n");
        } else {
          const isToolActivityPlan = slowAssistant
            && input.messages.some((message: { content?: string }) => message.content?.includes("portfolio-analysis planner"))
            && input.messages.some((message: { content?: string }) => message.content?.includes("Show my tool activity"));
          if (slowAssistant && !isToolActivityPlan
            && input.messages.some((message: { content?: string }) => message.content?.includes("Show my tool activity"))) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          body = JSON.stringify({
            choices: [{ message: { content: isToolActivityPlan ? JSON.stringify({
              complexity: "multi",
              reasoning: "Read holdings and portfolio value",
              tasks: [
                { id: "t1", skillName: "asset_snapshot", args: {}, description: "Read holdings", dependsOn: [] },
                { id: "t2", skillName: "portfolio_value", args: {}, description: "Check total value", dependsOn: [] },
              ],
              requiresRefinement: false,
              maxOptimizerRounds: 0,
            }) : "Your portfolio is ready to explore." } }],
          });
        }
      }
      const rid = nextRid++;
      const response = { bytes: Array.from(new TextEncoder().encode(body)), read: false, chunks: undefined as number[][] | undefined, chunkIndex: 0 };
      if (slowAssistant && contentType === "text/event-stream" && (body.includes("Hello from SSE") || body.includes("Portfolio check"))) {
        const split = body.indexOf('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}');
        response.chunks = [
          Array.from(new TextEncoder().encode(body.slice(0, split))),
          Array.from(new TextEncoder().encode(body.slice(split))),
        ];
      }
      responses.set(rid, response);
      return {
        status: 200, statusText: "OK", url: request.url,
        headers: { "content-type": contentType }, rid,
      };
    }
    if (cmd === "plugin:http|fetch_read_body") {
      const response = responses.get(args.rid);
      if (!response || response.read) return [1];
      if (response.chunks) {
        const chunkIndex = response.chunkIndex ?? 0;
        if (chunkIndex >= response.chunks.length) {
          response.read = true;
          return [1];
        }
        if (chunkIndex === 1) await new Promise((resolve) => setTimeout(resolve, 1000));
        response.chunkIndex = chunkIndex + 1;
        return [...response.chunks[chunkIndex], 0];
      }
      response.read = true;
      return [...response.bytes, 0];
    }
    if (cmd === "plugin:http|fetch_cancel_body" || cmd === "plugin:http|fetch_cancel") return null;
    throw new Error(`Unhandled Tauri command: ${cmd}`);
  });
  await page.addInitScript((withLogos: boolean) => {
    let callbackId = 0;
    const callbacks = new Map<number, Function>();
    (window as any).isTauri = true;
    (window as any).__TAURI_INTERNALS__ = {
      invoke: (cmd: string, args: unknown, options: unknown) =>
        (window as any).__e2eInvoke(cmd, args, options),
      transformCallback: (callback: Function) => {
        const id = ++callbackId;
        callbacks.set(id, callback);
        (window as any)[`_${id}`] = callback;
        return id;
      },
      unregisterCallback: (id: number) => {
        callbacks.delete(id);
        delete (window as any)[`_${id}`];
      },
      convertFileSrc: (path: string) => {
        if (!withLogos) return path;
        const symbol = path.match(/\/assets\/coins\/([a-z]+)\.png$/)?.[1];
        if (!symbol) return path;
        const colors: Record<string, string> = {
          btc: "#f7931a", eth: "#62688f", sol: "#0f827b",
          usdc: "#2775ca", avax: "#e84142", link: "#315cbe",
        };
        const glyphs: Record<string, string> = { btc: "₿", eth: "Ξ", sol: "S", usdc: "$", avax: "A", link: "L" };
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="${colors[symbol] ?? "#315cbe"}"/>
          <text x="20" y="27" text-anchor="middle" fill="white" font-family="-apple-system,system-ui" font-size="22" font-weight="700">${glyphs[symbol] ?? symbol[0].toUpperCase()}</text>
        </svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
      },
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    };
  }, richPortfolio);
  return { persistedRefreshes: () => refreshes, sseRequests: () => sseCalls, haptics: () => haptics, shares: () => shares };
}
