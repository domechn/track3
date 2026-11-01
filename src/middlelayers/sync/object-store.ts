import { decryptObject, encryptObject, objectName, type SyncHeader } from "./crypto";

export class S3Error extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "S3Error";
  }
}

export class SyncTimeoutError extends Error {
  constructor() {
    super("Sync timed out");
    this.name = "SyncTimeoutError";
  }
}

export function isS3Conflict(error: unknown): boolean {
  return error instanceof S3Error && (error.status === 409 || error.status === 412);
}

export type WriteConditions = { ifMatch?: string; ifNoneMatch?: "*" };
export type StoredObject = { body: Uint8Array; etag: string; lastModified?: string };
export type NotModifiedObject = { notModified: true; etag: string; lastModified?: string };
export type ListedObject = { key: string; etag: string; size: number; lastModified?: string };
export type ListOptions = { prefix?: string; delimiter?: string; continuationToken?: string; signal?: AbortSignal };
export type ListPage = { objects: ListedObject[]; commonPrefixes?: string[]; nextContinuationToken?: string };
export const listResponseBytes: unique symbol = Symbol("listResponseBytes");
export type StoreRetry = {
  verb: "GET" | "PUT" | "LIST" | "DELETE" | "HEAD";
  status: number;
  bytesSent: number;
  bytesReceived: number;
  waitMs: number;
  resumed: boolean;
};

export interface S3Store {
  putObject(key: string, body: Uint8Array, conditions?: WriteConditions, signal?: AbortSignal): Promise<{ etag: string }>;
  getObject(key: string, signal?: AbortSignal): Promise<StoredObject | null>;
  getObject(key: string, signal: AbortSignal | undefined, ifNoneMatch: string): Promise<StoredObject | NotModifiedObject | null>;
  headObject(key: string, signal?: AbortSignal): Promise<{ etag: string; size: number } | null>;
  deleteObject(key: string, signal?: AbortSignal): Promise<void>;
  listObjectsV2(options?: ListOptions): Promise<ListPage>;
  observeRetries?(listener: (retry: StoreRetry) => void): () => void;
}

export async function writeSyncHeader(store: S3Store, header: SyncHeader): Promise<{ etag: string }> {
  return store.putObject("sync-header", new TextEncoder().encode(JSON.stringify(header)), { ifNoneMatch: "*" });
}

export async function readSyncHeader(store: S3Store): Promise<SyncHeader | null> {
  const object = await store.getObject("sync-header");
  if (!object || !("body" in object)) return null;
  if (object.body.length > 4096) throw new Error("Invalid sync header");
  const header: unknown = JSON.parse(new TextDecoder().decode(object.body));
  if (!header || typeof header !== "object" || !("kdf" in header) || !("keyCheck" in header)) {
    throw new Error("Invalid sync header");
  }
  return header as SyncHeader;
}

export class FakeS3 implements S3Store {
  private readonly objects = new Map<string, StoredObject>();
  private readonly modified = new Map<string, string>();
  private generation = 0;

  constructor(private readonly pageSize = 1000, private readonly conflictStatus: 409 | 412 = 412) {}

  async putObject(key: string, body: Uint8Array, conditions: WriteConditions = {}, signal?: AbortSignal): Promise<{ etag: string }> {
    if (signal?.aborted) throw new Error("S3 request aborted");
    const current = this.objects.get(key);
    if ((conditions.ifNoneMatch === "*" && current) ||
      (conditions.ifMatch !== undefined && (!current || current.etag !== conditions.ifMatch))) {
      throw new S3Error("S3 precondition failed", this.conflictStatus);
    }
    const etag = `"fake-${++this.generation}"`;
    this.objects.set(key, { body: body.slice(), etag });
    this.modified.set(key, new Date().toISOString());
    return { etag };
  }

  getObject(key: string, signal?: AbortSignal): Promise<StoredObject | null>;
  getObject(key: string, signal: AbortSignal | undefined, ifNoneMatch: string): Promise<StoredObject | NotModifiedObject | null>;
  async getObject(key: string, signal?: AbortSignal, ifNoneMatch?: string): Promise<StoredObject | NotModifiedObject | null> {
    if (signal?.aborted) throw new Error("S3 request aborted");
    const object = this.objects.get(key);
    if (!object) return null;
    if (ifNoneMatch === object.etag) return { notModified: true, etag: object.etag, lastModified: this.modified.get(key) };
    return { body: object.body.slice(), etag: object.etag, lastModified: this.modified.get(key) };
  }

  async headObject(key: string, signal?: AbortSignal): Promise<{ etag: string; size: number } | null> {
    if (signal?.aborted) throw new Error("S3 request aborted");
    const object = this.objects.get(key);
    return object ? { etag: object.etag, size: object.body.length } : null;
  }

  async deleteObject(key: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new Error("S3 request aborted");
    this.objects.delete(key);
    this.modified.delete(key);
  }

  async listObjectsV2(options: ListOptions = {}): Promise<ListPage> {
    if (options.signal?.aborted) throw new Error("S3 request aborted");
    const keys = [...this.objects.keys()].filter((key) => key.startsWith(options.prefix ?? "")).sort();
    const entries = options.delimiter ? [...new Set(keys.map((key) => {
      const suffix = key.slice((options.prefix ?? "").length);
      const slash = suffix.indexOf(options.delimiter!);
      return slash < 0 ? key : (options.prefix ?? "") + suffix.slice(0, slash + options.delimiter!.length);
    }))] : keys;
    const start = options.continuationToken
      ? entries.findIndex((key) => key > options.continuationToken!)
      : 0;
    const page = entries.slice(start < 0 ? entries.length : start, (start < 0 ? entries.length : start) + this.pageSize);
    return {
      objects: page.filter((key) => this.objects.has(key)).map((key) => ({
        key, etag: this.objects.get(key)!.etag, size: this.objects.get(key)!.body.length,
        lastModified: this.modified.get(key),
      })),
      ...(options.delimiter ? { commonPrefixes: page.filter((key) => !this.objects.has(key)) } : {}),
      nextContinuationToken: page.length && entries.indexOf(page[page.length - 1]) < entries.length - 1
        ? page[page.length - 1]
        : undefined,
    };
  }
}

type JsonRecord<T> = { path: string; value: T };

export class EncryptedStore {
  constructor(private readonly store: S3Store, private readonly key: Uint8Array) {}

  async putJson<T>(path: string, value: T, conditions?: WriteConditions, signal?: AbortSignal): Promise<{ etag: string }> {
    if (signal?.aborted) throw new Error("S3 request aborted");
    const name = await objectName(this.key, path);
    const payload: JsonRecord<T> = { path, value };
    const envelope = await encryptObject(this.key, name, new TextEncoder().encode(JSON.stringify(payload)));
    return this.store.putObject(name, new TextEncoder().encode(JSON.stringify(envelope)), conditions, signal);
  }

  async putManifest<T>(path: string, value: T, previousEtag?: string, signal?: AbortSignal): Promise<{ etag: string }> {
    return this.putJson(path, value, previousEtag !== undefined ? { ifMatch: previousEtag } : { ifNoneMatch: "*" }, signal);
  }

  async getJson<T>(path: string, signal?: AbortSignal): Promise<{ value: T; etag: string } | null> {
    if (signal?.aborted) throw new Error("S3 request aborted");
    const name = await objectName(this.key, path);
    const object = await this.store.getObject(name, signal);
    if (!object || !("body" in object)) return null;
    const record = await this.readRecord<T>(name, object.body);
    if (record.path !== path) throw new Error("Sync object path mismatch");
    return { value: record.value, etag: object.etag };
  }

  async listJson<T>(prefix: string, signal?: AbortSignal): Promise<Array<{ path: string; value: T; etag: string }>> {
    if (signal?.aborted) throw new Error("S3 request aborted");
    const kind = prefix.split("/")[0];
    if (!/^[a-z][a-z0-9-]*$/.test(kind)) throw new Error("Invalid sync prefix");
    const found: Array<{ path: string; value: T; etag: string }> = [];
    let continuationToken: string | undefined;
    do {
      const page = await this.store.listObjectsV2({ prefix: `${kind}/`, continuationToken, signal });
      for (const item of page.objects) {
        const object = await this.store.getObject(item.key, signal);
        if (!object || !("body" in object)) continue;
        const record = await this.readRecord<T>(item.key, object.body);
        if (await objectName(this.key, record.path) !== item.key) throw new Error("Sync object path mismatch");
        if (record.path.startsWith(prefix)) found.push({ path: record.path, value: record.value, etag: object.etag });
      }
      continuationToken = page.nextContinuationToken;
    } while (continuationToken);
    return found;
  }

  async deleteJson(path: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new Error("S3 request aborted");
    await this.store.deleteObject(await objectName(this.key, path), signal);
  }

  private async readRecord<T>(name: string, bytes: Uint8Array): Promise<JsonRecord<T>> {
    const envelope = JSON.parse(new TextDecoder().decode(bytes));
    const record = JSON.parse(new TextDecoder().decode(await decryptObject(this.key, name, envelope)));
    if (!record || typeof record.path !== "string" || !Object.hasOwn(record, "value")) {
      throw new Error("Invalid sync object");
    }
    return record;
  }
}
