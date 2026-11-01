import { beforeEach, expect, it, vi } from "vitest";
import { findBackupFolder } from "./backup-folder";
import { readTextFile } from "@tauri-apps/plugin-fs";

const disk = vi.hoisted(() => ({ dirs: new Set<string>(), files: new Set<string>(), metadata: "" }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(async (path: string) => disk.dirs.has(path) || disk.files.has(path)),
  readDir: vi.fn(async (path: string) => [...disk.dirs, ...disk.files].filter((p) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/")).map((p) => ({ name: p.slice(path.length + 1), isDirectory: disk.dirs.has(p), isFile: disk.files.has(p), isSymlink: false }))),
  readTextFile: vi.fn(async (path: string) => path.endsWith("metadata.json") ? disk.metadata : ""),
}));

beforeEach(() => {
  disk.dirs.clear();
  disk.files.clear();
  disk.metadata = "";
  vi.mocked(readTextFile).mockReset();
  vi.mocked(readTextFile).mockImplementation(async (path) => String(path).endsWith("metadata.json") ? disk.metadata : "");
});

it.each([
  ["/cloud", "/cloud", false],
  ["/cloud/track3-backup", "/cloud", true],
  ["/cloud/track3-backup/device-a", "/cloud", true],
])("normalizes a selected backup level %s", async (picked, parent, normalized) => {
  disk.dirs.add("/cloud/track3-backup");
  disk.dirs.add("/cloud/track3-backup/device-a");
  disk.files.add("/cloud/track3-backup/device-a/metadata.json");
  const result = await findBackupFolder(picked);
  expect(result?.directory).toBe(parent);
  expect(result?.normalized).toBe(normalized);
});

it("rejects an unrelated folder", async () => {
  expect(await findBackupFolder("/unrelated")).toBeUndefined();
});

it("finds a legacy-only backup", async () => {
  disk.files.add("/cloud/track3-auto-backup.json");
  expect((await findBackupFolder("/cloud"))?.legacy).toBe(true);
});

it("does not report a client with invalid metadata as importable", async () => {
  disk.dirs.add("/cloud/track3-backup");
  disk.dirs.add("/cloud/track3-backup/device-a");
  disk.files.add("/cloud/track3-backup/device-a/metadata.json");
  const { listBackupClients } = await import("./backup-folder");
  expect(await listBackupClients("/cloud")).toEqual([]);
});

it("recognizes a selected client folder without reading its parent", async () => {
  disk.dirs.add("/cloud/track3-backup/device-a");
  disk.files.add("/cloud/track3-backup/device-a/metadata.json");
  expect((await findBackupFolder("/cloud/track3-backup/device-a"))?.directory).toBe("/cloud");
});

it("lists only a selected client when the parent is outside its security scope", async () => {
  const { buildMetadata } = await import("@/middlelayers/backup-v2");
  disk.metadata = JSON.stringify(buildMetadata("device-a", "0.9.0", "2024-03-01T00:00:00Z", []));
  disk.dirs.add("/cloud/track3-backup/device-a");
  disk.files.add("/cloud/track3-backup/device-a/metadata.json");
  const { listBackupClients } = await import("./backup-folder");
  expect(await listBackupClients("/cloud", "/cloud/track3-backup/device-a")).toEqual([
    { client: "device-a", exportAt: "2024-03-01T00:00:00Z", months: 0, snapshots: 0 },
  ]);
});

it("skips a client whose metadata has not downloaded yet", async () => {
  const { buildMetadata } = await import("./backup-v2");
  disk.dirs.add("/cloud/track3-backup");
  disk.dirs.add("/cloud/track3-backup/device-a");
  disk.dirs.add("/cloud/track3-backup/device-b");
  disk.files.add("/cloud/track3-backup/device-b/metadata.json");
  vi.mocked(readTextFile).mockImplementation(async (path) => {
    if (String(path).includes("/device-a/")) throw new Error("metadata is unavailable");
    return JSON.stringify(buildMetadata("device-b", "0.9.0", "2024-03-01T00:00:00Z", []));
  });
  const { listBackupClients } = await import("./backup-folder");
  expect(await listBackupClients("/cloud")).toEqual([
    { client: "device-b", exportAt: "2024-03-01T00:00:00Z", months: 0, snapshots: 0 },
  ]);
});

it("lists the current generation of each valid device with its snapshot count", async () => {
  const { buildMetadata } = await import("./backup-v2");
  disk.dirs.add("/cloud/track3-backup");
  disk.dirs.add("/cloud/track3-backup/device-a");
  disk.dirs.add("/cloud/track3-backup/device-b");
  disk.dirs.add("/cloud/track3-backup/broken");
  vi.mocked(readTextFile).mockImplementation(async (path) => {
    if (String(path).includes("/broken/")) return "broken";
    const client = String(path).includes("/device-a/") ? "device-a" : "device-b";
    const counts = client === "device-a" ? [2, 3] : [1];
    return JSON.stringify(buildMetadata(client, "0.9.4", client === "device-a" ? "2024-03-01T00:00:00Z" : "2024-04-01T00:00:00Z",
      counts.map((records, index) => ({ month: `2024-0${index + 1}`, records, bytes: 10, sha256: "a".repeat(64), file: `2024-0${index + 1}.${"a".repeat(8)}.json` }))));
  });
  const { listBackupClients } = await import("./backup-folder");
  expect(await listBackupClients("/cloud")).toEqual([
    { client: "device-b", exportAt: "2024-04-01T00:00:00Z", months: 1, snapshots: 1 },
    { client: "device-a", exportAt: "2024-03-01T00:00:00Z", months: 2, snapshots: 5 },
  ]);
});

it("reads a selected client's metadata once during import", async () => {
  const { buildMetadata } = await import("./backup-v2");
  const { readBackupClient } = await import("./backup-folder");
  disk.metadata = JSON.stringify(buildMetadata("device-a", "0.9.0", "2024-03-01T00:00:00Z", []));
  await readBackupClient("/cloud", "device-a");
  expect(vi.mocked(readTextFile).mock.calls.filter(([path]) =>
    path === "/cloud/track3-backup/device-a/metadata.json")).toHaveLength(1);
});
