import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  buildMetadata,
  groupByMonth,
  importBackupV2,
  parseMetadata,
  planWrites,
  verifyPart,
  writeBackupV2,
  type BackupRecords,
} from "./backup-v2";

const disk = vi.hoisted(() => ({
  files: new Map<string, string>(),
  dirs: new Set<string>(),
  calls: [] as string[],
  failRead: "",
  failCleanupRead: false,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => disk.files.has(path) || disk.dirs.has(path)),
  mkdir: vi.fn(async (path: string) => { disk.dirs.add(path); disk.calls.push(`mkdir ${path}`); }),
  readDir: vi.fn(async (path: string) => {
    if (disk.failCleanupRead && disk.files.has(`${root}/client-a/metadata.json`)) {
      throw new Error("cleanup listing failed");
    }
    if (!disk.dirs.has(path)) throw new Error("directory missing");
    const names = new Set([...disk.files.keys(), ...disk.dirs].filter((p) => p.startsWith(`${path}/`)).map((p) => p.slice(path.length + 1).split("/")[0]));
    return [...names].map((name) => ({ name, isDirectory: disk.dirs.has(`${path}/${name}`), isFile: disk.files.has(`${path}/${name}`), isSymlink: false }));
  }),
  readTextFile: vi.fn(async (path: string) => {
    disk.calls.push(`read ${path}`);
    if (path === disk.failRead) throw new Error("read failed");
    const text = disk.files.get(path);
    if (text === undefined) throw new Error("file missing");
    return text;
  }),
  writeTextFile: vi.fn(async (path: string, text: string) => { disk.files.set(path, text); disk.calls.push(`write ${path}`); }),
  rename: vi.fn(async (from: string, to: string) => { disk.files.set(to, disk.files.get(from)!); disk.files.delete(from); disk.calls.push(`rename ${from} ${to}`); }),
  remove: vi.fn(async (path: string) => { disk.files.delete(path); disk.calls.push(`remove ${path}`); }),
}));

const root = "/backup/track3-backup";
const month = "2024-01";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const record = (createdAt: string, uuid = "one"): BackupRecords[number] => ({
  createdAt,
  total: 1,
  assets: [{ id: 1, uuid, createdAt, assetType: "crypto", symbol: "BTC", amount: 1, value: 1, price: 1, wallet: "wallet-1" }],
  transactions: [],
});
const january = record("2024-01-31T23:59:59.999Z");
const partText = (records: BackupRecords) => JSON.stringify({ historicalData: records });
const part = (month: string, records: BackupRecords) => {
  const text = partText(records);
  const digest = sha(text);
  return { file: `${month}.${digest.slice(0, 8)}.json`, month, records: records.length, bytes: Buffer.byteLength(text), sha256: digest };
};

function addClient(client: string, records: BackupRecords = [january]) {
  const directory = `${root}/${client}`;
  const dataDirectory = `${directory}/data`;
  disk.dirs.add(root);
  disk.dirs.add(directory);
  disk.dirs.add(dataDirectory);
  const descriptor = part(month, records);
  disk.files.set(`${dataDirectory}/${descriptor.file}`, partText(records));
  const metadata = buildMetadata(client, "0.8.2", "2024-02-01T00:00:00.000Z", [descriptor]);
  disk.files.set(`${directory}/metadata.json`, JSON.stringify(metadata));
  return { directory, descriptor, metadata };
}

beforeEach(() => {
  disk.files.clear();
  disk.dirs.clear();
  disk.calls.length = 0;
  disk.failRead = "";
  disk.failCleanupRead = false;
  vi.clearAllMocks();
});

describe("v2 backup helpers", () => {
  it("preserves long symbols in historical backup data", async () => {
    const symbol = "0123456789abcdef0123456789abcdef";
    await writeBackupV2("/backup", "client-a", "0.8.2", [{
      ...january,
      assets: [{ ...january.assets[0], symbol }],
    }]);
    const partFile = [...disk.files.entries()].find(([path]) => path.includes("/data/"))?.[1] ?? "";
    expect(JSON.parse(partFile).historicalData[0].assets[0].symbol).toBe(symbol);
  });

  it("preserves wallet identifiers needed to restore a backup", async () => {
    const wallet = "0123456789abcdef0123456789abcdef";
    await writeBackupV2("/backup", "client-a", "0.8.2", [{
      ...january, assets: [{ ...january.assets[0], wallet }],
    }]);
    const partFile = [...disk.files.entries()].find(([path]) => path.includes("/data/"))?.[1] ?? "";
    expect(partFile).toContain(wallet);
  });
  it("groups records by UTC month at a month boundary", () => {
    const grouped = groupByMonth([
      january,
      record("2024-02-01T00:30:00.000+01:00", "also-january"),
      record("2024-01-31T23:30:00.000-01:00", "two"),
    ]);
    expect([...grouped.keys()]).toEqual(["2024-01", "2024-02"]);
    expect(grouped.get("2024-01")?.map(({ assets }) => assets[0].uuid)).toEqual(["one", "also-january"]);
    expect(grouped.get("2024-02")?.[0].assets[0].uuid).toBe("two");
  });

  it("skips a record with an invalid date while backing up valid records", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await writeBackupV2("/backup", "client-a", "0.8.2", [
        record("not-a-date", "bad"),
        january,
      ]);
      const metadata = parseMetadata(disk.files.get(`${root}/client-a/metadata.json`)!, "client-a");
      expect(metadata?.parts).toHaveLength(1);
      expect(metadata?.parts[0].records).toBe(1);
      expect(error).toHaveBeenCalledWith("skipping historical record with invalid createdAt", "not-a-date");
    } finally {
      error.mockRestore();
    }
  });

  it("selects only changed or missing part files for writing", () => {
    const old = part(month, [january]);
    const february = part("2024-02", [record("2024-02-01T00:00:00.000Z")]);
    const existing = buildMetadata("client-a", "0.8.2", "2024-01-31T00:00:00.000Z", [old]);
    expect(planWrites([old, february], existing, new Set([old.file]))).toEqual([february]);
    expect(planWrites([old], existing, new Set())).toEqual([old]);
  });

  it("rejects a tampered or truncated part before parsing it", () => {
    const descriptor = part(month, [january]);
    expect(() => verifyPart(partText([record(january.createdAt, "other")]), descriptor)).toThrow();
    expect(() => verifyPart(partText([january]).slice(0, -1), descriptor)).toThrow();
  });

  it("rejects metadata with a bad hash or unsafe file name", () => {
    const metadata = buildMetadata("client-a", "0.8.2", "2024-02-01T00:00:00.000Z", [part(month, [january])]);
    expect(parseMetadata(JSON.stringify({ ...metadata, exportAt: "changed" }), "client-a")).toBeUndefined();
    expect(parseMetadata(JSON.stringify({ ...metadata, parts: [{ ...metadata.parts[0], file: "../outside" }] }), "client-a")).toBeUndefined();
  });

  it("hashes metadata in canonical key order", () => {
    const descriptor = part(month, [january]);
    const metadata = buildMetadata("client-a", "0.8.2", "2024-02-01T00:00:00.000Z", [descriptor]);
    const canonical = JSON.stringify({
      client: "client-a",
      clientVersion: "0.8.2",
      exportAt: "2024-02-01T00:00:00.000Z",
      formatVersion: 2,
      parts: [{
        bytes: descriptor.bytes,
        file: descriptor.file,
        month: descriptor.month,
        records: descriptor.records,
        sha256: descriptor.sha256,
      }],
    });
    expect(metadata.metaHash).toBe(sha(canonical));
    const reordered = {
      ...metadata,
      parts: [{ sha256: descriptor.sha256, records: descriptor.records, month: descriptor.month, file: descriptor.file, bytes: descriptor.bytes }],
    };
    expect(parseMetadata(JSON.stringify(reordered), "client-a")).toBeDefined();
  });
});

describe("v2 backup files", () => {
  it("writes changed parts before the temporary metadata and commits it by rename", async () => {
    await writeBackupV2("/backup", "client-a", "0.8.2", [january, record("2024-02-01T00:00:00.000Z", "february")]);
    const partWrites = disk.calls.map((call, index) => call.startsWith(`write ${root}/client-a/data/`) ? index : -1).filter((index) => index >= 0);
    const metadataWrite = disk.calls.findIndex((call) => call === `write ${root}/client-a/metadata.json.tmp`);
    const commit = disk.calls.findIndex((call) => call === `rename ${root}/client-a/metadata.json.tmp ${root}/client-a/metadata.json`);
    expect(partWrites).toHaveLength(2);
    expect(metadataWrite).toBeGreaterThan(partWrites.at(-1)!);
    expect(commit).toBeGreaterThan(metadataWrite);
    expect(disk.files.has(`${root}/client-a/metadata.json.tmp`)).toBe(false);
    expect(parseMetadata(disk.files.get(`${root}/client-a/metadata.json`)!, "client-a")).toBeDefined();
  });

  it("does not commit metadata when a part write fails", async () => {
    vi.mocked(writeTextFile).mockRejectedValueOnce(new Error("disk full"));
    await expect(writeBackupV2("/backup", "client-a", "0.8.2", [january])).rejects.toThrow("disk full");
    expect(disk.files.has(`${root}/client-a/metadata.json`)).toBe(false);
    expect(disk.files.has(`${root}/client-a/metadata.json.tmp`)).toBe(false);
  });

  it("does not rewrite an unchanged part and removes an orphan after metadata commit", async () => {
    const current = addClient("client-a");
    disk.files.set(`${current.directory}/data/orphan.json`, "old");
    await writeBackupV2("/backup", "client-a", "0.8.2", [january]);
    expect(vi.mocked(writeTextFile).mock.calls.filter(([path]) => String(path).includes("/data/"))).toHaveLength(0);
    expect(vi.mocked(remove)).toHaveBeenCalledWith(`${current.directory}/data/orphan.json`);
    expect(disk.calls.indexOf(`remove ${current.directory}/data/orphan.json`)).toBeGreaterThan(disk.calls.findIndex((call) => call.startsWith("rename ")));
  });

  it("keeps the committed backup when removing an old part fails", async () => {
    const current = addClient("client-a");
    disk.files.set(`${current.directory}/data/orphan.json`, "old");
    vi.mocked(remove).mockRejectedValueOnce(new Error("remove failed"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(writeBackupV2("/backup", "client-a", "0.8.2", [january])).resolves.toBeUndefined();
      expect(parseMetadata(disk.files.get(`${current.directory}/metadata.json`)!, "client-a")).toBeDefined();
      expect(disk.files.has(`${current.directory}/data/orphan.json`)).toBe(true);
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("keeps the committed backup when listing old parts fails", async () => {
    disk.failCleanupRead = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(writeBackupV2("/backup", "client-a", "0.8.2", [january])).resolves.toBeUndefined();
      expect(parseMetadata(disk.files.get(`${root}/client-a/metadata.json`)!, "client-a")).toBeDefined();
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});

describe("v2 import", () => {
  const imported = new Map<string, string>();
  const getHash = (client: string, partMonth: string) => imported.get(`${client}/${partMonth}`);
  const saveHash = vi.fn(async (client: string, partMonth: string, digest: string) => { imported.set(`${client}/${partMonth}`, digest); });
  const importPart = vi.fn(async (_records: BackupRecords) => {});

  beforeEach(() => { imported.clear(); saveHash.mockClear(); importPart.mockClear(); });

  it("ignores its own directory and skips an unchanged hash without reading the part", async () => {
    addClient("self");
    const other = addClient("client-a");
    imported.set("client-a/2024-01", other.descriptor.sha256);
    const result = await importBackupV2("/backup", "self", getHash, saveHash, importPart);
    expect(result.imported).toBe(false);
    expect(vi.mocked(readTextFile).mock.calls).toEqual([[`${other.directory}/metadata.json`]]);
  });

  it("imports a late old-month record and records its hash only after import", async () => {
    const other = addClient("client-a");
    imported.set("client-a/2024-01", "old-hash");
    importPart.mockImplementationOnce(async () => { expect(imported.get("client-a/2024-01")).toBe("old-hash"); });
    const result = await importBackupV2("/backup", "self", getHash, saveHash, importPart);
    expect(result.imported).toBe(true);
    expect(importPart).toHaveBeenCalledWith([january], other.metadata);
    expect(imported.get("client-a/2024-01")).toBe(other.descriptor.sha256);
  });

  it("skips invalid metadata and continues to another client", async () => {
    const bad = addClient("bad");
    disk.files.set(`${bad.directory}/metadata.json`, "{");
    addClient("good");
    const result = await importBackupV2("/backup", "self", getHash, saveHash, importPart);
    expect(result.imported).toBe(true);
    expect(importPart).toHaveBeenCalledTimes(1);
    expect(result.clientsWithV2.has("bad")).toBe(false);
    expect(result.clientsWithV2.has("good")).toBe(true);
  });

  it("skips tampered, truncated, and missing parts while continuing other clients", async () => {
    const bad = addClient("bad");
    disk.files.set(`${bad.directory}/data/${bad.descriptor.file}`, partText([record(january.createdAt, "tampered")]));
    const februaryRecords = [record("2024-02-01T00:00:00.000Z", "february")];
    const february = part("2024-02", februaryRecords);
    disk.files.set(`${bad.directory}/data/${february.file}`, partText(februaryRecords));
    disk.files.set(`${bad.directory}/metadata.json`, JSON.stringify(
      buildMetadata("bad", "0.8.2", "2024-02-01T00:00:00.000Z", [bad.descriptor, february]),
    ));
    const truncated = addClient("truncated");
    disk.files.set(`${truncated.directory}/data/${truncated.descriptor.file}`, partText([january]).slice(0, -1));
    const missing = addClient("missing");
    disk.files.delete(`${missing.directory}/data/${missing.descriptor.file}`);
    addClient("good");
    const result = await importBackupV2("/backup", "self", getHash, saveHash, importPart);
    expect(result.imported).toBe(true);
    expect(importPart).toHaveBeenCalledTimes(2);
    expect(saveHash).toHaveBeenCalledTimes(2);
    expect(saveHash).toHaveBeenCalledWith("bad", "2024-02", february.sha256);
    expect(saveHash).not.toHaveBeenCalledWith("bad", "2024-01", bad.descriptor.sha256);
  });

  it("does not record a failed import and retries it on the next run", async () => {
    addClient("client-a");
    importPart.mockRejectedValueOnce(new Error("database busy"));
    expect((await importBackupV2("/backup", "self", getHash, saveHash, importPart)).imported).toBe(false);
    expect(saveHash).not.toHaveBeenCalled();
    expect((await importBackupV2("/backup", "self", getHash, saveHash, importPart)).imported).toBe(true);
    expect(importPart).toHaveBeenCalledTimes(2);
    expect((await importBackupV2("/backup", "self", getHash, saveHash, importPart)).imported).toBe(false);
    expect(importPart).toHaveBeenCalledTimes(2);
  });
});
