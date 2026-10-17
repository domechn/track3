import { beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { executeWrite, getDatabase } from "@/middlelayers/database";
import { resetEncryptionWriteGateForTests, runEncryptionKeyRotation } from "@/middlelayers/encryption-write-gate";
import { defaultSyncSettings, loadSyncSettings, saveSyncSettings } from "./settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/middlelayers/database", () => ({ executeWrite: vi.fn(), getDatabase: vi.fn() }));

beforeEach(() => {
  resetEncryptionWriteGateForTests();
  vi.clearAllMocks();
});

it("waits for key rotation before encrypting and writing sync settings", async () => {
  let finishRotation!: () => void;
  const rotation = runEncryptionKeyRotation(() => new Promise<void>((resolve) => { finishRotation = resolve; }));
  let key = "old";
  vi.mocked(invoke).mockImplementation(async (_command, args) => `!ent:${key}:${(args as { data: string }).data}`);
  const saved = saveSyncSettings(defaultSyncSettings);
  await Promise.resolve();
  expect(executeWrite).not.toHaveBeenCalled();
  key = "new";
  finishRotation();
  await rotation;
  await saved;
  expect(executeWrite).toHaveBeenCalledWith(
    "INSERT OR REPLACE INTO configuration (id, data) VALUES (?, ?)",
    ["991", `!ent:new:${JSON.stringify(defaultSyncSettings)}`],
  );
});

it("ignores a legacy goals flag in saved sync settings", async () => {
  vi.mocked(getDatabase).mockResolvedValue({
    select: async () => [{ data: "!ent:settings" }],
  } as never);
  vi.mocked(invoke).mockResolvedValue(JSON.stringify({
    ...defaultSyncSettings,
    categories: { ...defaultSyncSettings.categories, goals: false },
  }));
  const loaded = await loadSyncSettings();
  expect(loaded.categories).toEqual({
    history: true, settings: true, secrets: true, rebalance: true, chat: true,
  });
});
