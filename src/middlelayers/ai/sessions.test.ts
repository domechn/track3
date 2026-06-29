import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIConfig } from "@/middlelayers/types";

const mocks = vi.hoisted(() => {
  const dbState = {
    rows: [] as any[],
  };
  return {
    dbState,
    invoke: vi.fn(),
    mkdir: vi.fn(),
    writeTextFile: vi.fn(),
     readTextFile: vi.fn(),
     remove: vi.fn(),
     exists: vi.fn(),
    fetch: vi.fn(),
    appDataDir: vi.fn(),
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
              const av = a[k];
              const bv = b[k];
              if (av === bv) continue;
              const cmp =
                typeof av === "number" && typeof bv === "number"
                  ? av - bv
                  : String(av).localeCompare(String(bv));
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
        if (idx >= 0) {
          dbState.rows[idx] = { ...dbState.rows[idx], ...m };
        } else {
          dbState.rows.push({ ...m });
        }
      }
      return models;
    }),
    deleteFromDatabase: vi.fn(async (_table: string, where: any) => {
      const keys = Object.keys(where ?? {});
      const before = dbState.rows.length;
      dbState.rows = dbState.rows.filter(
        (row) => !keys.every((k) => row[k] === where[k]),
      );
      return { rowsAffected: before - dbState.rows.length };
    }),
    uuidV4: vi.fn(() => "uuid-1"),
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: mocks.fetch,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  mkdir: mocks.mkdir,
  writeTextFile: mocks.writeTextFile,
  readTextFile: mocks.readTextFile,
   remove: mocks.remove,
   exists: mocks.exists,
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: mocks.appDataDir,
}));

vi.mock("@/middlelayers/database", async () => {
  const actual =
    await vi.importActual<typeof import("@/middlelayers/database")>(
      "@/middlelayers/database",
    );
  return {
    ...actual,
    selectFromDatabase: mocks.selectFromDatabase,
    saveModelsToDatabase: mocks.saveModelsToDatabase,
    deleteFromDatabase: mocks.deleteFromDatabase,
  };
});

vi.mock("uuid", () => ({
  v4: mocks.uuidV4,
}));

const fsFileMap = new Map<string, string>();

beforeEach(() => {
  mocks.dbState.rows.length = 0;
  fsFileMap.clear();
  mocks.invoke.mockReset();
  mocks.mkdir.mockReset();
  mocks.writeTextFile.mockReset();
  mocks.readTextFile.mockReset();
   mocks.remove.mockReset();
  mocks.exists.mockReset();
  mocks.appDataDir.mockReset();
  mocks.uuidV4.mockReset();
  mocks.fetch.mockReset();

  mocks.appDataDir.mockResolvedValue("/appdata");
  mocks.mkdir.mockResolvedValue(undefined);

  // encrypt: store encrypted content into the in-memory file map
  mocks.invoke.mockImplementation(async (cmd: string, args: any) => {
    if (cmd === "encrypt") {
      return `enc:${args.data}`;
    }
    if (cmd === "decrypt") {
      const raw = String(args.data);
      if (!raw.startsWith("enc:")) {
        throw new Error("not ent: bad payload");
      }
      return raw.slice(4);
    }
    throw new Error(`unknown command: ${cmd}`);
  });

  mocks.writeTextFile.mockImplementation(async (path: string, data: string) => {
    fsFileMap.set(path, data);
  });
  mocks.readTextFile.mockImplementation(async (path: string) => {
    const v = fsFileMap.get(path);
    if (v === undefined) {
      throw new Error(`ENOENT: ${path}`);
    }
    return v;
  });
   mocks.remove.mockImplementation(async (path: string) => {
     fsFileMap.delete(path);
   });
  mocks.exists.mockImplementation(async (path: string) => fsFileMap.has(path));

  mocks.uuidV4.mockReturnValue("uuid-1");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chat sessions middlelayer", () => {
  it("creates a session and persists it to the DB without writing a file", async () => {
    const sessions = await import("./sessions");
    const meta = await sessions.createSession();
    expect(meta.id).toBe("uuid-1");
    expect(meta.title).toBe("");
    expect(meta.pinned).toBe(0);
    expect(meta.messageCount).toBe(0);
    expect(meta.preview).toBe("");
    expect(mocks.dbState.rows).toHaveLength(1);
    expect(mocks.writeTextFile).not.toHaveBeenCalled();
  });

  it("lists sessions sorted by pinned DESC then updatedAt DESC", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push(
      {
        id: "a",
        title: "old",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        pinned: 0,
        messageCount: 0,
        preview: "",
      },
      {
        id: "b",
        title: "pinned",
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-03T00:00:00.000Z",
        pinned: 1,
        messageCount: 0,
        preview: "",
      },
      {
        id: "c",
        title: "recent",
        createdAt: "2024-01-04T00:00:00.000Z",
        updatedAt: "2024-01-05T00:00:00.000Z",
        pinned: 0,
        messageCount: 0,
        preview: "",
      },
    );

    const list = await sessions.listSessions();
    expect(list.map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("returns null from loadSession when the DB row is missing", async () => {
    const sessions = await import("./sessions");
    const loaded = await sessions.loadSession("missing");
    expect(loaded).toBeNull();
  });

  it("returns null from loadSession when the file is missing", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1",
      title: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      pinned: 0,
      messageCount: 0,
      preview: "",
    });
    const loaded = await sessions.loadSession("uuid-1");
    expect(loaded).toBeNull();
  });

  it("propagates decrypt errors from loadSession", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1",
      title: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      pinned: 0,
      messageCount: 0,
      preview: "",
    });
    fsFileMap.set(
      "/appdata/ai/sessions/uuid-1.json.ent",
      "enc:{\"version\":1,\"messages\":[]}",
    );
    mocks.invoke.mockImplementationOnce(async () => {
      throw new Error("decrypt failed");
    });
    await expect(sessions.loadSession("uuid-1")).rejects.toThrow(/decrypt/);
  });

  it("touchSession updates messageCount, preview and updatedAt", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1",
      title: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      pinned: 0,
      messageCount: 0,
      preview: "",
    });
    await sessions.touchSession("uuid-1", {
      messageCount: 2,
      preview: "Hi",
    });
    const row = mocks.dbState.rows.find((r) => r.id === "uuid-1");
    expect(row.messageCount).toBe(2);
    expect(row.preview).toBe("Hi");
    expect(new Date(row.updatedAt).getTime()).toBeGreaterThan(
      new Date("2024-01-01T00:00:00.000Z").getTime(),
    );
  });

  it("renameSession updates the title", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1",
      title: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      pinned: 0,
      messageCount: 0,
      preview: "",
    });
    await sessions.renameSession("uuid-1", "My chat");
    const row = mocks.dbState.rows.find((r) => r.id === "uuid-1");
    expect(row.title).toBe("My chat");
  });

  it("togglePin updates the pinned flag", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1",
      title: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      pinned: 0,
      messageCount: 0,
      preview: "",
    });
    await sessions.togglePin("uuid-1", 1);
    expect(mocks.dbState.rows.find((r) => r.id === "uuid-1").pinned).toBe(1);
    await sessions.togglePin("uuid-1", 0);
    expect(mocks.dbState.rows.find((r) => r.id === "uuid-1").pinned).toBe(0);
  });

  it("deleteSession removes the DB row and the file", async () => {
    const sessions = await import("./sessions");
    mocks.dbState.rows.push({
      id: "uuid-1",
      title: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      pinned: 0,
      messageCount: 0,
      preview: "",
    });
    fsFileMap.set("/appdata/ai/sessions/uuid-1.json.ent", "enc:{}");
    await sessions.deleteSession("uuid-1");
    expect(mocks.dbState.rows.find((r) => r.id === "uuid-1")).toBeUndefined();
    expect(fsFileMap.has("/appdata/ai/sessions/uuid-1.json.ent")).toBe(false);
  });

  it("appendMessages merges new messages with the existing file", async () => {
    const sessions = await import("./sessions");
    fsFileMap.set(
      "/appdata/ai/sessions/uuid-1.json.ent",
      "enc:" +
        JSON.stringify({
          version: 1,
          messages: [{ role: "user", content: "old" }],
        }),
    );
    mocks.exists.mockResolvedValue(true);
    await sessions.appendMessages("uuid-1", [
      {
        role: "assistant",
        blocks: [{ kind: "text", text: "new" }],
      },
    ]);
    const payload = fsFileMap.get("/appdata/ai/sessions/uuid-1.json.ent");
    expect(payload).toBeDefined();
    const decrypted = String(payload).slice(4);
    const parsed = JSON.parse(decrypted);
    expect(parsed.messages).toEqual([
      { role: "user", content: "old" },
      { role: "assistant", blocks: [{ kind: "text", text: "new" }] },
    ]);
  });

  it("appendMessages creates a new file when none exists", async () => {
    const sessions = await import("./sessions");
    mocks.exists.mockResolvedValue(false);
    await sessions.appendMessages("uuid-1", [
      { role: "user", content: "first" },
    ]);
    const payload = fsFileMap.get("/appdata/ai/sessions/uuid-1.json.ent");
    expect(payload).toBeDefined();
    const decrypted = String(payload).slice(4);
    const parsed = JSON.parse(decrypted);
    expect(parsed.messages).toEqual([{ role: "user", content: "first" }]);
  });

  it("generateTitle returns a 2-6 word title from the LLM response", async () => {
    const sessions = await import("./sessions");
    const config: AIConfig = {
      endpoint: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      contextSize: 1024,
    };
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: "Portfolio health snapshot" } },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ) as any,
    );
    const title = await sessions.generateTitle(
      config,
      "How healthy is my portfolio?",
      "Your portfolio is well diversified.",
    );
    expect(title).toBe("Portfolio health snapshot");
  });

  it("generateTitle falls back to a preview snippet on LLM failure", async () => {
    const sessions = await import("./sessions");
    const config: AIConfig = {
      endpoint: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      contextSize: 1024,
    };
    mocks.fetch.mockResolvedValue(
      new Response("boom", { status: 500 }) as any,
    );
    const title = await sessions.generateTitle(
      config,
      "How healthy is my portfolio overall?",
      "answer",
    );
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(30);
    expect(title.endsWith("…")).toBe(true);
  });
});
