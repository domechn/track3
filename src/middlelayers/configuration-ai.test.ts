import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getDatabase, executeWrite } from "./database";
import {
  AIConfigMissingError,
  cleanAIConfig,
  DEFAULT_AI_CONTEXT_SIZE,
  loadAIConfig,
  saveAIConfig,
} from "./configuration";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./database", () => ({
  getDatabase: vi.fn(),
  executeWrite: vi.fn(),
}));

const aiConfigId = "994";

function createConfigurationDb(rows: Map<string, string>) {
  return {
    select: vi.fn(async (sql: string, values: unknown[]) => {
      const id = String(values?.[0] ?? "");
      if (!id || !rows.has(id)) {
        return [];
      }
      return [{ id, data: rows.get(id)! }];
    }),
    execute: vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.startsWith("INSERT OR REPLACE")) {
        const id = String(values?.[0] ?? "");
        if (id) {
          rows.set(id, String(values[1] ?? ""));
        }
      }
      if (sql.startsWith("DELETE FROM configuration")) {
        rows.delete(String(values?.[0] ?? ""));
      }
      return { rowsAffected: 1 };
    }),
  };
}

let configurationRows: Map<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  configurationRows = new Map<string, string>();
  vi.mocked(getDatabase).mockResolvedValue(
    createConfigurationDb(configurationRows) as never,
  );
  vi.mocked(executeWrite).mockImplementation(async (sql: string, values?: unknown[]) => {
    const db = await getDatabase();
    return db.execute(sql, values);
  });
  // saveConfigurationById calls invoke("encrypt", ...) to wrap the payload
  // with the "!ent:" prefix; simulate the round-trip by appending the
  // prefix so the read path triggers the decrypt branch.
  vi.mocked(invoke).mockImplementation(async (cmd: string, args: any) => {
    if (cmd === "encrypt") {
      return `!ent:${args.data}`;
    }
    if (cmd === "decrypt") {
      const raw = String(args.data);
      if (raw.startsWith("!ent:")) {
        return raw.slice("!ent:".length);
      }
      throw new Error("not ent");
    }
    return undefined;
  });
});

const validConfig = {
  endpoint: "https://api.openai.com/v1",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
  contextSize: DEFAULT_AI_CONTEXT_SIZE,
};

describe("AI configuration storage", () => {
  it("throws AIConfigMissingError when the slot is empty", async () => {
    await expect(loadAIConfig()).rejects.toBeInstanceOf(AIConfigMissingError);
  });

  it("saveAIConfig persists encrypted JSON and loadAIConfig round-trips it", async () => {
    await saveAIConfig(validConfig);

    // The slot should be wrapped via the encrypt command ("!ent:" prefix).
    const stored = configurationRows.get(aiConfigId) ?? "";
    expect(stored.startsWith("!ent:")).toBe(true);
    expect(invoke).toHaveBeenCalledWith("encrypt", {
      data: expect.stringContaining(validConfig.endpoint),
    });

    const loaded = await loadAIConfig();
    expect(loaded.endpoint).toBe(validConfig.endpoint);
    expect(loaded.apiKey).toBe(validConfig.apiKey);
    expect(loaded.model).toBe(validConfig.model);
    expect(loaded.contextSize).toBe(validConfig.contextSize);
  });

  it("trims trailing slashes from the endpoint and normalizes contextSize", async () => {
    await saveAIConfig({
      ...validConfig,
      endpoint: "https://api.openai.com/v1///",
      contextSize: 1234.7,
    });
    const loaded = await loadAIConfig();
    expect(loaded.endpoint).toBe("https://api.openai.com/v1");
    expect(loaded.contextSize).toBe(1234);
  });

  it("saveAIConfig rejects a missing endpoint with AIConfigMissingError", async () => {
    await expect(
      saveAIConfig({ ...validConfig, endpoint: "" }),
    ).rejects.toBeInstanceOf(AIConfigMissingError);
  });

  it("saveAIConfig rejects a missing model with AIConfigMissingError", async () => {
    await expect(
      saveAIConfig({ ...validConfig, model: "" }),
    ).rejects.toBeInstanceOf(AIConfigMissingError);
  });

  it("cleanAIConfig removes the slot so loadAIConfig throws again", async () => {
    await saveAIConfig(validConfig);
    expect(configurationRows.has(aiConfigId)).toBe(true);

    await cleanAIConfig();
    expect(configurationRows.has(aiConfigId)).toBe(false);
    await expect(loadAIConfig()).rejects.toBeInstanceOf(AIConfigMissingError);
  });

  it("loadAIConfig throws AIConfigMissingError for a corrupted payload", async () => {
    configurationRows.set(aiConfigId, "not-encrypted");
    // The decrypt path is mocked to throw "not ent" for non-!ent: values,
    // which falls through to the legacy plain-text branch in
    // getConfigurationById. JSON.parse will then fail.
    await expect(loadAIConfig()).rejects.toBeInstanceOf(AIConfigMissingError);
  });
});
