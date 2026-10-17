import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase } from "./database";
import { getStableCoins, loadAIConfig, loadInsightCardData, saveInsightCardData } from "./configuration";
import { listAlertHistory, listAlertRules } from "./alerts";
import { getRebalanceProfile } from "./rebalance";
import { dismissInsight, loadInsightCard, refreshInsights } from "./insights-service";

vi.mock("./database", () => ({ getDatabase: vi.fn() }));
vi.mock("./configuration", async (importOriginal) => ({
  ...await importOriginal<typeof import("./configuration")>(),
  getStableCoins: vi.fn(), loadAIConfig: vi.fn(), loadInsightCardData: vi.fn(), saveInsightCardData: vi.fn(),
}));
vi.mock("./alerts", async (importOriginal) => ({
  ...await importOriginal<typeof import("./alerts")>(), listAlertRules: vi.fn(), listAlertHistory: vi.fn(),
}));
vi.mock("./rebalance", async (importOriginal) => ({
  ...await importOriginal<typeof import("./rebalance")>(), getRebalanceProfile: vi.fn(),
}));

let stored: string | undefined;

beforeEach(() => {
  stored = undefined;
  vi.mocked(loadInsightCardData).mockImplementation(async () => stored);
  vi.mocked(saveInsightCardData).mockImplementation(async (data) => { stored = data; });
  vi.mocked(getStableCoins).mockResolvedValue([]);
  vi.mocked(listAlertRules).mockResolvedValue([]);
  vi.mocked(listAlertHistory).mockResolvedValue([]);
  vi.mocked(getRebalanceProfile).mockResolvedValue(undefined);
  vi.mocked(loadAIConfig).mockResolvedValue({ proactiveInsightsSummary: false } as never);
});

describe("refreshInsights", () => {
  it("retains a dismissal through small price changes and hides repeated findings across refreshes", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run("CREATE TABLE assets_v2 (id INTEGER PRIMARY KEY, uuid TEXT, createdAt TEXT, asset_type TEXT, symbol TEXT, value REAL, amount REAL, price REAL)");
    const insert = db.prepare("INSERT INTO assets_v2 (uuid, createdAt, asset_type, symbol, value, amount, price) VALUES (?, ?, 'crypto', ?, ?, 1, 1)");
    const add = (uuid: string, at: string, btc: number) => {
      insert.run([uuid, at, "BTC", btc]);
      insert.run([uuid, at, "ETH", 1000 - btc]);
    };
    add("first", "2024-02-01T12:00:00.000Z", 700);
    vi.mocked(getDatabase).mockResolvedValue({
      select: async (sql: string, values: unknown[] = []) => {
        const stmt = db.prepare(sql);
        stmt.bind(values as (string | number)[]);
        const rows: object[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
    } as never);
    const stale = [{ sourceId: "wallet:0", label: "Wallet", status: "stale" as const }];
    await refreshInsights(stale);
    expect((await loadInsightCard())?.insights.map((item) => item.id)).toEqual(["stale", "concentration"]);
    await dismissInsight("concentration");
    add("second", "2024-02-01T13:00:00.000Z", 700.3);
    await refreshInsights(stale);
    const second = await loadInsightCard();
    expect(second?.dismissedIds).toContain("concentration");
    expect(second?.repeatedIds).toContain("stale");
    expect(second?.insights.filter((item) =>
      !second.dismissedIds.includes(item.id) && !second.repeatedIds?.includes(item.id))).toEqual([]);
    add("third", "2024-02-01T14:00:00.000Z", 700.4);
    await refreshInsights(stale);
    expect((await loadInsightCard())?.repeatedIds).toContain("stale");
    insert.free();
    db.close();
  });
});
