import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import initSqlJs from "sql.js";
import { FakeS3, S3Error } from "../../src/middlelayers/sync/object-store";

const schemaFiles = [
  "assets_v2", "asset_prices", "transactions", "chat_sessions",
  "currency_rates", "configuration",
];

export async function installTauriBridge(page: Page, s3?: FakeS3, seedReviewContent = false) {
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
  db.run(readFileSync(resolve("src-tauri/migrations/v08t09/alerts_up.sql"), "utf8"));
  db.run(readFileSync(resolve("src-tauri/migrations/v08t09/sync_state_up.sql"), "utf8"));
  const config = JSON.stringify({
    endpoint: "https://assistant.test/v1",
    apiKey: "sk-e2e",
    model: "test-model",
    contextSize: 8192,
  });
  const files = new Map<string, string>();
  const requests = new Map<number, { url: string; method?: string; headers?: Record<string, string> | [string, string][]; data?: number[] }>();
  const responses = new Map<number, { bytes: number[]; read: boolean }>();
  let nextRid = 1;
  let refreshes = 0;
  let sseCalls = 0;

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
    if (cmd === "plugin:sql|load") return args.db;
    if (cmd === "plugin:sql|select") return select(args.query, args.values);
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
    if (cmd === "plugin:path|resolve_directory") return "/e2e/app";
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
    if (cmd === "plugin:fs|exists") return files.has(args.path);
    if (cmd === "plugin:fs|mkdir") return null;
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
      } else if (request.url.endsWith("/chat/completions")) {
        const input = JSON.parse(new TextDecoder().decode(Uint8Array.from(request.data ?? [])));
        if (input.stream === true) {
          const setupQuestion = JSON.stringify(input.messages).includes("Set BTC 40%, ETH 30%, USDT 30%");
          const afterProposal = input.messages.some((message: { role: string }) => message.role === "tool");
          if (request.url !== "https://assistant.test/v1/chat/completions"
            || input.model !== "test-model"
            || (!JSON.stringify(input.messages).includes("Say hello") && !setupQuestion)) {
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
            'data: {"choices":[{"delta":{"reasoning_content":"Let me think"}}]}',
            'data: {"choices":[{"delta":{"content":"Hello from SSE"}}]}',
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
            "data: [DONE]",
            "",
          ].join("\n\n");
        } else {
          body = '{"choices":[{"message":{"content":"Greeting"}}]}';
        }
      }
      const rid = nextRid++;
      responses.set(rid, { bytes: Array.from(new TextEncoder().encode(body)), read: false });
      return {
        status: 200, statusText: "OK", url: request.url,
        headers: { "content-type": contentType }, rid,
      };
    }
    if (cmd === "plugin:http|fetch_read_body") {
      const response = responses.get(args.rid);
      if (!response || response.read) return [1];
      response.read = true;
      return [...response.bytes, 0];
    }
    if (cmd === "plugin:http|fetch_cancel_body" || cmd === "plugin:http|fetch_cancel") return null;
    throw new Error(`Unhandled Tauri command: ${cmd}`);
  });
  await page.addInitScript(() => {
    let callbackId = 0;
    const callbacks = new Map<number, Function>();
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
      convertFileSrc: (path: string) => path,
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
    };
  });
  return { persistedRefreshes: () => refreshes, sseRequests: () => sseCalls };
}
