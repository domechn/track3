import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: mocks.load,
  },
}));

const databaseUrl =
  "sqlite:/Users/test/Library/Application%20Support/com.track3/track3.db";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.resetModules();
  mocks.invoke.mockReset();
  mocks.load.mockReset();
});

describe("database lifecycle", () => {
  it("single-flights concurrent database loads using the absolute backend URL", async () => {
    const database = {
      execute: vi.fn(),
      select: vi.fn(),
    };
    const load = deferred<typeof database>();
    mocks.invoke.mockResolvedValue(databaseUrl);
    mocks.load.mockReturnValue(load.promise);

    const { getDatabase } = await import("./database");
    const firstLoad = getDatabase();
    const secondLoad = getDatabase();

    await Promise.resolve();
    const invokeCallsBeforeResolution = mocks.invoke.mock.calls.length;
    const loadCallsBeforeResolution = mocks.load.mock.calls.length;
    load.resolve(database);
    const [firstDatabase, secondDatabase] = await Promise.all([
      firstLoad,
      secondLoad,
    ]);

    expect(invokeCallsBeforeResolution).toBe(1);
    expect(loadCallsBeforeResolution).toBe(1);
    expect(mocks.invoke).toHaveBeenCalledWith("get_database_url");
    expect(mocks.load).toHaveBeenCalledWith(databaseUrl);
    expect(firstDatabase).toBe(database);
    expect(secondDatabase).toBe(database);
  });

  it("serializes execute and INSERT RETURNING writes through one queue", async () => {
    const firstWrite = deferred<{ rowsAffected: number }>();
    const firstWriteStarted = deferred<void>();
    const order: string[] = [];
    const database = {
      execute: vi.fn(() => {
        order.push("execute");
        firstWriteStarted.resolve();
        return firstWrite.promise;
      }),
      select: vi.fn(async () => {
        order.push("select");
        return [{ id: "asset-1", symbol: "BTC" }];
      }),
    };
    mocks.invoke.mockResolvedValue(databaseUrl);
    mocks.load.mockResolvedValue(database);

    const { executeWrite, getDatabase, saveModelsToDatabase } =
      await import("./database");
    await getDatabase();

    const executeResult = executeWrite("UPDATE assets_v2 SET symbol=?", [
      "ETH",
    ]);
    const insertResult = saveModelsToDatabase("assets_v2", [
      { id: "asset-1", symbol: "BTC" },
    ]);

    await firstWriteStarted.promise;
    const insertCallsBeforeRelease = database.select.mock.calls.length;
    firstWrite.resolve({ rowsAffected: 1 });
    const [updated, inserted] = await Promise.all([
      executeResult,
      insertResult,
    ]);

    expect(insertCallsBeforeRelease).toBe(0);
    expect(order).toEqual(["execute", "select"]);
    expect(updated).toEqual({ rowsAffected: 1 });
    expect(inserted).toEqual([{ id: "asset-1", symbol: "BTC" }]);
    expect(database.select).toHaveBeenCalledWith(
      "INSERT OR REPLACE INTO assets_v2 (id,symbol) VALUES (?,?) RETURNING *",
      ["asset-1", "BTC"],
    );
  });

  it("continues the write queue after an earlier write rejects", async () => {
    const failure = new Error("write failed");
    const firstWrite = deferred<{ rowsAffected: number }>();
    const firstWriteStarted = deferred<void>();
    const database = {
      execute: vi.fn(() => {
        firstWriteStarted.resolve();
        return firstWrite.promise;
      }),
      select: vi.fn(async () => [{ id: "asset-2", symbol: "ETH" }]),
    };
    mocks.invoke.mockResolvedValue(databaseUrl);
    mocks.load.mockResolvedValue(database);

    const { executeWrite, getDatabase, saveModelsToDatabase } =
      await import("./database");
    await getDatabase();

    const rejectedWrite = executeWrite("UPDATE assets_v2 SET symbol=?", [
      "BTC",
    ]).catch((error) => error);
    const queuedWrite = saveModelsToDatabase("assets_v2", [
      { id: "asset-2", symbol: "ETH" },
    ]);

    await firstWriteStarted.promise;
    const queuedCallsBeforeRejection = database.select.mock.calls.length;
    firstWrite.reject(failure);
    const [writeError, inserted] = await Promise.all([
      rejectedWrite,
      queuedWrite,
    ]);

    expect(queuedCallsBeforeRejection).toBe(0);
    expect(writeError).toBe(failure);
    expect(inserted).toEqual([{ id: "asset-2", symbol: "ETH" }]);
    expect(database.select).toHaveBeenCalledTimes(1);
  });

  it("keeps ordinary writes and imports behind a multi-step refresh work barrier", async () => {
    const refreshCanPersist = deferred<void>();
    const refreshReadBaseline = deferred<void>();
    const order: string[] = [];
    const database = {
      execute: vi.fn(async () => {
        order.push("ordinary-write");
        return { rowsAffected: 1 };
      }),
      select: vi.fn(async (sql: string) => {
        order.push(sql);
        return [];
      }),
    };
    mocks.invoke.mockResolvedValue(databaseUrl);
    mocks.load.mockResolvedValue(database);

    const { executeWrite, executeWriteWork, getDatabase } =
      await import("./database");
    await getDatabase();

    const refresh = executeWriteWork(async (db) => {
      await db.select("refresh-baseline", []);
      refreshReadBaseline.resolve();
      await refreshCanPersist.promise;
      order.push("refresh-persist");
    });
    await refreshReadBaseline.promise;

    const ordinaryWrite = executeWrite("ordinary", []);
    const historicalImport = executeWriteWork(async (db) => {
      await db.select("import-assets", []);
      await db.select("import-transactions", []);
    });
    await Promise.resolve();

    expect(order).toEqual(["refresh-baseline"]);

    refreshCanPersist.resolve();
    await Promise.all([refresh, ordinaryWrite, historicalImport]);

    expect(order).toEqual([
      "refresh-baseline",
      "refresh-persist",
      "ordinary-write",
      "import-assets",
      "import-transactions",
    ]);
  });

  it.each([
    ["is absent", []],
    ["has no created_at column", [{ name: "operation_uuid" }]],
  ])(
    "returns no committed refresh timestamp when the marker table %s",
    async (_scenario, markerColumns) => {
      const database = {
        execute: vi.fn(),
        select: vi.fn().mockResolvedValue(markerColumns),
      };
      mocks.invoke.mockResolvedValue(databaseUrl);
      mocks.load.mockResolvedValue(database);

      const { getLatestCommittedRefreshCreatedAt } =
        await import("./database");

      await expect(getLatestCommittedRefreshCreatedAt()).resolves.toBeUndefined();
      expect(database.select).toHaveBeenCalledTimes(1);
      expect(database.select).toHaveBeenCalledWith(
        "SELECT name FROM pragma_table_info('refresh_operations')",
        [],
      );
    },
  );

  it("reads the latest committed refresh timestamp from persisted markers", async () => {
    const database = {
      execute: vi.fn(),
      select: vi
        .fn()
        .mockResolvedValueOnce([
          { name: "operation_uuid" },
          { name: "created_at" },
          { name: "payload_digest" },
        ])
        .mockResolvedValueOnce([
          { createdAt: "2026-07-15T00:00:00.123Z" },
        ]),
    };
    mocks.invoke.mockResolvedValue(databaseUrl);
    mocks.load.mockResolvedValue(database);

    const { getLatestCommittedRefreshCreatedAt } =
      await import("./database");

    await expect(getLatestCommittedRefreshCreatedAt()).resolves.toBe(
      "2026-07-15T00:00:00.123Z",
    );
    expect(database.select).toHaveBeenNthCalledWith(
      2,
      "SELECT MAX(created_at) AS createdAt FROM refresh_operations",
      [],
    );
  });

  it("retries database loading after a load failure", async () => {
    const failure = new Error("load failed");
    const database = {
      execute: vi.fn(),
      select: vi.fn(),
    };
    mocks.invoke.mockResolvedValue(databaseUrl);
    mocks.load.mockRejectedValueOnce(failure).mockResolvedValueOnce(database);

    const { getDatabase } = await import("./database");

    await expect(getDatabase()).rejects.toBe(failure);
    await expect(getDatabase()).resolves.toBe(database);

    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(mocks.load).toHaveBeenNthCalledWith(1, databaseUrl);
    expect(mocks.load).toHaveBeenNthCalledWith(2, databaseUrl);
  });
});
