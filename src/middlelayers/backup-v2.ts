import CryptoJS from "crypto-js";
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { HistoricalData } from "./types";
import { redactSecrets } from "./security/redact";

export type BackupRecords = Pick<
  HistoricalData,
  "createdAt" | "assets" | "transactions" | "total"
>[];

export type BackupPart = {
  file: string;
  month: string;
  records: number;
  bytes: number;
  sha256: string;
};

export type BackupMetadata = {
  formatVersion: 2;
  client: string;
  clientVersion: string;
  exportAt: string;
  parts: BackupPart[];
  metaHash: string;
};

const digest = (text: string) => CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
const validClient = (client: string) => /^[A-Za-z0-9-]+$/.test(client);
const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const validHash = (hash: string) => /^[a-f0-9]{64}$/.test(hash);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const fields = value as Record<string, unknown>;
    return `{${Object.keys(fields)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(fields[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function groupByMonth(
  records: BackupRecords,
): Map<string, BackupRecords> {
  const grouped = new Map<string, BackupRecords>();
  for (const record of records) {
    const date = new Date(record.createdAt);
    if (!Number.isFinite(date.getTime())) {
      console.error("skipping historical record with invalid createdAt", redactSecrets(record.createdAt));
      continue;
    }
    const month = date.toISOString().slice(0, 7);
    const group = grouped.get(month) ?? [];
    group.push(record);
    grouped.set(month, group);
  }
  return grouped;
}

function metadataPayload(
  client: string,
  clientVersion: string,
  exportAt: string,
  parts: BackupPart[],
) {
  return { formatVersion: 2 as const, client, clientVersion, exportAt, parts };
}

export function buildMetadata(
  client: string,
  clientVersion: string,
  exportAt: string,
  parts: BackupPart[],
): BackupMetadata {
  const payload = metadataPayload(client, clientVersion, exportAt, parts);
  return { ...payload, metaHash: digest(canonicalJson(payload)) };
}

export function parseMetadata(
  text: string,
  expectedClient: string,
): BackupMetadata | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    const metadata = value as Record<string, unknown>;
    if (
      metadata.formatVersion !== 2 ||
      metadata.client !== expectedClient ||
      !validClient(expectedClient) ||
      typeof metadata.clientVersion !== "string" ||
      !metadata.clientVersion ||
      typeof metadata.exportAt !== "string" ||
      !Number.isFinite(Date.parse(metadata.exportAt)) ||
      !Array.isArray(metadata.parts) ||
      typeof metadata.metaHash !== "string" ||
      !validHash(metadata.metaHash)
    ) {
      return;
    }
    if (Object.keys(metadata).length !== 6) {
      return;
    }
    const months = new Set<string>();
    for (const item of metadata.parts) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return;
      }
      const part = item as Record<string, unknown>;
      if (
        Object.keys(part).length !== 5 ||
        typeof part.month !== "string" ||
        !validMonth(part.month) ||
        typeof part.sha256 !== "string" ||
        !validHash(part.sha256) ||
        part.file !== `${part.month}.${part.sha256.slice(0, 8)}.json` ||
        !Number.isSafeInteger(part.records) ||
        (part.records as number) < 1 ||
        !Number.isSafeInteger(part.bytes) ||
        (part.bytes as number) < 1 ||
        months.has(part.month)
      ) {
        return;
      }
      months.add(part.month);
    }
    const payload = metadataPayload(
      expectedClient,
      metadata.clientVersion,
      metadata.exportAt,
      metadata.parts as BackupPart[],
    );
    if (digest(canonicalJson(payload)) !== metadata.metaHash) {
      return;
    }
    return { ...payload, metaHash: metadata.metaHash };
  } catch {
    return;
  }
}

export function planWrites(
  parts: BackupPart[],
  current: BackupMetadata | undefined,
  files: Set<string>,
): BackupPart[] {
  return parts.filter(
    (part) =>
      !current?.parts.some(
        (old) => old.month === part.month && old.sha256 === part.sha256,
      ) || !files.has(part.file),
  );
}

export function verifyPart(text: string, part: BackupPart): BackupRecords {
  if (
    new TextEncoder().encode(text).length !== part.bytes ||
    digest(text) !== part.sha256
  ) {
    throw new Error("invalid backup part checksum");
  }
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid backup part");
  }
  const records = (parsed as { historicalData?: unknown }).historicalData;
  if (
    !Array.isArray(records) ||
    records.length !== part.records ||
    !records.every(
      (record) =>
        record &&
        typeof record === "object" &&
        typeof record.createdAt === "string" &&
        Number.isFinite(Date.parse(record.createdAt)) &&
        new Date(record.createdAt).toISOString().slice(0, 7) === part.month &&
        Array.isArray(record.assets) &&
        Array.isArray(record.transactions) &&
        typeof record.total === "number" &&
        Number.isFinite(record.total),
    )
  ) {
    throw new Error("invalid backup part records");
  }
  return records as BackupRecords;
}

export async function writeBackupV2(
  directory: string,
  client: string,
  clientVersion: string,
  records: BackupRecords,
): Promise<void> {
  if (!validClient(client)) throw new Error("invalid client ID for backup");
  const clientDirectory = `${directory}/track3-backup/${client}`;
  const dataDirectory = `${clientDirectory}/data`;
  const metadataPath = `${clientDirectory}/metadata.json`;
  await mkdir(dataDirectory, { recursive: true });

  let current: BackupMetadata | undefined;
  if (await exists(metadataPath)) {
    try {
      current = parseMetadata(await readTextFile(metadataPath), client);
    } catch (error) {
      console.error("failed to read existing backup metadata", redactSecrets(String(error)));
    }
  }
  const files = new Set(
    (await readDir(dataDirectory))
      .filter((entry) => entry.isFile && !entry.isSymlink)
      .map((entry) => entry.name),
  );
  const parts: BackupPart[] = [];
  for (const [month, monthlyRecords] of groupByMonth(records)) {
    const text = JSON.stringify({ historicalData: monthlyRecords });
    const sha256 = digest(text);
    const part: BackupPart = {
      file: `${month}.${sha256.slice(0, 8)}.json`,
      month,
      records: monthlyRecords.length,
      bytes: new TextEncoder().encode(text).length,
      sha256,
    };
    parts.push(part);
    if (planWrites([part], current, files).length > 0) {
      await writeTextFile(`${dataDirectory}/${part.file}`, text);
    }
  }

  const metadata = buildMetadata(
    client,
    clientVersion,
    new Date().toISOString(),
    parts,
  );
  await writeTextFile(`${metadataPath}.tmp`, JSON.stringify(metadata));
  await rename(`${metadataPath}.tmp`, metadataPath);

  const referenced = new Set(parts.map((part) => part.file));
  try {
    for (const entry of await readDir(dataDirectory)) {
      if (entry.isFile && !entry.isSymlink && !referenced.has(entry.name)) {
        try {
          await remove(`${dataDirectory}/${entry.name}`);
        } catch (error) {
          console.error("failed to remove old backup part", redactSecrets(String(error)));
        }
      }
    }
  } catch (error) {
    console.error("failed to list old backup parts", redactSecrets(String(error)));
  }
}

export async function importBackupV2(
  directory: string,
  client: string,
  getHash: (client: string, month: string) => string | undefined,
  saveHash: (client: string, month: string, hash: string) => Promise<void>,
  importPart: (records: BackupRecords, metadata: BackupMetadata) => Promise<void>,
): Promise<{ imported: boolean; clientsWithV2: Set<string> }> {
  const root = `${directory}/track3-backup`;
  const clientsWithV2 = new Set<string>();
  let imported = false;
  if (!(await exists(root))) {
    return { imported, clientsWithV2 };
  }
  let entries;
  try {
    entries = await readDir(root);
  } catch (error) {
    console.error("failed to list backup clients", redactSecrets(String(error)));
    return { imported, clientsWithV2 };
  }
  for (const entry of entries) {
    if (
      !entry.isDirectory ||
      entry.isSymlink ||
      entry.name === client ||
      !validClient(entry.name)
    ) {
      continue;
    }
    const clientDirectory = `${root}/${entry.name}`;
    let metadata: BackupMetadata | undefined;
    try {
      metadata = parseMetadata(
        await readTextFile(`${clientDirectory}/metadata.json`),
        entry.name,
      );
    } catch (error) {
      console.error("failed to read backup metadata", redactSecrets(entry.name), redactSecrets(String(error)));
    }
    if (!metadata) {
      console.error("invalid backup metadata", redactSecrets(entry.name));
      continue;
    }
    clientsWithV2.add(entry.name);
    for (const part of metadata.parts) {
      if (getHash(entry.name, part.month) === part.sha256) continue;
      try {
        const text = await readTextFile(`${clientDirectory}/data/${part.file}`);
        const records = verifyPart(text, part);
        await importPart(records, metadata);
        imported = true;
        await saveHash(entry.name, part.month, part.sha256);
      } catch (error) {
        console.error("failed to import backup part", redactSecrets(entry.name), part.month, redactSecrets(String(error)));
      }
    }
  }
  return { imported, clientsWithV2 };
}
