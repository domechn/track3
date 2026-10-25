import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoBackupHistoricalData, autoImportHistoricalData } from "./data";
import { DATA_MANAGER, type ExportData } from "./datamanager";
import { writeBackupV2 } from "./backup-v2";
import { queryHistoricalData } from "./charts-history";
import {
  saveLastAutoBackupAt,
  saveLastAutoImportAt,
} from "./configuration";
import { iosDocumentsBackupMarker } from "./ios-backup-folder";

const mocks = vi.hoisted(() => ({
  getAutoBackupDirectory: vi.fn(),
  getLastAutoBackupAt: vi.fn(),
  getLastAutoImportAt: vi.fn(),
  getImportedPartHashes: vi.fn(),
  saveImportedPartHash: vi.fn(),
  saveLastAutoBackupAt: vi.fn(),
  saveLastAutoImportAt: vi.fn(),
  getClientID: vi.fn(),
  getVersion: vi.fn(),
  queryHistoricalData: vi.fn(),
  writeBackupV2: vi.fn(),
  importBackupV2: vi.fn(),
  readHistoricalData: vi.fn(),
  importHistoricalData: vi.fn(),
  exportHistoricalData: vi.fn(),
  exists: vi.fn(),
  stat: vi.fn(),
  ios: { value: false },
  invoke: vi.fn(),
  saveAutoBackupDirectory: vi.fn(),
  documentDir: vi.fn(),
}));

vi.mock("@/utils/platform", () => ({ isIOS: () => mocks.ios.value }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/path", () => ({ documentDir: mocks.documentDir }));
vi.mock("./configuration", () => ({
  getAutoBackupDirectory: mocks.getAutoBackupDirectory,
  getLastAutoBackupAt: mocks.getLastAutoBackupAt,
  getLastAutoImportAt: mocks.getLastAutoImportAt,
  getImportedPartHashes: mocks.getImportedPartHashes,
  saveImportedPartHash: mocks.saveImportedPartHash,
  saveLastAutoBackupAt: mocks.saveLastAutoBackupAt,
  saveLastAutoImportAt: mocks.saveLastAutoImportAt,
  saveAutoBackupDirectory: mocks.saveAutoBackupDirectory,
}));
vi.mock("@/utils/app", () => ({ getClientID: mocks.getClientID, getVersion: mocks.getVersion }));
vi.mock("./charts-history", () => ({ queryHistoricalData: mocks.queryHistoricalData }));
vi.mock("@tauri-apps/plugin-fs", () => ({ exists: mocks.exists, stat: mocks.stat }));
vi.mock("./backup-v2", () => ({ writeBackupV2: mocks.writeBackupV2, importBackupV2: mocks.importBackupV2 }));
vi.mock("./datamanager", () => ({ DATA_MANAGER: {
  readHistoricalData: mocks.readHistoricalData,
  importHistoricalData: mocks.importHistoricalData,
  exportHistoricalData: mocks.exportHistoricalData,
} }));

const oldRecord: ExportData["historicalData"][number] = {
  createdAt: "2023-01-15T00:00:00.000Z",
  total: 1,
  assets: [{ id: 1, uuid: "old", createdAt: "2023-01-15T00:00:00.000Z", assetType: "crypto", symbol: "BTC", amount: 1, value: 1, price: 1, wallet: "wallet-1" }],
  transactions: [],
};
const legacy: ExportData = {
  client: "old-client",
  clientVersion: "0.7.0",
  exportAt: "2024-02-01T00:00:00.000Z",
  historicalData: [oldRecord],
  md5V2: "legacy-checksum",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ios.value = false;
  mocks.documentDir.mockResolvedValue("/app/Documents");
  mocks.invoke.mockImplementation(async (command: string) =>
    command === "ios_backup_folder_status" ? { path: null, failure: null } : null);
  mocks.getAutoBackupDirectory.mockResolvedValue("/backup");
  mocks.getLastAutoBackupAt.mockResolvedValue(new Date("2023-01-01T00:00:00.000Z"));
  mocks.getLastAutoImportAt.mockResolvedValue(new Date("2024-01-01T00:00:00.000Z"));
  mocks.getImportedPartHashes.mockResolvedValue({});
  mocks.saveImportedPartHash.mockResolvedValue(undefined);
  mocks.getClientID.mockResolvedValue("self");
  mocks.getVersion.mockResolvedValue("0.8.2");
  mocks.queryHistoricalData.mockResolvedValue([oldRecord]);
  mocks.writeBackupV2.mockResolvedValue(undefined);
  mocks.importBackupV2.mockResolvedValue({ imported: false, clientsWithV2: new Set() });
  mocks.readHistoricalData.mockRejectedValue(new Error("legacy file missing"));
  mocks.exists.mockResolvedValue(false);
  mocks.stat.mockResolvedValue({ mtime: new Date("2024-02-01T00:00:00.000Z") });
  mocks.importHistoricalData.mockResolvedValue(undefined);
  mocks.saveLastAutoBackupAt.mockResolvedValue(undefined);
  mocks.saveLastAutoImportAt.mockResolvedValue(undefined);
});

describe("automatic backup integration", () => {
  it("prepares the iOS Documents folder before writing a backup", async () => {
    mocks.ios.value = true;
    mocks.getAutoBackupDirectory.mockResolvedValue("/app/Documents");
    expect(await autoBackupHistoricalData(true)).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith("ios_prepare_backup_folder", { path: "/app/Documents", kind: "auto" });
    expect(writeBackupV2).toHaveBeenCalledWith("/app/Documents", "self", "0.8.2", [oldRecord]);
  });

  it("uses a moved bookmark path for auto import and saves it", async () => {
    mocks.ios.value = true;
    mocks.invoke.mockImplementation(async (command: string) =>
      command === "ios_backup_folder_status" ? { path: "/cloud/moved", failure: null } : null);
    await autoImportHistoricalData();
    expect(mocks.saveAutoBackupDirectory).toHaveBeenCalledWith("/cloud/moved");
    expect(mocks.invoke).toHaveBeenCalledWith("ios_prepare_backup_folder", { path: "/cloud/moved", kind: "auto" });
    expect(mocks.importBackupV2).toHaveBeenCalledWith("/cloud/moved", "self", expect.any(Function), expect.any(Function), expect.any(Function));
  });

  it("prepares the iOS Documents folder before auto import", async () => {
    mocks.ios.value = true;
    mocks.getAutoBackupDirectory.mockResolvedValue("/app/Documents");
    await autoImportHistoricalData();
    expect(mocks.invoke).toHaveBeenCalledWith("ios_prepare_backup_folder", { path: "/app/Documents", kind: "auto" });
    expect(mocks.importBackupV2).toHaveBeenCalledWith("/app/Documents", "self", expect.any(Function), expect.any(Function), expect.any(Function));
  });

  it("resolves the Documents marker after the app container moves", async () => {
    mocks.ios.value = true;
    mocks.getAutoBackupDirectory.mockResolvedValue(iosDocumentsBackupMarker);
    mocks.documentDir.mockResolvedValue("/new-container/Documents");
    await autoImportHistoricalData();
    expect(mocks.importBackupV2).toHaveBeenCalledWith("/new-container/Documents", "self", expect.any(Function), expect.any(Function), expect.any(Function));
  });

  it("migrates a saved Documents path from an old iOS container", async () => {
    mocks.ios.value = true;
    mocks.getAutoBackupDirectory.mockResolvedValue("/var/mobile/Containers/Data/Application/12345678-1234-1234-1234-123456789abc/Documents");
    mocks.documentDir.mockResolvedValue("/var/mobile/Containers/Data/Application/abcdefab-1234-1234-1234-123456789abc/Documents");
    await autoImportHistoricalData();
    expect(mocks.saveAutoBackupDirectory).toHaveBeenCalledWith(iosDocumentsBackupMarker);
    expect(mocks.importBackupV2).toHaveBeenCalledWith("/var/mobile/Containers/Data/Application/abcdefab-1234-1234-1234-123456789abc/Documents", "self", expect.any(Function), expect.any(Function), expect.any(Function));
  });

  it("keeps a bookmarked Files folder even if its name resembles an old Documents path", async () => {
    const selected = "/var/mobile/Containers/Data/Application/12345678-1234-1234-1234-123456789abc/Documents";
    mocks.ios.value = true;
    mocks.getAutoBackupDirectory.mockResolvedValue(selected);
    mocks.documentDir.mockResolvedValue("/var/mobile/Containers/Data/Application/abcdefab-1234-1234-1234-123456789abc/Documents");
    mocks.invoke.mockImplementation(async (command: string) =>
      command === "ios_backup_folder_status" ? { path: selected, failure: null } : null);
    await autoImportHistoricalData();
    expect(mocks.importBackupV2).toHaveBeenCalledWith(selected, "self", expect.any(Function), expect.any(Function), expect.any(Function));
    expect(mocks.saveAutoBackupDirectory).not.toHaveBeenCalledWith(iosDocumentsBackupMarker);
  });

  it("keeps an explicit Documents choice when an old bookmark remains", async () => {
    mocks.ios.value = true;
    mocks.getAutoBackupDirectory.mockResolvedValue("/app/Documents");
    mocks.invoke.mockImplementation(async (command: string) =>
      command === "ios_backup_folder_status" ? { path: "/cloud/old", failure: null } : null);
    await autoBackupHistoricalData(true);
    expect(mocks.invoke).toHaveBeenCalledWith("ios_clear_backup_folder", { kind: "auto" });
    expect(mocks.saveAutoBackupDirectory).toHaveBeenCalledWith(iosDocumentsBackupMarker);
    expect(mocks.writeBackupV2).toHaveBeenCalledWith("/app/Documents", "self", "0.8.2", [oldRecord]);
  });

  it("announces iCloud preparation while the native download is pending", async () => {
    mocks.ios.value = true;
    let finish!: () => void;
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "ios_backup_folder_status") return { path: null, failure: null };
      if (command === "ios_prepare_backup_folder") await new Promise<void>((resolve) => { finish = resolve; });
      return null;
    });
    const events: boolean[] = [];
    const listener = (event: Event) => events.push((event as CustomEvent<boolean>).detail);
    window.addEventListener("track3:backup-folder-preparation", listener);
    try {
      const backup = autoBackupHistoricalData(true);
      await vi.waitFor(() => expect(events).toEqual([true]));
      finish();
      await backup;
      expect(events).toEqual([true, false]);
    } finally {
      window.removeEventListener("track3:backup-folder-preparation", listener);
    }
  });

  it("keeps the 24-hour trigger and writes v2 data for its own client", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-01T00:00:00.000Z"));
    try {
      expect(await autoBackupHistoricalData()).toBe(true);
      expect(queryHistoricalData).toHaveBeenCalledWith(-1, false);
      expect(writeBackupV2).toHaveBeenCalledWith("/backup", "self", "0.8.2", [oldRecord]);
      expect(DATA_MANAGER.exportHistoricalData).not.toHaveBeenCalled();
      expect(saveLastAutoBackupAt).toHaveBeenCalledOnce();
      expect(saveLastAutoImportAt).toHaveBeenCalledOnce();
      mocks.getLastAutoBackupAt.mockResolvedValue(new Date("2024-02-01T00:00:00.000Z"));
      expect(await autoBackupHistoricalData()).toBe(false);
      expect(await autoBackupHistoricalData(true)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("serializes overlapping forced backups", async () => {
    let finishFirst!: () => void;
    let firstWriting = true;
    let wasConcurrent = false;
    mocks.writeBackupV2
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        finishFirst = () => {
          firstWriting = false;
          resolve();
        };
      }))
      .mockImplementationOnce(async () => {
        wasConcurrent = firstWriting;
      });
    const first = autoBackupHistoricalData(true);
    await vi.waitFor(() => expect(writeBackupV2).toHaveBeenCalledOnce());
    const second = autoBackupHistoricalData(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    finishFirst();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(wasConcurrent).toBe(false);
    expect(writeBackupV2).toHaveBeenCalledTimes(2);
  });

  it("imports a v2 part with IGNORE without filtering its old record by last import time", async () => {
    mocks.importBackupV2.mockImplementation(async (_directory, _client, _getHash, _saveHash, importPart) => {
      await importPart([oldRecord], { client: "other", clientVersion: "0.8.2", exportAt: "2024-02-01T00:00:00.000Z" });
      return { imported: true, clientsWithV2: new Set(["other"]) };
    });
    expect(await autoImportHistoricalData()).toBe(true);
    expect(DATA_MANAGER.importHistoricalData).toHaveBeenCalledWith("IGNORE", {
      client: "other",
      clientVersion: "0.8.2",
      exportAt: "2024-02-01T00:00:00.000Z",
      historicalData: [oldRecord],
      md5V2: "",
    });
    expect(vi.mocked(DATA_MANAGER.importHistoricalData).mock.calls[0]).toHaveLength(2);
    expect(saveLastAutoImportAt).toHaveBeenCalledOnce();
  });

  it("uses the legacy file when that client has no valid v2 backup", async () => {
    mocks.exists.mockResolvedValue(true);
    const newerRecord = {
      ...oldRecord,
      createdAt: "2023-07-15T00:00:00.000Z",
      assets: [{ ...oldRecord.assets[0], createdAt: "2023-07-15T00:00:00.000Z", uuid: "new" }],
    };
    mocks.readHistoricalData.mockResolvedValue({ ...legacy, historicalData: [oldRecord, newerRecord] });
    mocks.getLastAutoImportAt.mockResolvedValue(new Date("2023-06-01T00:00:00.000Z"));
    expect(await autoImportHistoricalData()).toBe(true);
    expect(DATA_MANAGER.readHistoricalData).toHaveBeenCalledWith("/backup/track3-auto-backup.json");
    const [mode, importedData, filter] = mocks.importHistoricalData.mock.calls[0] as [
      string,
      ExportData,
      (records: ExportData["historicalData"]) => ExportData["historicalData"],
    ];
    expect(mode).toBe("IGNORE");
    expect(importedData.historicalData).toEqual([oldRecord, newerRecord]);
    expect(filter(importedData.historicalData)).toEqual([newerRecord]);
  });

  it("does not read an unchanged legacy file", async () => {
    mocks.exists.mockResolvedValue(true);
    mocks.stat.mockResolvedValue({ mtime: new Date("2023-12-31T00:00:00.000Z") });
    expect(await autoImportHistoricalData()).toBe(false);
    expect(DATA_MANAGER.readHistoricalData).not.toHaveBeenCalled();
    expect(DATA_MANAGER.importHistoricalData).not.toHaveBeenCalled();
  });

  it("skips a legacy export with no records after the last import time", async () => {
    mocks.exists.mockResolvedValue(true);
    mocks.readHistoricalData.mockResolvedValue(legacy);
    mocks.getLastAutoImportAt.mockResolvedValue(new Date("2024-01-31T00:00:00.000Z"));
    expect(await autoImportHistoricalData()).toBe(false);
    expect(DATA_MANAGER.importHistoricalData).not.toHaveBeenCalled();
  });

  it("prefers v2 for a client that also has a legacy file", async () => {
    mocks.exists.mockResolvedValue(true);
    mocks.importBackupV2.mockResolvedValue({ imported: true, clientsWithV2: new Set(["old-client"]) });
    mocks.readHistoricalData.mockResolvedValue(legacy);
    expect(await autoImportHistoricalData()).toBe(true);
    expect(DATA_MANAGER.importHistoricalData).not.toHaveBeenCalled();
  });

  it("returns a successful v2 import when checking the legacy path fails", async () => {
    mocks.importBackupV2.mockResolvedValue({ imported: true, clientsWithV2: new Set(["other"]) });
    mocks.exists.mockRejectedValue(new Error("drive unavailable"));
    expect(await autoImportHistoricalData()).toBe(true);
    expect(saveLastAutoImportAt).toHaveBeenCalledOnce();
  });
});
