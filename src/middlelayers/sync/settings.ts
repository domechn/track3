import { invoke } from "@tauri-apps/api/core";
import { executeWrite, getDatabase } from "@/middlelayers/database";
import { runWithEncryptionWriteGate } from "@/middlelayers/encryption-write-gate";
import { unlockSyncHeader } from "./crypto";
import { isS3Conflict, readSyncHeader, S3Error, type S3Store } from "./object-store";
import { S3Client } from "./s3-client";

export type SyncCategoryName = "history" | "settings" | "secrets" | "rebalance" | "chat";
export type SyncSettings = {
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathStyle: boolean;
  categories: Record<SyncCategoryName, boolean>;
  enabled: boolean;
  deviceNames: Record<string, string>;
};

const syncConfigId = "991";

export const defaultSyncSettings: SyncSettings = {
  endpoint: "", region: "", bucket: "", prefix: "", accessKeyId: "", secretAccessKey: "",
  pathStyle: true,
  categories: { history: true, settings: true, secrets: true, rebalance: true, chat: true },
  enabled: false, deviceNames: {},
};

export function createSyncStore(settings: SyncSettings): S3Store {
  return new S3Client({
    endpoint: settings.endpoint.trim(), region: settings.region.trim(), bucket: settings.bucket.trim(),
    prefix: settings.prefix.trim().replace(/^\/+|\/+$/g, ""), accessKeyId: settings.accessKeyId.trim(),
    secretAccessKey: settings.secretAccessKey, addressingStyle: settings.pathStyle ? "path" : "virtual",
  });
}

export function validateSyncSettings(settings: SyncSettings): "configuration" | null {
  try {
    createSyncStore(settings);
    return null;
  } catch {
    return "configuration";
  }
}

export type SyncConnectionResult = "ok" | "configuration" | "access" | "bucket" | "network" | "header" | "passphrase" | "conditions";

export function classifySyncError(error: unknown): Exclude<SyncConnectionResult, "ok"> {
  if (error instanceof Error && (error.message === "Invalid S3 configuration" ||
    error.message === "Invalid S3 virtual-host endpoint")) return "configuration";
  if (error instanceof SyntaxError || error instanceof Error && (
    error.message === "Invalid sync header" || error.message === "Unsupported sync header" ||
    error.message === "Invalid sync format")) return "header";
  if (error instanceof Error && error.message === "Incorrect sync passphrase or damaged header") return "passphrase";
  if (error instanceof Error && error.message === "Sync store does not enforce conditional writes") return "conditions";
  if (error instanceof S3Error) {
    if (error.status === 401 || error.status === 403) return "access";
    if (error.status === 404) return "bucket";
  }
  return "network";
}

export async function testSyncConnection(store: S3Store, passphrase: string): Promise<SyncConnectionResult> {
  try {
    await store.listObjectsV2({ prefix: "devices/" });
    const header = await readSyncHeader(store);
    if (header) {
      if (!passphrase) return "passphrase";
      try {
        await unlockSyncHeader(header, passphrase);
      } catch (error) {
        if (error instanceof Error && error.message === "Incorrect sync passphrase or damaged header") return "passphrase";
        return "header";
      }
    }
    const probe = `devices/probe/${crypto.randomUUID()}`;
    const body = new TextEncoder().encode("track3-connection-probe");
    await store.putObject(probe, body, { ifNoneMatch: "*" });
    try {
      try {
        await store.putObject(probe, body, { ifNoneMatch: "*" });
        return "conditions";
      } catch (error) {
        if (!isS3Conflict(error)) throw error;
      }
      try {
        await store.putObject(probe, body, { ifMatch: '"stale-etag"' });
        return "conditions";
      } catch (error) {
        if (!isS3Conflict(error)) throw error;
      }
    } finally {
      await store.deleteObject(probe);
    }
    return "ok";
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error && error.message === "Invalid sync header") return "header";
    return classifySyncError(error);
  }
}

export async function loadSyncSettings(): Promise<SyncSettings> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ data: string }>>("SELECT data FROM configuration WHERE id = ?", [syncConfigId]);
  if (!rows[0]) return { ...defaultSyncSettings, categories: { ...defaultSyncSettings.categories }, deviceNames: {} };
  const data = await invoke<string>("decrypt", { data: rows[0].data });
  const saved = JSON.parse(data) as Partial<SyncSettings>;
  return {
    ...defaultSyncSettings, ...saved,
    categories: {
      history: saved.categories?.history ?? true,
      settings: saved.categories?.settings ?? true,
      secrets: saved.categories?.secrets ?? true,
      rebalance: saved.categories?.rebalance ?? true,
      chat: saved.categories?.chat ?? true,
    },
    deviceNames: saved.deviceNames ?? {},
  };
}

export async function saveSyncSettings(settings: SyncSettings): Promise<void> {
  await runWithEncryptionWriteGate(async () => {
    const encrypted = await invoke<string>("encrypt", { data: JSON.stringify(settings) });
    await executeWrite("INSERT OR REPLACE INTO configuration (id, data) VALUES (?, ?)", [syncConfigId, encrypted]);
  });
}
