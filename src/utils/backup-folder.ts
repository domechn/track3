import { exists, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { importBackupV2, parseMetadata, type BackupRecords } from "@/middlelayers/backup-v2";
import type { ExportData } from "@/middlelayers/datamanager";

export type BackupFolder = { directory: string; normalized: boolean; legacy: boolean };
export type BackupClient = { client: string; exportAt: string; months: number };

export async function findBackupFolder(picked: string): Promise<BackupFolder | undefined> {
  const selected = picked.replace(/\/+$/, "");
  const parts = selected.split("/");
  const level = parts.lastIndexOf("track3-backup");
  if (level >= 0 && parts.length - level <= 2) {
    const directory = parts.slice(0, level).join("/") || "/";
    const valid = parts.length - level === 1
      ? await exists(selected)
      : await exists(`${selected}/metadata.json`);
    if (valid) return { directory, normalized: true, legacy: false };
  }
  const legacy = await exists(`${selected}/track3-auto-backup.json`);
  if (await exists(`${selected}/track3-backup`) || legacy) {
    return { directory: selected, normalized: false, legacy };
  }
}

export async function listBackupClients(directory: string, selected = directory): Promise<BackupClient[]> {
  const root = `${directory}/track3-backup`;
  const selectedClient = selected.startsWith(`${root}/`) && !selected.slice(root.length + 1).includes("/")
    ? selected.slice(root.length + 1) : undefined;
  if (!selectedClient && !await exists(root)) return [];
  const entries = selectedClient
    ? [{ name: selectedClient, isDirectory: true, isSymlink: false }]
    : await readDir(root);
  const clients: BackupClient[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory || entry.isSymlink || !/^[A-Za-z0-9-]+$/.test(entry.name)) continue;
    const metadata = parseMetadata(await readTextFile(`${root}/${entry.name}/metadata.json`), entry.name);
    if (metadata) clients.push({ client: entry.name, exportAt: metadata.exportAt, months: metadata.parts.length });
  }
  return clients.sort((a, b) => b.exportAt.localeCompare(a.exportAt));
}

export async function readBackupClient(directory: string, client: string): Promise<ExportData> {
  if (!/^[A-Za-z0-9-]+$/.test(client)) throw new Error("Invalid backup client");
  const root = `${directory}/track3-backup/${client}`;
  const metadata = parseMetadata(await readTextFile(`${root}/metadata.json`), client);
  if (!metadata) throw new Error("Invalid backup metadata");
  const historicalData: BackupRecords = [];
  await importBackupV2(directory, "", () => undefined, async () => {}, async (records) => {
    historicalData.push(...records);
  }, { onlyClient: client, strict: true });
  return { client, clientVersion: metadata.clientVersion, exportAt: metadata.exportAt, historicalData, md5V2: "" };
}
