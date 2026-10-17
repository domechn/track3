import { expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase, executeWrite } from "../database";
import { SqliteSyncRepository } from "./sqlite-repository";
import { getMemoryCacheInstance } from "../datafetch/utils/cache";
import { getPortfolioInputGeneration } from "../configuration";
import { getCachedPreferCurrency } from "../configuration";
import { configurationKey, syncCategory } from "./config-keys";
import { listSessions, loadSession } from "../ai/sessions";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../database", () => ({ getDatabase: vi.fn(), executeWrite: vi.fn() }));
vi.mock("../ai/sessions", () => ({
  listSessions: vi.fn(async () => []), loadSession: vi.fn(), saveSyncedSession: vi.fn(),
  stableSyncMessage: (_id: string, _createdAt: string, _index: number, message: unknown) => message,
}));

it("decrypts local secrets for the sync payload and reencrypts pulled secrets", async () => {
  vi.mocked(getDatabase).mockResolvedValue({
    select: async () => [{ id: 10, data: "!ent:local-ciphertext" }, { id: 7, data: "USD" }],
  } as never);
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "decrypt") return "exchange-key";
    if (command === "encrypt") return "!ent:other-ciphertext";
    throw new Error("Unexpected command");
  });
  const repo = new SqliteSyncRepository();
  expect((await repo.listConfig())["10"]).toBe("exchange-key");
  const before = getPortfolioInputGeneration();
  await repo.writeConfig("10", "remote-key");
  expect(vi.mocked(executeWrite).mock.calls.at(-1)?.[1]).toEqual([10, "!ent:other-ciphertext"]);
  expect(getPortfolioInputGeneration()).toBeGreaterThan(before);
});

it("invalidates cached fetch data after a pull changes local data", () => {
  const cache = getMemoryCacheInstance("data-fetch");
  cache.setCache("old", 1);
  new SqliteSyncRepository().dataChanged();
  expect(cache.getCache("old")).toBeUndefined();
});

it("omits prices left behind by a deleted asset row", async () => {
  vi.mocked(getDatabase).mockResolvedValue({
    select: async (sql: string) => sql.includes("assets_v2") ? [{ id: 2 }] :
      sql.includes("asset_prices") ? [{ assetID: 1 }, { assetID: 2 }] :
      [{ assetID: 1 }, { assetID: 2 }],
  } as never);
  const value = await new SqliteSyncRepository().readSnapshot("one");
  expect(value.prices).toEqual([{ assetID: 2 }]);
  expect(value.transactions).toEqual([{ assetID: 2 }]);
});

it("keeps refreshed stable coin cache local and updates the currency cache on pull", async () => {
  expect(syncCategory("996")).toBeUndefined();
  vi.mocked(executeWrite).mockResolvedValue(undefined as never);
  await new SqliteSyncRepository().writeConfig("7", "EUR");
  expect(getCachedPreferCurrency()).toBe("EUR");
  await new SqliteSyncRepository().writeConfig("7", null);
  expect(getCachedPreferCurrency()).toBeUndefined();
});

it("classifies syncable and local configuration IDs with their encryption flags", () => {
  expect(configurationKey("10")).toEqual({ category: "secrets", encrypted: true });
  expect(configurationKey("7")).toEqual({ category: "settings", encrypted: false });
  expect(configurationKey("997")).toEqual({ category: "local", encrypted: true });
  expect(configurationKey("999")).toEqual({ category: "local", encrypted: false });
  expect(configurationKey("rebalance")).toEqual({ category: "rebalance", encrypted: false });
});

it("skips an unreadable encrypted config row and keeps readable rows", async () => {
  vi.mocked(getDatabase).mockResolvedValue({
    select: async (sql: string) => sql.includes("configuration")
      ? [{ id: 10, data: "!ent:broken" }, { id: 7, data: "USD" }] : [],
  } as never);
  vi.mocked(invoke).mockRejectedValue(new Error("secret payload"));
  const repo = new SqliteSyncRepository();
  expect(await repo.listConfig()).toEqual({ "7": "USD" });
  expect(repo.takeReadErrors().configIds).toEqual(["10"]);
});

it("skips one corrupt SQLite-backed session and keeps the other sessions readable", async () => {
  vi.mocked(listSessions).mockResolvedValue([
    { id: "broken", title: "", createdAt: "2026-01-01", updatedAt: "2026-01-01", pinned: 0, messageCount: 0, preview: "" },
    { id: "good", title: "", createdAt: "2026-01-01", updatedAt: "2026-01-01", pinned: 0, messageCount: 0, preview: "" },
  ]);
  vi.mocked(loadSession).mockImplementation(async (id) => {
    if (id === "broken") throw new Error("corrupt encrypted file");
    return { id, title: "", createdAt: "2026-01-01", updatedAt: "2026-01-01", pinned: 0, messageCount: 0, preview: "", messages: [] };
  });
  const repo = new SqliteSyncRepository();
  expect((await repo.listSessions()).map((session) => session.id)).toEqual(["good"]);
  expect(repo.takeReadErrors().sessionIds).toEqual(["broken"]);
});

it("reuses unchanged sessions and reloads a changed session", async () => {
  const meta = { id: "chat", title: "Chat", createdAt: "2026-01-01", updatedAt: "2026-01-01", pinned: 0 as const, messageCount: 1, preview: "Hi" };
  vi.mocked(listSessions).mockResolvedValue([meta]);
  vi.mocked(loadSession).mockImplementation(async () => ({ ...meta, messages: [{ id: "m1", at: "2026-01-01", role: "user", content: "Hi" }] }));
  const repo = new SqliteSyncRepository();
  await repo.listSessions();
  vi.mocked(loadSession).mockClear();
  expect((await repo.listSessions())[0]?.messages).toHaveLength(1);
  expect(loadSession).not.toHaveBeenCalled();
  vi.mocked(listSessions).mockResolvedValue([{ ...meta, updatedAt: "2026-01-02", messageCount: 2 }]);
  await repo.listSessions();
  expect(loadSession).toHaveBeenCalledWith("chat");
});
