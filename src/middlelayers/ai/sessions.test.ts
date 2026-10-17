import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import md5 from "md5";

import type { AIConfig } from "@/middlelayers/types";
import { summaryOffset } from "./history";
import {
  resetEncryptionWriteGateForTests,
  runEncryptionKeyRotation,
  runWithEncryptionWriteGate,
} from "@/middlelayers/encryption-write-gate";

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
  resetEncryptionWriteGateForTests();
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
  it("claims a pending action once and preserves its audit result on reload", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    await sessions.appendMessages("uuid-1", [{
      role: "assistant", blocks: [{
        kind: "pending_action", id: "action-1", toolCallId: "call-1", name: "blacklist_add",
        args: { symbol: "BTC" }, preview: { before: "(empty)", after: "BTC" },
        risk: "low", status: "pending", createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      }],
    }]);
    expect(await sessions.claimSessionAction("uuid-1", "action-1", "executing")).toBe(true);
    expect(await sessions.claimSessionAction("uuid-1", "action-1", "executing")).toBe(false);
    await sessions.finishSessionAction("uuid-1", "action-1", "approved", "Added BTC");
    const loaded = await sessions.loadSession("uuid-1");
    expect(loaded?.messages[0]).toMatchObject({ blocks: [{ status: "approved", result: "Added BTC" }] });
  });
  it("advances session metadata when an action changes state", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    await sessions.appendMessages("uuid-1", [{ role: "assistant", blocks: [{
      kind: "pending_action", id: "action-1", toolCallId: "call-1", name: "blacklist_add",
      args: {}, preview: { before: "", after: "BTC" }, risk: "low", status: "pending",
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString(),
    }] }]);
    const before = (await sessions.listSessions())[0].updatedAt;
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(Date.parse(before) + 1000));
      expect(await sessions.claimSessionAction("uuid-1", "action-1", "executing")).toBe(true);
      const claimedAt = (await sessions.listSessions())[0].updatedAt;
      expect(Date.parse(claimedAt)).toBeGreaterThan(Date.parse(before));
      vi.setSystemTime(new Date(Date.parse(before) + 2000));
      await sessions.finishSessionAction("uuid-1", "action-1", "approved", "Done");
      expect(Date.parse((await sessions.listSessions())[0].updatedAt)).toBeGreaterThan(Date.parse(claimedAt));
    } finally {
      vi.useRealTimers();
    }
  });
  it("leaves an action pending when its session metadata is missing", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    await sessions.appendMessages("uuid-1", [{ role: "assistant", blocks: [{
      kind: "pending_action", id: "action-1", toolCallId: "call-1", name: "blacklist_add",
      args: {}, preview: { before: "", after: "BTC" }, risk: "low", status: "pending",
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString(),
    }] }]);
    mocks.dbState.rows.length = 0;
    await expect(sessions.claimSessionAction("uuid-1", "action-1", "executing"))
      .rejects.toThrow("Chat session metadata is missing");
    expect((await sessions.loadSession("uuid-1"))).toBeNull();
    const raw = fsFileMap.get("/appdata/ai/sessions/uuid-1.json.ent") ?? "";
    expect(raw).toContain('"status":"pending"');
  });
  it("does not make an approved action executable after saving a stale synced copy", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    await sessions.appendMessages("uuid-1", [{ role: "assistant", blocks: [{
      kind: "pending_action", id: "action-1", toolCallId: "call-1", name: "blacklist_add",
      args: {}, preview: { before: "", after: "BTC" }, risk: "low", status: "pending",
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString(),
    }] }]);
    const stale = (await sessions.loadSession("uuid-1"))!;
    expect(await sessions.claimSessionAction("uuid-1", "action-1", "executing")).toBe(true);
    await sessions.finishSessionAction("uuid-1", "action-1", "approved", "Done");
    await sessions.saveSyncedSession(stale);
    expect((await sessions.loadSession("uuid-1"))?.messages[0]).toMatchObject({
      blocks: [{ status: "approved", result: "Done" }],
    });
    expect(await sessions.claimSessionAction("uuid-1", "action-1", "executing")).toBe(false);
  });
  it("never writes configured secrets into a session payload or preview", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    await sessions.appendMessages("uuid-1", [
      { role: "user", content: "check custom-private-key" },
      { role: "assistant", blocks: [{ kind: "text", text: "sk-abcdefghijklmnop1234567890" }] },
    ], undefined, ["custom-private-key"]);
    const raw = fsFileMap.get("/appdata/ai/sessions/uuid-1.json.ent") ?? "";
    expect(raw).not.toContain("custom-private-key");
    expect(raw).not.toContain("sk-abcdefghijklmnop1234567890");
    expect((await sessions.listSessions())[0]?.preview).not.toContain("custom-private-key");
  });
  it("keeps a public address in a saved user message", async () => {
    const sessions = await import("./sessions");
    const address = "0x52908400098527886E0F7030069857D2E4169EE7";
    await sessions.createSession();
    await sessions.appendMessages("uuid-1", [{ role: "user", content: `Check ${address}` }]);
    expect((await sessions.loadSession("uuid-1"))?.messages[0]).toMatchObject({ role: "user", content: `Check ${address}` });
  });
  it("keeps a same-millisecond user and assistant batch in order after sync merge", async () => {
    const sessions = await import("./sessions");
    const { mergeSessions } = await import("../sync/engine");
    await sessions.createSession();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      await sessions.appendMessages("uuid-1", [
        { id: "z-user", role: "user", content: "Question" },
        { id: "a-assistant", role: "assistant", blocks: [{ kind: "text", text: "Answer" }] },
      ]);
      const local = (await sessions.loadSession("uuid-1"))!;
      const synced = {
        ...local,
        messages: local.messages.map((message) => ({ ...message, id: message.id!, at: message.at! })),
      };
      const merged = mergeSessions(synced, synced);
      expect(merged.messages.map((message) => message.id)).toEqual(["z-user", "a-assistant"]);
      await sessions.saveSyncedSession(local);
      expect((await sessions.loadSession("uuid-1"))?.messages.map((message) => message.id))
        .toEqual(["z-user", "a-assistant"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives new messages stable ids and actual append timestamps", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    const before = Date.now();
    await sessions.appendMessages("uuid-1", [{ role: "user", content: "Hi" }]);
    const first = (await sessions.loadSession("uuid-1"))!.messages[0];
    const second = (await sessions.loadSession("uuid-1"))!.messages[0];
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.id).toBe(second.id);
    expect(Date.parse(first.at!)).toBeGreaterThanOrEqual(before);
  });
  it("persists a merged session with message ids for the next sync", async () => {
    const sessions = await import("./sessions");
    await sessions.saveSyncedSession({
      id: "shared", title: "Shared", createdAt: "2026-01-01", updatedAt: "2026-01-02",
      pinned: 0, messageCount: 2, preview: "Hi",
      messages: [
        { id: "one", at: "2026-01-01", role: "user", content: "Hi" },
        { id: "two", at: "2026-01-02", role: "assistant", blocks: [{ kind: "text", text: "Hello" }] },
      ],
    });
    const loaded = await sessions.loadSession("shared");
    expect(loaded?.messages.map((message) => message.id)).toEqual(["one", "two"]);
  });
  it("does not duplicate legacy file messages when a remote device appends", async () => {
    const sessions = await import("./sessions");
    const CryptoJS = (await import("crypto-js")).default;
    await sessions.createSession();
    const legacy = { role: "user" as const, content: "Old" };
    fsFileMap.set("/appdata/ai/sessions/uuid-1.json.ent", `enc:${JSON.stringify({
      version: 1, messages: [legacy],
    })}`);
    const createdAt = (await sessions.listSessions())[0].createdAt;
    const appendedAt = new Date(Date.parse(createdAt) + 1_000).toISOString();
    const id = CryptoJS.SHA256(`uuid-1:0:${JSON.stringify(legacy)}`).toString().slice(0, 32);
    await sessions.saveSyncedSession({
      id: "uuid-1", title: "Shared", createdAt, updatedAt: appendedAt,
      pinned: 0, messageCount: 2, preview: "Old",
      messages: [
        { ...legacy, id, at: createdAt },
        { role: "user", content: "New", id: "remote-new", at: appendedAt },
      ],
    });
    expect((await sessions.loadSession("uuid-1"))?.messages.map((message) =>
      message.role === "user" ? message.content : "assistant"))
      .toEqual(["Old", "New"]);
  });
  it("keeps a local append made after a synced session was listed", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    await sessions.appendMessages("uuid-1", [{ id: "old", at: "2026-01-01", role: "user", content: "Old" }]);
    const stale = (await sessions.loadSession("uuid-1"))!;
    await sessions.appendMessages("uuid-1", [{ id: "new", at: "2026-01-02", role: "user", content: "New" }]);
    await sessions.saveSyncedSession(stale);
    expect((await sessions.loadSession("uuid-1"))?.messages.map((message) => message.id)).toEqual(["old", "new"]);
  });
  it("persists a rolling summary and usage in the encrypted session file across appends", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    const summary = { content: "Prior BTC discussion", throughMessageCount: 2, throughMessageHash: "a".repeat(32) };
    await sessions.appendMessages("uuid-1", [
      { role: "user", content: "old" },
      { role: "assistant", blocks: [{ kind: "text", text: "answer" }],
        usage: { promptTokens: 12, completionTokens: 4, source: "reported" }, contextTokens: 12 },
    ], summary);
    await sessions.appendMessages("uuid-1", [{ role: "user", content: "new" }]);
    const loaded = await sessions.loadSession("uuid-1");
    expect(loaded?.summary).toEqual(summary);
    expect(loaded?.messages[1]).toMatchObject({ usage: { promptTokens: 12, completionTokens: 4 } });
    expect(loaded?.messages[1]).toMatchObject({ contextTokens: 12 });
  });
  it("keeps a saved summary usable after reloading its hashed message", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    const history = [{ role: "user" as const, content: "old" }, { role: "assistant" as const, content: "answer" }];
    const summary = {
      content: "Prior BTC discussion",
      throughMessageCount: 2,
      throughMessageHash: md5(JSON.stringify(history[1])),
    };
    await sessions.appendMessages("uuid-1", [
      { role: "user", content: "old" },
      { role: "assistant", blocks: [{ kind: "text", text: "answer" }] },
    ], summary);
    const loaded = await sessions.loadSession("uuid-1");
    expect(loaded?.summary).toEqual(summary);
    expect(summaryOffset(history, loaded!.summary!)).toBe(2);
  });
  it("keeps the summary boundary usable when its message is redacted during save", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    const secret = "custom-private-key";
    const summary = {
      content: "Earlier discussion",
      throughMessageCount: 2,
      throughMessageHash: md5(JSON.stringify({ role: "assistant", content: `answer ${secret}` })),
    };
    await sessions.appendMessages("uuid-1", [
      { role: "user", content: "old" },
      { role: "assistant", blocks: [{ kind: "text", text: `answer ${secret}` }] },
    ], summary, [secret]);
    const loaded = await sessions.loadSession("uuid-1");
    const history = [
      { role: "user" as const, content: "old" },
      { role: "assistant" as const, content: "answer <REDACTED>" },
    ];
    expect(loaded?.messages[1]).toMatchObject({ blocks: [{ kind: "text", text: "answer <REDACTED>" }] });
    expect(summaryOffset(history, loaded!.summary!)).toBe(2);
  });
  it("drops malformed saved usage and context counts on load", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    fsFileMap.set("/appdata/ai/sessions/uuid-1.json.ent", `enc:${JSON.stringify({
      version: 1,
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", blocks: [{ kind: "text", text: "world" }], usage: { promptTokens: "bad", completionTokens: 2 }, contextTokens: -5 },
      ],
    })}`);
    const loaded = await sessions.loadSession("uuid-1");
    expect(loaded?.messages[1]).toEqual({ role: "assistant", blocks: [{ kind: "text", text: "world" }] });
  });
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

  it("rejects a session payload with a non-array message list", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    fsFileMap.set("/appdata/ai/sessions/uuid-1.json.ent", 'enc:{"version":1,"messages":"broken"}');
    await expect(sessions.loadSession("uuid-1")).rejects.toThrow(/payload/);
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

  it("keeps the session row if its encrypted file cannot be deleted", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    const path = "/appdata/ai/sessions/uuid-1.json.ent";
    fsFileMap.set(path, "enc:{}");
    mocks.remove.mockRejectedValueOnce(new Error("permission denied"));
    await expect(sessions.deleteSession("uuid-1")).rejects.toThrow("permission denied");
    expect((await sessions.listSessions()).map((row) => row.id)).toContain("uuid-1");
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
      expect.objectContaining({ role: "assistant", blocks: [{ kind: "text", text: "new" }] }),
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
    expect(parsed.messages).toEqual([expect.objectContaining({ role: "user", content: "first" })]);
  });

  it("preserves an existing encrypted session when its payload is invalid", async () => {
    const sessions = await import("./sessions");
    const path = "/appdata/ai/sessions/uuid-1.json.ent";
    fsFileMap.set(path, "enc:{broken");
    await expect(sessions.appendMessages("uuid-1", [{ role: "user", content: "new" }])).rejects.toThrow();
    expect(fsFileMap.get(path)).toBe("enc:{broken");
  });

  it("updates session metadata from the committed messages", async () => {
    const sessions = await import("./sessions");
    await sessions.createSession();
    await sessions.appendMessages("uuid-1", [
      { role: "user", content: "First question" },
      { role: "assistant", blocks: [{ kind: "text", text: "First answer" }] },
    ]);
    await sessions.appendMessages("uuid-1", [
      { role: "user", content: "Second question" },
      { role: "assistant", blocks: [{ kind: "text", text: "Second answer" }] },
    ]);
    const meta = (await sessions.listSessions())[0]!;
    expect(meta.messageCount).toBe(4);
    expect(meta.preview).toBe("First question");
  });

  it("drains an active session write before rotation and delays late encryption until activation", async () => {
    const sessions = await import("./sessions");
    const events: string[] = [];
    let activeKey = "old";
    let releaseFirstWrite: (() => void) | undefined;
    let firstWriteStarted: (() => void) | undefined;
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const firstWriteReady = new Promise<void>((resolve) => {
      firstWriteStarted = resolve;
    });

    mocks.exists.mockResolvedValue(false);
    mocks.invoke.mockImplementation(async (cmd: string, args: any) => {
      if (cmd === "encrypt") {
        const content = JSON.parse(String(args.data)).messages[0].content;
        events.push(`encrypt:${content}:${activeKey}`);
        return `enc:${activeKey}:${args.data}`;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });
    mocks.writeTextFile.mockImplementation(async (path: string, data: string) => {
      const content = JSON.parse(
        data.replace(/^enc:(old|new):/, ""),
      ).messages[0].content;
      events.push(`write:${content}:${path.endsWith(".tmp") ? "temp" : "main"}`);
      if (content === "first" && path.endsWith(".tmp")) {
        firstWriteStarted?.();
        await firstWriteBlocked;
      }
      fsFileMap.set(path, data);
    });

    const first = sessions.appendMessages("uuid-1", [
      { role: "user", content: "first" },
    ]);
    await firstWriteReady;

    const rotation = runWithEncryptionWriteGate(async () => {
      events.push("rotation");
      activeKey = "new";
    });
    const late = sessions.appendMessages("uuid-2", [
      { role: "user", content: "late" },
    ]);

    await Promise.resolve();
    expect(events).toEqual([
      "encrypt:first:old",
      "write:first:temp",
    ]);

    releaseFirstWrite?.();
    await Promise.all([first, rotation, late]);
    expect(events).toEqual([
      "encrypt:first:old",
      "write:first:temp",
      "write:first:main",
      "rotation",
      "encrypt:late:new",
      "write:late:temp",
      "write:late:main",
    ]);
  });

  it("rejects queued and future session writes when recovery is required", async () => {
    const sessions = await import("./sessions");
    const rotation = runEncryptionKeyRotation(async () => {
      throw { code: "recovery_required", message: "Restart Track3" };
    });
    const queued = sessions.appendMessages("uuid-1", [
      { role: "user", content: "queued" },
    ]);

    await expect(rotation).rejects.toMatchObject({
      code: "recovery_required",
    });
    await expect(queued).rejects.toThrow("Restart Track3");
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.writeTextFile).not.toHaveBeenCalled();

    await expect(
      sessions.appendMessages("uuid-2", [
        { role: "user", content: "future" },
      ]),
    ).rejects.toThrow("Restart Track3");
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.writeTextFile).not.toHaveBeenCalled();
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
  it("keeps advanced header secrets out of title prompts and titles", async () => {
    const sessions = await import("./sessions");
    const config: AIConfig = {
      endpoint: "https://example.com/v1", apiKey: "main-key", model: "test", contextSize: 8192,
      advanced: { headers: { "x-custom-auth": "custom-header-secret" }, temperature: 0.4 },
    };
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "custom-header-secret portfolio" } }],
    }), { status: 200 }));
    const title = await sessions.generateTitle(config, "check custom-header-secret", "done");
    const request = JSON.parse(String(mocks.fetch.mock.calls[0]?.[1]?.body));
    expect(JSON.stringify(request)).not.toContain("custom-header-secret");
    expect(mocks.fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ "x-custom-auth": "custom-header-secret" });
    expect(request.temperature).toBe(0.4);
    expect(title).not.toContain("custom-header-secret");
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

  it("generateTitle rejects LLM output that is an answer rather than a title", async () => {
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
            {
              message: {
                content:
                  "好的，我正在按月分批拉取你自 2026 年以来的全部买入记录，共 232 笔。拉完后我会用每笔买入的 BTC 数量和实际花费做加权平均，算出你的 BTC 买入均价",
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ) as any,
    );
    const title = await sessions.generateTitle(
      config,
      "能算出我从 26 年开始，连续买入 btc 的买入均价吗",
      "232 笔买入超出了单次返回上限",
    );
    expect(title.length).toBeLessThanOrEqual(30);
    expect(title.startsWith("能算出我")).toBe(true);
  });

  it("generateTitle rejects multi-line LLM output", async () => {
    const sessions = await import("./sessions");
    const config: AIConfig = {
      endpoint: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      contextSize: 1024,
    };
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Line one\nLine two" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ) as any,
    );
    const title = await sessions.generateTitle(config, "What is my BTC average?", "x");
    expect(title).not.toContain("\n");
    expect(title.startsWith("What is my")).toBe(true);
  });

  it("uses a bounded request for title generation", async () => {
    const sessions = await import("./sessions");
    const config: AIConfig = { endpoint: "https://api.example.com/v1", apiKey: "", model: "test", contextSize: 8192 };
    mocks.fetch.mockImplementation(async (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    vi.useFakeTimers();
    try {
      const pending = sessions.generateTitle(config, "A question to title", "An answer");
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await pending).toBe("A question to title");
    } finally {
      vi.useRealTimers();
    }
  });
});
