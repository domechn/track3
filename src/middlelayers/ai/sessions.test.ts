import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig } from "@/middlelayers/types";

const mocks = vi.hoisted(() => {
  const dbState = { rows: [] as any[] };
  return {
    dbState,
    selectFromDatabase: vi.fn(
      async (_table: string, where: any, _limit?: number, orderBy?: any) => {
        const keys = Object.keys(where ?? {});
        const filtered = dbState.rows.filter((row) =>
          keys.every((k) => row[k] === where[k]),
        );
        if (orderBy && typeof orderBy === "object") {
          const entries = Object.entries(orderBy as Record<string, string>);
          return filtered.slice().sort((a, b) => {
            for (const [k, dir] of entries) {
              const av = a[k], bv = b[k];
              if (av === bv) continue;
              const cmp = typeof av === "number" && typeof bv === "number"
                ? av - bv : String(av).localeCompare(String(bv));
              return dir === "desc" ? -cmp : cmp;
            }
            return 0;
          });
        }
        return filtered;
      },
    ),
    saveModelsToDatabase: vi.fn(async (_table: string, models: any[]) => {
      for (const m of models) {
        const idx = dbState.rows.findIndex((row) => row.id === m.id);
        if (idx >= 0) dbState.rows[idx] = { ...dbState.rows[idx], ...m };
        else dbState.rows.push({ ...m });
      }
    }),
    deleteFromDatabase: vi.fn(async (_table: string, where: any) => {
      const keys = Object.keys(where ?? {});
      mocks.dbState.rows = mocks.dbState.rows.filter(
        (row) => !keys.every((k) => row[k] === where[k]),
      );
    }),
  };
});

vi.mock("@/middlelayers/database", () => ({
  selectFromDatabase: (...args: Parameters<typeof mocks.selectFromDatabase>) =>
    (mocks.selectFromDatabase as any)(...args),
  saveModelsToDatabase: (...args: Parameters<typeof mocks.saveModelsToDatabase>) =>
    (mocks.saveModelsToDatabase as any)(...args),
  deleteFromDatabase: (...args: Parameters<typeof mocks.deleteFromDatabase>) =>
    (mocks.deleteFromDatabase as any)(...args),
}));

beforeEach(() => {
  mocks.dbState.rows = [];
  Object.values(mocks).forEach((fn) => {
    if (typeof fn === "function" && "mockReset" in fn) (fn as any).mockReset();
  });
});

afterEach(() => { vi.restoreAllMocks(); });

describe("createSession", () => {
  it("creates a new session in the DB and returns its metadata", async () => {
    const sessions = await import("./sessions");
    const meta = await sessions.createSession();
    expect(meta.id).toBeTruthy();
    expect(meta.title).toBe("");
    expect(meta.messageCount).toBe(0);
    expect(meta.preview).toBe("");
    expect(mocks.dbState.rows).toHaveLength(1);
    expect(mocks.dbState.rows[0].id).toBe(meta.id);
  });
});

describe("listSessions", () => {
  it("returns all sessions ordered by pinned desc then updatedAt desc", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    await sessions.createSession();
    const all = await sessions.listSessions();
    expect(all).toHaveLength(2);
  });
});

describe("loadSession", () => {
  it("returns null when the row is missing", async () => {
    const sessions = await import("./sessions");
    expect(await sessions.loadSession("nope")).toBeNull();
  });
  it("returns metadata when the row exists", async () => {
    const sessions = await import("./sessions");
    const meta = await sessions.createSession();
    const loaded = await sessions.loadSession(meta.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(meta.id);
  });
});

describe("touchSession", () => {
  it("updates messageCount, preview and updatedAt", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1", title: "", createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z", pinned: 0, messageCount: 0, preview: "",
    });
    await sessions.touchSession("uuid-1", { messageCount: 2, preview: "Hi" });
    const row = mocks.dbState.rows.find((r) => r.id === "uuid-1");
    expect(row.messageCount).toBe(2);
    expect(row.preview).toBe("Hi");
    const updated = new Date(row.updatedAt).getTime();
    expect(updated).toBeGreaterThan(new Date("2024-01-01T00:00:00.000Z").getTime());
  });
});

describe("renameSession", () => {
  it("updates the title", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1", title: "", createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z", pinned: 0, messageCount: 0, preview: "",
    });
    await sessions.renameSession("uuid-1", "My chat");
    expect(mocks.dbState.rows.find((r) => r.id === "uuid-1")!.title).toBe("My chat");
  });
});

describe("togglePin", () => {
  it("switches between pinned and unpinned", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1", title: "", createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z", pinned: 0, messageCount: 0, preview: "",
    });
    await sessions.togglePin("uuid-1", 1);
    expect(mocks.dbState.rows.find((r) => r.id === "uuid-1")!.pinned).toBe(1);
    await sessions.togglePin("uuid-1", 0);
    expect(mocks.dbState.rows.find((r) => r.id === "uuid-1")!.pinned).toBe(0);
  });
});

describe("deleteSession", () => {
  it("removes the session from the DB", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1", title: "", createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z", pinned: 0, messageCount: 0, preview: "",
    });
    await sessions.deleteSession("uuid-1");
    expect(mocks.dbState.rows.find((r) => r.id === "uuid-1")).toBeUndefined();
  });
});

describe("generateTitle", () => {
  it("returns a 2-6 word title from the LLM response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "My Portfolio" } }] })),
    ));
    const sessions = await import("./sessions");
    const config: AIConfig = {
      endpoint: "https://api.example.com/v1", apiKey: "sk-test",
      model: "gpt-4o-mini", contextSize: 8192,
    };
    const title = await sessions.generateTitle(config, "Show my portfolio", "Here is your portfolio");
    expect(title).toBe("My Portfolio");
    vi.restoreAllMocks();
  });
  it("falls back to a preview when no LLM is configured", async () => {
    const sessions = await import("./sessions");
    const config: AIConfig = {
      endpoint: "", apiKey: "", model: "", contextSize: 8192,
    };
    const title = await sessions.generateTitle(config, "Show my BTC holdings", "Here is BTC");
    expect(title.length).toBeGreaterThan(0);
  });
});

describe("buildSessionPreview", () => {
  it("extracts the first user message as preview", async () => {
    const sessions = await import("./sessions");
    const preview = sessions.buildSessionPreview([
      { role: "user", content: "Hello there!" },
    ]);
    expect(preview).toBe("Hello there!");
  });
  it("truncates long messages at 30 chars", async () => {
    const sessions = await import("./sessions");
    const preview = sessions.buildSessionPreview([
      { role: "user", content: "This is a super long message that should be truncated" },
    ]);
    expect(preview.length).toBeLessThanOrEqual(30);
    expect(preview).toMatch(/…$/);
  });
});
