import { decryptObject, encryptObject, objectName, unlockSyncHeader } from "./crypto";
import { isS3Conflict, readSyncHeader, type S3Store } from "./object-store";
import { compareClock, nextClock, validRemoteClock, type Hlc } from "./clock";
import { syncCategory, type SyncCategory } from "./config-keys";

export type Snapshot = {
  uuid: string;
  assets: Array<Record<string, unknown>>;
  prices: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
};
export type SyncMessage = { id: string; at: string; role: string; [key: string]: unknown };
export type SyncSession = {
  id: string; title: string; createdAt: string; updatedAt: string;
  pinned: 0 | 1; messageCount: number; preview: string;
  messages: SyncMessage[]; summary?: unknown;
};
type Kind = "snapshot" | "config" | "session" | "tombstone" | "session-delete" | "edit";
type Entry = { kind: Kind; id: string; version: string; bytes: number; sha256: string };
type Manifest = { version: 1; deviceId: string; name?: string; entries: Entry[] };
type ObjectParts = { multipart: 1; total: number; parts: Array<{ bytes: number; sha256: string }> };
type ConfigVersion = { value: string | null; clock: Hlc };
type ConfigMarker = { clock: Hlc; hash: string };
type Tombstone = { deleted: boolean; clock: Hlc };
type FieldEvent<T> = { value: T; clock: Hlc };
type TransactionEvents = Record<string, { price?: FieldEvent<number>; txnType?: FieldEvent<string> }>;
type SnapshotEdit = {
  clock: Hlc; snapshot: Snapshot;
  rowEvents?: Record<string, Tombstone>;
  txnEvents?: TransactionEvents;
};

export type SyncState = {
  deviceId?: string;
  clock?: Hlc;
  headerSalt?: string;
  known?: string[];
  published?: string[];
  config?: Record<string, ConfigMarker>;
  pendingConfig?: Record<string, ConfigMarker>;
  configConflicts?: Record<string, string>;
  configResolutions?: Record<string, { token: string; choice: "local" | "remote" }>;
  applyingConfig?: Record<string, { owner: string; entry: Entry }>;
  tombstones?: Record<string, Tombstone>;
  pendingTombstones?: Record<string, Tombstone>;
  sessionHashes?: Record<string, string>;
  trackedSessions?: string[];
  sessionDeletions?: Record<string, Hlc>;
  pendingSessionDeletions?: Record<string, Hlc>;
  snapshotHashes?: Record<string, string>;
  snapshotRevision?: number;
  snapshotEdits?: Record<string, Hlc>;
  pendingSnapshotEdits?: Record<string, Hlc>;
  assetRows?: Record<string, string[]>;
  rowEvents?: Record<string, Record<string, Tombstone>>;
  transactionRows?: Record<string, Record<string, { price: number; txnType: string }>>;
  transactionEvents?: Record<string, TransactionEvents>;
  lastSync?: number;
};

export function resetSyncState(state: SyncState): SyncState {
  return {
    deviceId: state.deviceId, clock: state.clock,
    pendingTombstones: state.pendingTombstones,
    tombstones: { ...state.pendingTombstones },
    trackedSessions: state.trackedSessions,
    pendingSessionDeletions: state.pendingSessionDeletions,
    sessionDeletions: { ...state.sessionDeletions, ...state.pendingSessionDeletions },
  };
}

export interface SyncRepository {
  loadState(): Promise<SyncState>;
  saveState(state: SyncState): Promise<void>;
  listSnapshotIds(): Promise<string[]>;
  listChangedSnapshotIds?(since?: number): Promise<{ ids: string[]; revision: number }>;
  readSnapshot(uuid: string): Promise<Snapshot>;
  importSnapshot(snapshot: Snapshot): Promise<boolean>;
  replaceSnapshot(snapshot: Snapshot): Promise<void>;
  deleteSnapshot(uuid: string): Promise<void>;
  listConfig(): Promise<Record<string, string>>;
  writeConfig(id: string, value: string | null): Promise<void>;
  listSessions(): Promise<SyncSession[]>;
  listSessionIds(): Promise<string[]>;
  takeReadErrors?(): { configIds: string[]; sessionIds: string[] };
  writeSession(session: SyncSession): Promise<void>;
  deleteSession(id: string): Promise<void>;
  dataChanged(): void;
}

export type SyncReport = {
  pulled: number; pushed: number; tombstonesApplied: number; configChanges: number;
  conflicts: string[]; errors: string[]; pulledFrom?: string[];
  devices?: Array<{ id: string; name?: string; lastUpload?: string }>;
};
export type SyncOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: { phase: "pull" | "push"; completed: number; total: number }) => void;
  categories?: Partial<Record<SyncCategory | "chat" | "history", boolean>>;
  dryRun?: boolean;
  deviceName?: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_OBJECT_BYTES = 32 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 256 * 1024 * 1024;
const PART_BYTES = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function validEntry(value: Entry): boolean {
  return value && ["snapshot", "config", "session", "tombstone", "session-delete", "edit"].includes(value.kind) &&
    typeof value.id === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(value.id) &&
    typeof value.version === "string" && /^[a-f0-9-]{1,64}$/.test(value.version) &&
    Number.isSafeInteger(value.bytes) && value.bytes > 0 && value.bytes <= MAX_OBJECT_BYTES &&
    typeof value.sha256 === "string" && /^[a-f0-9]{64}$/.test(value.sha256);
}

function validObjectParts(value: ObjectParts): boolean {
  return value && value.multipart === 1 && Number.isSafeInteger(value.total) &&
    value.total > 0 && value.total <= MAX_PAYLOAD_BYTES &&
    Array.isArray(value.parts) && value.parts.length > 0 &&
    value.parts.length <= Math.ceil(MAX_PAYLOAD_BYTES / PART_BYTES) &&
    value.parts.every((part) => Number.isSafeInteger(part.bytes) && part.bytes > 0 &&
      part.bytes <= MAX_OBJECT_BYTES && /^[a-f0-9]{64}$/.test(part.sha256));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const fields = value as Record<string, unknown>;
    return `{${Object.keys(fields).filter((key) => fields[key] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(fields[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function digest(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function entryToken(owner: string, entry: Entry): string {
  return `${owner}:${entry.kind}:${entry.id}:${entry.version}`;
}

function orderedMessages(messages: SyncMessage[]): SyncMessage[] {
  return messages.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

export function mergeSessions(local: SyncSession | undefined, remote: SyncSession): SyncSession {
  const valid = (session: SyncSession) => typeof session.id === "string" && session.id.length > 0 &&
    Array.isArray(session.messages) && session.messages.every((message) =>
      typeof message.id === "string" && message.id.length > 0 && message.id.length <= 128 &&
      typeof message.at === "string" && Number.isFinite(Date.parse(message.at)) &&
      (message.role === "user" && typeof message.content === "string" ||
        message.role === "assistant" && Array.isArray(message.blocks)));
  if (!valid(remote) || local && !valid(local)) throw new Error("Invalid sync session messages");
  if (!local) return remote;
  const metadata = (session: SyncSession) => {
    const { messages: _messages, messageCount: _count, ...meta } = session;
    return canonical(meta);
  };
  const latest = remote.updatedAt > local.updatedAt ||
    remote.updatedAt === local.updatedAt && metadata(remote) > metadata(local) ? remote : local;
  const messages = new Map(local.messages.map((message) => [message.id, message]));
  const actionRank = (status: unknown) => status === "pending" ? 0 : status === "executing" ? 2 :
    ["expired", "rejected"].includes(String(status)) ? 1 :
      ["approved", "failed"].includes(String(status)) ? 3 : -1;
  for (const message of remote.messages) {
    const previous = messages.get(message.id);
    if (!previous) { messages.set(message.id, message); continue; }
    const preferred = latest === remote ? message : previous;
    const other = latest === remote ? previous : message;
    if (preferred.role !== "assistant" || other.role !== "assistant") {
      messages.set(message.id, preferred);
      continue;
    }
    const blocks = (preferred.blocks as Array<Record<string, unknown>>).map((block) => {
      if (block.kind !== "pending_action") return block;
      const alternative = (other.blocks as Array<Record<string, unknown>>).find((candidate) =>
        candidate.kind === "pending_action" && candidate.id === block.id);
      return alternative && actionRank(alternative.status) > actionRank(block.status) ? alternative : block;
    });
    messages.set(message.id, { ...preferred, blocks });
  }
  return { ...latest, messages: orderedMessages([...messages.values()]), messageCount: messages.size };
}

function snapshotContent(snapshot: Snapshot): string {
  const identities = new Map(snapshot.assets.map((row) =>
    [row.id, `${row.asset_type}:${row.wallet ?? ""}:${row.symbol}`]));
  const withoutLocalIds = (row: Record<string, unknown>) => {
    const { id: _id, assetID: _assetId, ...content } = row;
    return { ...content, ...(row.assetID === undefined ? {} : { assetIdentity: identities.get(row.assetID) }) };
  };
  const ordered = (rows: Array<Record<string, unknown>>) => rows.map(withoutLocalIds).map(canonical).sort();
  return canonical({
    uuid: snapshot.uuid,
    assets: ordered(snapshot.assets),
    prices: ordered(snapshot.prices),
    transactions: ordered(snapshot.transactions),
  });
}

async function snapshotHash(snapshot: Snapshot): Promise<string> {
  return digest(encoder.encode(snapshotContent(snapshot)));
}

async function assetKey(row: Record<string, unknown>): Promise<string> {
  return digest(encoder.encode(canonical([row.asset_type, row.wallet ?? "", row.symbol, row.createdAt])));
}

async function assetKeys(snapshot: Snapshot): Promise<string[]> {
  return Promise.all(snapshot.assets.map(assetKey));
}

async function transactionKey(row: Record<string, unknown>): Promise<string> {
  return digest(encoder.encode(canonical([
    row.asset_type, row.wallet, row.symbol, row.amount, row.txnCreatedAt, row.createdAt,
  ])));
}

async function transactionRows(snapshot: Snapshot): Promise<Record<string, { price: number; txnType: string }>> {
  const rows: Record<string, { price: number; txnType: string }> = {};
  for (const row of snapshot.transactions) {
    rows[await transactionKey(row)] = { price: row.price as number, txnType: row.txnType as string };
  }
  return rows;
}

async function applyEditEvents(
  snapshot: Snapshot, rowEvents: Record<string, Tombstone>, txnEvents: TransactionEvents,
): Promise<Snapshot> {
  const keep = new Set<number>();
  const assets: Snapshot["assets"] = [];
  for (const asset of snapshot.assets) {
    if (rowEvents[await assetKey(asset)]?.deleted) continue;
    assets.push(asset);
    keep.add(asset.id as number);
  }
  const transactions: Snapshot["transactions"] = [];
  for (const row of snapshot.transactions) {
    if (!keep.has(row.assetID as number)) continue;
    const events = txnEvents[await transactionKey(row)];
    transactions.push({
      ...row,
      ...(events?.price ? { price: events.price.value } : {}),
      ...(events?.txnType ? { txnType: events.txnType.value } : {}),
    });
  }
  return {
    ...snapshot, assets,
    prices: snapshot.prices.filter((row) => keep.has(row.assetID as number)),
    transactions,
  };
}

export class SyncEngine {
  private workQueue: Promise<void> = Promise.resolve();
  private stateWrites: Promise<void> = Promise.resolve();
  private tombstoneQueue: Promise<void> = Promise.resolve();
  private activeState?: SyncState;

  constructor(
    private readonly store: S3Store,
    private readonly repo: SyncRepository,
    private readonly passphrase: string,
    private readonly environment: { now?: () => number } = {},
  ) {}

  private now() { return this.environment.now?.() ?? Date.now(); }

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.workQueue.then(work);
    this.workQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private saveState(state: SyncState): Promise<void> {
    const result = this.stateWrites.then(() => this.repo.saveState(state));
    this.stateWrites = result.then(() => undefined, () => undefined);
    return result;
  }

  private async device(state: SyncState, save = true): Promise<string> {
    state.deviceId ??= crypto.randomUUID();
    if (save) await this.saveState(state);
    return state.deviceId;
  }

  private tick(state: SyncState, seen?: Hlc): Hlc {
    state.clock = nextClock(state.clock, state.deviceId!, this.now(), seen);
    return state.clock;
  }

  async status(): Promise<{ deviceId: string | undefined; lastClock: Hlc | undefined; lastSync: number | undefined }> {
    const state = await this.repo.loadState();
    return { deviceId: state.deviceId, lastClock: state.clock, lastSync: state.lastSync };
  }

  async recordDeletion(uuid: string): Promise<void> { await this.recordTombstone(uuid, true); }
  async recordUndo(uuid: string): Promise<void> { await this.recordTombstone(uuid, false); }

  private async recordTombstone(uuid: string, deleted: boolean): Promise<void> {
    const result = this.tombstoneQueue.then(() => this.writeTombstone(uuid, deleted));
    this.tombstoneQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async writeTombstone(uuid: string, deleted: boolean): Promise<void> {
    const state = this.activeState ?? await this.repo.loadState();
    await this.device(state);
    const event = { deleted, clock: this.tick(state, state.tombstones?.[uuid]?.clock) };
    (state.tombstones ??= {})[uuid] = event;
    (state.pendingTombstones ??= {})[uuid] = event;
    await this.saveState(state);
  }

  async dryRun(options: Omit<SyncOptions, "dryRun"> = {}): Promise<SyncReport> {
    return this.syncOnce({ ...options, dryRun: true });
  }

  configConflicts(): Promise<Array<{ id: string }>> {
    return this.repo.loadState().then((state) => Object.keys(state.configConflicts ?? {}).map((id) => ({ id })));
  }

  resolveConfigConflict(id: string, choice: "local" | "remote"): Promise<void> {
    return this.exclusive(async () => {
      const state = await this.repo.loadState();
      const token = state.configConflicts?.[id];
      if (!token) throw new Error("Config conflict is no longer available");
      (state.configResolutions ??= {})[id] = { token, choice };
      state.known = state.known?.filter((known) => known !== token);
      await this.repo.saveState(state);
    });
  }

  syncOnce(options: SyncOptions = {}): Promise<SyncReport> {
    return this.exclusive(async () => {
      try { return await this.syncRound(options); }
      finally { this.activeState = undefined; }
    });
  }

  private async syncRound(options: SyncOptions): Promise<SyncReport> {
    const report: SyncReport = { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] };
    if (options.signal?.aborted) throw new Error("Sync aborted");
    const header = await readSyncHeader(this.store);
    if (!header) throw new Error("Sync has not been initialized");
    const key = await unlockSyncHeader(header, this.passphrase);
    if (options.signal?.aborted) throw new Error("Sync aborted");
    const stateReady = this.tombstoneQueue.then(async () => {
      let state = await this.repo.loadState();
      if (state.headerSalt && state.headerSalt !== header.kdf.salt) state = resetSyncState(state);
      state.headerSalt = header.kdf.salt;
      this.activeState = state;
      return state;
    });
    this.tombstoneQueue = stateReady.then(() => undefined, () => undefined);
    const state = await stateReady;
    const hkdf = await crypto.subtle.importKey("raw", key, "HKDF", false, ["deriveKey"]);
    const secretKey = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: encoder.encode("track3-sync-v1"), info: encoder.encode("config-fingerprints") },
      hkdf, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"],
    );
    const configHash = async (value: string | null): Promise<string> => {
      if (value === null) return "";
      return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", secretKey, encoder.encode(value))),
        (byte) => byte.toString(16).padStart(2, "0")).join("");
    };
    const validClock = (value: Hlc, owner: string) => validRemoteClock(value, owner, this.now());
    await this.device(state, !options.dryRun);
    state.known ??= [];
    state.published ??= [];
    state.config ??= {};
    state.pendingConfig ??= {};
    state.configConflicts ??= {};
    state.configResolutions ??= {};
    state.applyingConfig ??= {};
    state.tombstones ??= {};
    state.pendingTombstones ??= {};
    state.sessionHashes ??= {};
    state.trackedSessions ??= [];
    state.sessionDeletions ??= {};
    state.pendingSessionDeletions ??= {};
    state.snapshotHashes ??= {};
    state.snapshotEdits ??= {};
    state.pendingSnapshotEdits ??= {};
    state.assetRows ??= {};
    state.rowEvents ??= {};
    state.transactionRows ??= {};
    state.transactionEvents ??= {};
    const enabled = (category: SyncCategory | "chat" | "history") => options.categories?.[category] !== false;
    const publishedSnapshotIds = new Set(state.published);
    const localIdsBeforePull = new Set(enabled("history") ? await this.repo.listSnapshotIds() : []);
    for (const id of enabled("history") ? new Set([...Object.keys(state.snapshotHashes), ...Object.keys(state.tombstones)]) : []) {
      if (state.snapshotHashes[id] && !localIdsBeforePull.has(id) && !state.tombstones[id]?.deleted) {
        const event = { deleted: true, clock: this.tick(state, state.tombstones[id]?.clock) };
        state.tombstones[id] = event;
        state.pendingTombstones[id] = event;
      } else if (localIdsBeforePull.has(id) && state.tombstones[id]?.deleted) {
        const event = { deleted: false, clock: this.tick(state, state.tombstones[id].clock) };
        state.tombstones[id] = event;
        state.pendingTombstones[id] = event;
      }
    }
    const known = new Set(state.known);
    const aborted = () => {
      if (options.signal?.aborted) {
        if (!options.dryRun && (report.pulled || report.tombstonesApplied || report.configChanges)) this.repo.dataChanged();
        throw new Error("Sync aborted");
      }
    };
    const pathFor = async (owner: string, entry: Entry) => {
      if (entry.kind === "tombstone") {
        const uuidName = (await objectName(key, `tombstone/${entry.id}`)).split("/")[1];
        const versionName = (await objectName(key, `tombstone-version/${owner}/${entry.id}/${entry.version}`)).split("/")[1];
        return `devices/${owner}/tombstone/${uuidName}/${versionName}`;
      }
      const name = (await objectName(key, `${entry.kind}/${owner}/${entry.id}/${entry.version}`)).split("/")[1];
      return `devices/${owner}/${entry.kind}/${name}`;
    };
    const readBytes = async (path: string, bytes: number, sha256: string): Promise<Uint8Array> => {
      const object = await this.store.getObject(path, options.signal);
      if (!object || object.body.length !== bytes || object.body.length > MAX_OBJECT_BYTES ||
          await digest(object.body) !== sha256) throw new Error("Invalid sync object checksum");
      return decryptObject(key, path, JSON.parse(decoder.decode(object.body)));
    };
    const readRoot = async (owner: string, entry: Entry): Promise<unknown> =>
      JSON.parse(decoder.decode(await readBytes(await pathFor(owner, entry), entry.bytes, entry.sha256)));
    const read = async <T>(owner: string, entry: Entry): Promise<T> => {
      const root = await readRoot(owner, entry);
      if (!root || typeof root !== "object" || !("multipart" in root)) return root as T;
      const descriptor = root as ObjectParts;
      if (!validObjectParts(descriptor)) throw new Error("Invalid sync object parts");
      const result = new Uint8Array(descriptor.total);
      const rootPath = await pathFor(owner, entry);
      let offset = 0;
      for (const [index, part] of descriptor.parts.entries()) {
        const bytes = await readBytes(`${rootPath}/part/${index}`, part.bytes, part.sha256);
        if (offset + bytes.length > result.length) throw new Error("Invalid sync object parts");
        result.set(bytes, offset);
        offset += bytes.length;
      }
      if (offset !== result.length) throw new Error("Invalid sync object parts");
      return JSON.parse(decoder.decode(result)) as T;
    };
    const manifests: Array<{ owner: string; manifest: Manifest; etag: string }> = [];
    report.devices = [];
    let manifestReadFailed = false;
    let continuationToken: string | undefined;
    do {
      aborted();
      const page = await this.store.listObjectsV2({ prefix: "devices/", continuationToken, signal: options.signal });
      for (const item of page.objects) {
        const match = /^devices\/([0-9a-f-]{36})\/manifest$/.exec(item.key);
        if (!match) continue;
        try {
          if (item.size > MAX_MANIFEST_BYTES) throw new Error("Invalid sync manifest");
          const object = await this.store.getObject(item.key, options.signal);
          if (!object || object.body.length > MAX_MANIFEST_BYTES) throw new Error("Invalid sync manifest");
          const manifest = JSON.parse(decoder.decode(await decryptObject(key, item.key, JSON.parse(decoder.decode(object.body))))) as Manifest;
          if (!UUID_PATTERN.test(match[1]) || manifest.version !== 1 || manifest.deviceId !== match[1] ||
              (manifest.name !== undefined && (typeof manifest.name !== "string" || !manifest.name.trim() ||
                manifest.name.length > 60)) ||
              !Array.isArray(manifest.entries) || manifest.entries.length > 100_000 ||
              !manifest.entries.every(validEntry)) throw new Error("Invalid sync manifest");
          manifests.push({ owner: match[1], manifest, etag: object.etag });
          report.devices.push({ id: match[1], name: manifest.name, lastUpload: item.lastModified });
        } catch {
          manifestReadFailed = true;
          report.errors.push("Failed to read sync manifest");
        }
      }
      continuationToken = page.nextContinuationToken;
    } while (continuationToken);
    const own = manifests.find((item) => item.owner === state.deviceId);
    const entries = manifests.flatMap(({ owner, manifest }) => manifest.entries.map((entry) => ({ owner, entry })));
    if (!manifestReadFailed) {
      const visible = new Set(entries.map(({ owner, entry }) => entryToken(owner, entry)));
      for (const token of known) if (!visible.has(token)) known.delete(token);
    }
    const blockedConfig = new Set<string>();
    for (const [id, source] of Object.entries(state.applyingConfig)) {
      if (!enabled(syncCategory(id) ?? "settings")) continue;
      if (options.dryRun) continue;
      try {
        const value = await read<ConfigVersion>(source.owner, source.entry);
        await this.repo.writeConfig(id, value.value);
        const hash = await configHash(value.value);
        state.config[id] = { clock: value.clock, hash };
        delete state.pendingConfig[id];
        delete state.applyingConfig[id];
        this.tick(state, value.clock);
        await this.saveState(state);
      } catch {
        blockedConfig.add(id);
        report.errors.push("Failed to recover config apply");
      }
    }
    const localConfig = await this.repo.listConfig();
    for (const id of this.repo.takeReadErrors?.().configIds ?? []) {
      blockedConfig.add(id);
      report.errors.push("Failed to read local config");
    }
    const remoteConfig = new Map<string, { value: ConfigVersion; owner: string; entry: Entry }>();
    const remoteTombstones = new Map<string, Tombstone>();
    const remoteSessions = new Map<string, SyncSession>();
    const remoteSessionDeletions = new Map<string, Hlc>();
    const remoteEdits = new Map<string, SnapshotEdit>();
    const remoteRowEvents = new Map<string, Record<string, Tombstone>>();
    const remoteTransactionEvents = new Map<string, TransactionEvents>();
    for (const { owner, entry } of entries.slice().sort((a, b) =>
      Number(b.entry.kind === "tombstone") - Number(a.entry.kind === "tombstone"))) {
      aborted();
      const token = entryToken(owner, entry);
      if (known.has(token) && !(entry.kind === "config" && state.configConflicts[entry.id])) continue;
      if (!enabled("history") && ["snapshot", "edit", "tombstone"].includes(entry.kind)) continue;
      try {
        if ((entry.kind === "session" || entry.kind === "session-delete") && !enabled("chat")) continue;
        if (entry.kind === "config") {
          if (!syncCategory(entry.id) || !enabled(syncCategory(entry.id)!) || blockedConfig.has(entry.id)) continue;
          const value = await read<ConfigVersion>(owner, entry);
          if (!validClock(value.clock, owner) || typeof value.value !== "string" && value.value !== null) throw new Error();
          const old = remoteConfig.get(entry.id);
          if (!old || compareClock(value.clock, old.value.clock) > 0) remoteConfig.set(entry.id, { value, owner, entry });
        } else if (entry.kind === "tombstone") {
          const value = await read<Tombstone>(owner, entry);
          if (!validClock(value.clock, owner) || typeof value.deleted !== "boolean") throw new Error();
          const old = remoteTombstones.get(entry.id);
          if (!old || compareClock(value.clock, old.clock) > 0) remoteTombstones.set(entry.id, value);
        } else if (entry.kind === "snapshot") {
          const tombstone = state.tombstones[entry.id];
          const remoteTombstone = remoteTombstones.get(entry.id);
          const deleted = remoteTombstone && (!tombstone || compareClock(remoteTombstone.clock, tombstone.clock) > 0)
            ? remoteTombstone.deleted : tombstone?.deleted;
          if (!deleted) {
            const value = await read<Snapshot>(owner, entry);
            if (value.uuid !== entry.id || !Array.isArray(value.assets) || !Array.isArray(value.prices) || !Array.isArray(value.transactions)) throw new Error();
            if (options.dryRun) {
              if (!localIdsBeforePull.has(entry.id)) report.pulled++;
            } else {
              const imported = await this.repo.importSnapshot(value);
              if (imported) {
                report.pulled++;
                (report.pulledFrom ??= []).push(owner);
              }
              const local = imported ? value : await this.repo.readSnapshot(entry.id);
              if (!imported && snapshotContent(local) !== snapshotContent(value)) {
                report.conflicts.push(`snapshot:${entry.id}`);
              } else {
                state.snapshotHashes[entry.id] ??= await snapshotHash(local);
                state.assetRows[entry.id] ??= await assetKeys(local);
                state.transactionRows[entry.id] ??= await transactionRows(local);
              }
            }
          }
        } else if (entry.kind === "edit") {
          const value = await read<SnapshotEdit>(owner, entry);
          if (!validClock(value.clock, owner) || value.snapshot?.uuid !== entry.id ||
              !Array.isArray(value.snapshot.assets) || !Array.isArray(value.snapshot.prices) ||
              !Array.isArray(value.snapshot.transactions)) throw new Error();
          for (const [rowKey, event] of Object.entries(value.rowEvents ?? {})) {
            if (!/^[a-f0-9]{64}$/.test(rowKey) || !validClock(event.clock, event.clock?.deviceId) ||
                !UUID_PATTERN.test(event.clock.deviceId) || typeof event.deleted !== "boolean") throw new Error();
            const events = remoteRowEvents.get(entry.id) ?? {};
            if (!events[rowKey] || compareClock(event.clock, events[rowKey].clock) > 0) events[rowKey] = event;
            remoteRowEvents.set(entry.id, events);
          }
          for (const [rowKey, event] of Object.entries(value.txnEvents ?? {})) {
            if (!/^[a-f0-9]{64}$/.test(rowKey) || !event || typeof event !== "object") throw new Error();
            const events = remoteTransactionEvents.get(entry.id) ?? {};
            const fields = events[rowKey] ?? {};
            for (const name of ["price", "txnType"] as const) {
              const field = event[name];
              if (!field) continue;
              if (!validClock(field.clock, field.clock?.deviceId) || !UUID_PATTERN.test(field.clock.deviceId) ||
                  name === "price" && (typeof field.value !== "number" || !Number.isFinite(field.value)) ||
                  name === "txnType" && typeof field.value !== "string") throw new Error();
              const previous = fields[name];
              if (!previous || compareClock(field.clock, previous.clock) > 0) {
                fields[name] = field as never;
              }
            }
            events[rowKey] = fields;
            remoteTransactionEvents.set(entry.id, events);
          }
          const old = remoteEdits.get(entry.id);
          if (!old || compareClock(value.clock, old.clock) > 0) remoteEdits.set(entry.id, value);
        } else if (entry.kind === "session" && enabled("chat")) {
          const value = await read<SyncSession>(owner, entry);
          if (value.id !== entry.id || !Array.isArray(value.messages)) throw new Error();
          remoteSessions.set(value.id, mergeSessions(remoteSessions.get(value.id), value));
        } else if (entry.kind === "session-delete" && enabled("chat")) {
          const value = await read<{ clock: Hlc }>(owner, entry);
          if (!validClock(value.clock, owner)) throw new Error();
          const old = remoteSessionDeletions.get(entry.id);
          if (!old || compareClock(value.clock, old) > 0) remoteSessionDeletions.set(entry.id, value.clock);
        }
        if (!options.dryRun) known.add(token);
        options.onProgress?.({ phase: "pull", completed: known.size, total: entries.length });
      } catch {
        report.errors.push(`Failed to pull ${entry.kind} object`);
      }
    }
    aborted();
    const resolvedLocalConfig = new Set<string>();
    for (const id of new Set([...Object.keys(localConfig), ...Object.keys(state.config), ...Object.keys(state.configConflicts)])) {
      const category = syncCategory(id);
      if (!category || !enabled(category) || blockedConfig.has(id)) continue;
      const value = localConfig[id] ?? null;
      const hash = await configHash(value);
      if (state.configConflicts[id]) {
        const remote = remoteConfig.get(id);
        if (remote && value === remote.value.value ||
            !remote && !manifestReadFailed && !entries.some(({ entry }) => entry.kind === "config" && entry.id === id)) {
          delete state.configConflicts[id];
          delete state.configResolutions[id];
        }
      }
      if (state.config[id]?.hash === hash) continue;
      if (state.configConflicts[id] && !remoteConfig.has(id)) continue;
      if (!state.config[id] && remoteConfig.has(id)) {
        const source = remoteConfig.get(id)!;
        const token = entryToken(source.owner, source.entry);
        if ((value !== null || !!state.configConflicts[id]) && value !== source.value.value) {
          const resolution = state.configResolutions[id];
          if (resolution?.token === token && resolution.choice === "remote") continue;
          if (resolution?.token !== token || resolution.choice !== "local") {
            state.configConflicts[id] = token;
            delete state.configResolutions[id];
            report.conflicts.push(id);
            continue;
          }
          const version = { clock: this.tick(state, source.value.clock), hash };
          state.config[id] = version;
          state.pendingConfig[id] = version;
          delete state.configConflicts[id];
          delete state.configResolutions[id];
          resolvedLocalConfig.add(id);
          continue;
        }
        continue;
      }
      const version = { clock: this.tick(state, state.config[id]?.clock), hash };
      state.config[id] = version;
      state.pendingConfig[id] = version;
    }
    const changes = enabled("history") ? await this.repo.listChangedSnapshotIds?.(state.snapshotRevision) : undefined;
    let snapshotScanFailed = false;
    const failedSnapshotIds = new Set<string>();
    const locallyChanged = new Set<string>();
    for (const id of enabled("history") ? remoteTombstones.keys() : []) {
      if (!localIdsBeforePull.has(id) || state.snapshotHashes[id]) continue;
      const edit = remoteEdits.get(id);
      const source = entries.find(({ entry }) => entry.kind === "snapshot" && entry.id === id);
      if (!edit && !source) continue;
      try {
        const local = await this.repo.readSnapshot(id);
        const original = source && await read<Snapshot>(source.owner, source.entry);
        const baseline = original && snapshotContent(local) === snapshotContent(original)
          ? original : edit?.snapshot ?? original!;
        state.snapshotHashes[id] = await snapshotHash(baseline);
        state.assetRows[id] = await assetKeys(baseline);
        state.transactionRows[id] = await transactionRows(baseline);
        if (edit && baseline === edit.snapshot) state.snapshotEdits[id] = edit.clock;
      } catch {
        failedSnapshotIds.add(id);
        report.errors.push("Failed to read remote snapshot");
      }
    }
    const snapshotIdsToScan = enabled("history") ? new Set([
      ...(changes?.ids ?? await this.repo.listSnapshotIds()),
      ...[...remoteTombstones.keys()].filter((id) => localIdsBeforePull.has(id)),
    ]) : new Set<string>();
    for (const id of snapshotIdsToScan) {
      if (state.tombstones[id]?.deleted) continue;
      try {
        const snapshot = await this.repo.readSnapshot(id);
        const hash = await snapshotHash(snapshot);
        const old = state.snapshotHashes[id];
        if (!old) {
          if (publishedSnapshotIds.has(id)) state.snapshotHashes[id] = hash;
          state.assetRows[id] ??= await assetKeys(snapshot);
          state.transactionRows[id] ??= await transactionRows(snapshot);
          continue;
        }
        if (old === hash) {
          state.assetRows[id] ??= await assetKeys(snapshot);
          state.transactionRows[id] ??= await transactionRows(snapshot);
        }
        if (old !== hash) {
          locallyChanged.add(id);
          const clock = this.tick(state, state.snapshotEdits[id]);
          const currentKeys = await assetKeys(snapshot);
          const events = state.rowEvents[id] ??= {};
          for (const rowKey of state.assetRows[id] ?? []) {
            if (!currentKeys.includes(rowKey)) events[rowKey] = { deleted: true, clock };
          }
          for (const rowKey of currentKeys) {
            if (events[rowKey]?.deleted) events[rowKey] = { deleted: false, clock };
          }
          const currentTransactions = await transactionRows(snapshot);
          const transactionEvents = state.transactionEvents[id] ??= {};
          for (const [rowKey, current] of Object.entries(currentTransactions)) {
            const previous = state.transactionRows[id]?.[rowKey];
            if (!previous) continue;
            const fields = transactionEvents[rowKey] ??= {};
            if (current.price !== previous.price) fields.price = { value: current.price, clock };
            if (current.txnType !== previous.txnType) fields.txnType = { value: current.txnType, clock };
          }
          state.assetRows[id] = currentKeys;
          state.transactionRows[id] = currentTransactions;
          state.snapshotHashes[id] = hash;
          state.snapshotEdits[id] = clock;
          state.pendingSnapshotEdits[id] = clock;
        }
      } catch {
        snapshotScanFailed = true;
        failedSnapshotIds.add(id);
        report.errors.push("Failed to read local snapshot");
      }
    }
    if (changes && !snapshotScanFailed && !options.dryRun) state.snapshotRevision = changes.revision;
    for (const [id, value] of remoteTombstones) {
      const old = state.tombstones[id];
      if (old && compareClock(value.clock, old.clock) <= 0) continue;
      if (value.deleted && localIdsBeforePull.has(id) &&
          (failedSnapshotIds.has(id) || locallyChanged.has(id) ||
            state.snapshotEdits[id] && compareClock(value.clock, state.snapshotEdits[id]) < 0)) {
        if (failedSnapshotIds.has(id)) {
          for (const { owner, entry } of entries) {
            if (entry.kind === "tombstone" && entry.id === id) known.delete(entryToken(owner, entry));
          }
          continue;
        }
        report.conflicts.push(`snapshot:${id}`);
        if (!options.dryRun) {
          const clock = this.tick(state, value.clock);
          const undo = { deleted: false, clock };
          state.tombstones[id] = undo;
          state.pendingTombstones[id] = undo;
          state.snapshotEdits[id] = clock;
          state.pendingSnapshotEdits[id] = clock;
        }
        continue;
      }
      try {
        if (!options.dryRun) {
          if (value.deleted) await this.repo.deleteSnapshot(id);
          else {
            const source = entries.find(({ entry }) => entry.kind === "snapshot" && entry.id === id);
            if (source) {
              const base = await read<Snapshot>(source.owner, source.entry);
              if (await this.repo.importSnapshot(base)) {
                report.pulled++;
                (report.pulledFrom ??= []).push(source.owner);
              }
              let latest: SnapshotEdit | undefined;
              for (const editSource of entries.filter(({ entry }) => entry.kind === "edit" && entry.id === id)) {
                const edit = await read<SnapshotEdit>(editSource.owner, editSource.entry);
                if (!validClock(edit.clock, editSource.owner) || edit.snapshot?.uuid !== id) throw new Error();
                if (!latest || compareClock(edit.clock, latest.clock) > 0) latest = edit;
              }
              if (latest) {
                await this.repo.replaceSnapshot(latest.snapshot);
                state.snapshotEdits[id] = latest.clock;
              }
              state.snapshotHashes[id] = await snapshotHash(latest?.snapshot ?? base);
              state.assetRows[id] = await assetKeys(latest?.snapshot ?? base);
              state.transactionRows[id] = await transactionRows(latest?.snapshot ?? base);
            }
          }
          state.tombstones[id] = value;
          if (state.pendingTombstones[id] && compareClock(state.pendingTombstones[id].clock, value.clock) <= 0) {
            delete state.pendingTombstones[id];
          }
        }
        if (value.deleted) report.tombstonesApplied++;
        this.tick(state, value.clock);
      } catch {
        for (const { owner, entry } of entries) {
          if (entry.kind === "tombstone" && entry.id === id) known.delete(entryToken(owner, entry));
        }
        report.errors.push("Failed to apply tombstone object");
      }
    }
    for (const [id, events] of remoteRowEvents) {
      const local = state.rowEvents[id] ??= {};
      for (const [rowKey, event] of Object.entries(events)) {
        if (!local[rowKey] || compareClock(event.clock, local[rowKey].clock) > 0) local[rowKey] = event;
      }
    }
    for (const [id, events] of remoteTransactionEvents) {
      const local = state.transactionEvents[id] ??= {};
      for (const [rowKey, fields] of Object.entries(events)) {
        const target = local[rowKey] ??= {};
        for (const name of ["price", "txnType"] as const) {
          const field = fields[name];
          const previous = target[name];
          if (field && (!previous || compareClock(field.clock, previous.clock) > 0)) {
            target[name] = field as never;
          }
        }
      }
    }
    for (const [id, value] of remoteEdits) {
      if (state.tombstones[id]?.deleted) continue;
      if (!state.snapshotHashes[id]) {
        for (const { owner, entry } of entries) {
          if (entry.kind === "edit" && entry.id === id) known.delete(entryToken(owner, entry));
        }
        continue;
      }
      const old = state.snapshotEdits[id];
      if (old && compareClock(value.clock, old) <= 0) {
        if (compareClock(value.clock, old) < 0) report.conflicts.push(`edit:${id}`);
        continue;
      }
      try {
        if (!options.dryRun) {
          const merged = await applyEditEvents(value.snapshot, state.rowEvents[id] ?? {}, state.transactionEvents[id] ?? {});
          await this.repo.replaceSnapshot(merged);
          state.snapshotHashes[id] = await snapshotHash(merged);
          state.assetRows[id] = await assetKeys(merged);
          state.transactionRows[id] = await transactionRows(merged);
          state.snapshotEdits[id] = value.clock;
          if (!state.pendingSnapshotEdits[id] || compareClock(state.pendingSnapshotEdits[id], value.clock) < 0 &&
              !Object.values(state.rowEvents[id] ?? {}).some((event) => event.clock.deviceId === state.deviceId) &&
              !Object.values(state.transactionEvents[id] ?? {}).some((fields) =>
                Object.values(fields).some((event) => event.clock.deviceId === state.deviceId))) {
            delete state.pendingSnapshotEdits[id];
          }
        }
        this.tick(state, value.clock);
        report.pulled++;
      } catch {
        for (const { owner, entry } of entries) {
          if (entry.kind === "edit" && entry.id === id) known.delete(entryToken(owner, entry));
        }
        report.errors.push("Failed to apply snapshot edit");
      }
    }
    for (const id of new Set([...remoteRowEvents.keys(), ...remoteTransactionEvents.keys()])) {
      if (state.tombstones[id]?.deleted || !state.snapshotHashes[id]) continue;
      try {
        const local = await this.repo.readSnapshot(id);
        const filtered = await applyEditEvents(local, state.rowEvents[id] ?? {}, state.transactionEvents[id] ?? {});
        if (snapshotContent(local) !== snapshotContent(filtered) && !options.dryRun) {
          await this.repo.replaceSnapshot(filtered);
          state.snapshotHashes[id] = await snapshotHash(filtered);
          state.assetRows[id] = await assetKeys(filtered);
          state.transactionRows[id] = await transactionRows(filtered);
          report.pulled++;
        }
      } catch {
        report.errors.push("Failed to apply asset deletion");
      }
    }
    const configApplies: Array<[string, { value: ConfigVersion; owner: string; entry: Entry }]> = [];
    for (const [id, source] of remoteConfig) {
      if (blockedConfig.has(id)) continue;
      if (state.configConflicts[id] && state.configResolutions[id]?.choice !== "remote") {
        if (!report.conflicts.includes(id)) report.conflicts.push(id);
        continue;
      }
      const { value } = source;
      const old = state.config[id];
      if (old && compareClock(value.clock, old.clock) <= 0) {
        if (compareClock(value.clock, old.clock) < 0 && !resolvedLocalConfig.has(id)) report.conflicts.push(id);
        continue;
      }
      if (options.dryRun) {
        report.configChanges++;
        continue;
      }
      configApplies.push([id, source]);
      state.applyingConfig[id] = { owner: source.owner, entry: source.entry };
    }
    if (configApplies.length) {
      let markersSaved = false;
      try {
        await this.saveState(state);
        markersSaved = true;
      } catch {
        for (const [id, source] of configApplies) {
          blockedConfig.add(id);
          delete state.applyingConfig[id];
          known.delete(entryToken(source.owner, source.entry));
        }
        report.errors.push("Failed to apply config object");
      }
      if (markersSaved) {
        for (const [id, source] of configApplies) {
          const { value } = source;
          try {
            await this.repo.writeConfig(id, value.value);
            const hash = await configHash(value.value);
            state.config[id] = { clock: value.clock, hash };
            delete state.pendingConfig[id];
            delete state.configConflicts[id];
            delete state.configResolutions[id];
            this.tick(state, value.clock);
            delete state.applyingConfig[id];
            report.configChanges++;
          } catch {
            blockedConfig.add(id);
            report.errors.push("Failed to apply config object");
          }
        }
        try {
          await this.saveState(state);
        } catch {
          report.errors.push("Failed to apply config object");
        }
      }
    }
    const localSessions = new Map(enabled("chat")
      ? (await this.repo.listSessions()).map((session) => [session.id, session]) : []);
    const blockedSessions = new Set<string>();
    if (enabled("chat")) {
      for (const _id of this.repo.takeReadErrors?.().sessionIds ?? []) {
        report.errors.push("Failed to read local session");
      }
    }
    if (enabled("chat")) {
      const sessionIds = new Set(await this.repo.listSessionIds());
      for (const id of state.trackedSessions) {
        if (!sessionIds.has(id) && !state.sessionDeletions[id]) {
          const clock = this.tick(state);
          state.sessionDeletions[id] = clock;
          state.pendingSessionDeletions[id] = clock;
        }
      }
      for (const [id, clock] of remoteSessionDeletions) {
        const old = state.sessionDeletions[id];
        if (old && compareClock(clock, old) <= 0) continue;
        const local = localSessions.get(id);
        const changed = local && (state.sessionHashes[id]
          ? await digest(encoder.encode(canonical(local))) !== state.sessionHashes[id]
          : !!remoteSessions.get(id) && canonical(local) !== canonical(remoteSessions.get(id)));
        if (local && (Date.parse(local.updatedAt) > clock.ms || changed)) {
          report.conflicts.push(`session:${id}`);
          try {
            if (!options.dryRun) {
              const retained = { ...local, updatedAt: new Date(Math.max(clock.ms, Date.parse(local.updatedAt)) + 1).toISOString() };
              await this.repo.writeSession(retained);
              localSessions.set(id, retained);
            }
          } catch {
            blockedSessions.add(id);
            for (const { owner, entry } of entries) {
              if (entry.kind === "session-delete" && entry.id === id) known.delete(entryToken(owner, entry));
            }
            report.errors.push("Failed to retain local session");
          }
          this.tick(state, clock);
          continue;
        }
        try {
          if (!options.dryRun) {
            await this.repo.deleteSession(id);
            localSessions.delete(id);
            state.sessionDeletions[id] = clock;
            delete state.pendingSessionDeletions[id];
          }
          this.tick(state, clock);
        } catch {
          for (const { owner, entry } of entries) {
            if (entry.kind === "session-delete" && entry.id === id) known.delete(entryToken(owner, entry));
          }
          report.errors.push("Failed to apply session deletion");
        }
      }
    }
    for (const [id, remote] of remoteSessions) {
      const deletion = state.sessionDeletions[id] ?? remoteSessionDeletions.get(id);
      if (deletion && Date.parse(remote.updatedAt) <= deletion.ms) continue;
      if (deletion && !options.dryRun) {
        delete state.sessionDeletions[id];
        delete state.pendingSessionDeletions[id];
      }
      try {
        const merged = mergeSessions(localSessions.get(id), remote);
        if (canonical(merged) !== canonical(localSessions.get(id))) {
          if (!options.dryRun) await this.repo.writeSession(merged);
          localSessions.set(id, merged);
          report.pulled++;
        }
      } catch {
        for (const { owner, entry } of entries) {
          if (entry.kind === "session" && entry.id === id) known.delete(entryToken(owner, entry));
        }
        report.errors.push("Failed to apply session object");
      }
    }
    if (!options.dryRun) {
      if (enabled("chat")) state.trackedSessions = [...new Set([...state.trackedSessions, ...localSessions.keys()])];
      state.known = [...known];
      await this.saveState(state);
    }
    const writes: Array<{ kind: Kind; id: string; version: string; value: unknown }> = [];
    const remoteSnapshotIds = new Set(entries.filter(({ entry }) => entry.kind === "snapshot").map(({ entry }) => entry.id));
    for (const id of enabled("history") ? await this.repo.listSnapshotIds() : []) {
      if (state.tombstones[id]?.deleted || publishedSnapshotIds.has(id) || manifestReadFailed) continue;
      if (remoteSnapshotIds.has(id)) continue;
      writes.push({ kind: "snapshot", id, version: "1", value: await this.repo.readSnapshot(id) });
    }
    for (const [id, marker] of Object.entries(state.pendingConfig)) {
      const category = syncCategory(id);
      if (!category || !enabled(category) || blockedConfig.has(id)) continue;
      writes.push({ kind: "config", id, version: `${marker.clock.ms}-${marker.clock.counter}`, value: {
        value: localConfig[id] ?? null, clock: marker.clock,
      } satisfies ConfigVersion });
    }
    for (const [id, value] of enabled("history") ? Object.entries(state.pendingTombstones) : []) {
      writes.push({ kind: "tombstone", id, version: `${value.clock.ms}-${value.clock.counter}`, value });
    }
    for (const [id, clock] of enabled("history") ? Object.entries(state.pendingSnapshotEdits) : []) {
      if (state.tombstones[id]?.deleted) continue;
      writes.push({ kind: "edit", id, version: `${clock.ms}-${clock.counter}`, value: {
        clock, snapshot: await this.repo.readSnapshot(id),
        rowEvents: state.rowEvents[id] ?? {}, txnEvents: state.transactionEvents[id] ?? {},
      } satisfies SnapshotEdit });
    }
    if (enabled("chat")) for (const [id, clock] of Object.entries(state.pendingSessionDeletions)) {
      writes.push({ kind: "session-delete", id, version: `${clock.ms}-${clock.counter}`, value: { clock } });
    }
    if (enabled("chat")) for (const session of localSessions.values()) {
      if (state.sessionDeletions[session.id] || blockedSessions.has(session.id)) continue;
      const hash = await digest(encoder.encode(canonical(session)));
      if (hash !== state.sessionHashes[session.id]) {
        writes.push({ kind: "session", id: session.id, version: hash, value: session });
      }
    }
    if (options.dryRun) {
      report.pushed = writes.length;
      return report;
    }
    if (writes.length) {
      const probe = `devices/${state.deviceId}/probe/${crypto.randomUUID()}`;
      const content = encoder.encode("conditional-write-probe");
      try {
        await this.store.putObject(probe, content, { ifNoneMatch: "*" }, options.signal);
        for (const conditions of [{ ifNoneMatch: "*" as const }, { ifMatch: '"stale-etag"' }]) {
          let rejected = false;
          try {
            await this.store.putObject(probe, content, conditions, options.signal);
          } catch (error) {
            if (!isS3Conflict(error)) throw error;
            rejected = true;
          }
          if (!rejected) throw new Error("Sync store does not enforce conditional writes");
        }
      } finally {
        await this.store.deleteObject(probe, options.signal);
      }
    }
    const ownEntries = [...(own?.manifest.entries ?? [])];
    const published: Entry[] = [];
    let written = 0;
    for (const write of writes) {
      aborted();
      const entry: Entry = { kind: write.kind, id: write.id, version: write.version, bytes: 0, sha256: "" };
      const path = await pathFor(state.deviceId!, entry);
      let storedValue: unknown = write.value;
      try {
        let plaintext = encoder.encode(JSON.stringify(write.value));
        let reused = false;
        if (write.kind === "snapshot" && plaintext.length > MAX_OBJECT_BYTES / 2) {
          const existingRoot = await this.store.getObject(path, options.signal);
          if (existingRoot) {
            entry.bytes = existingRoot.body.length;
            entry.sha256 = await digest(existingRoot.body);
            if (snapshotContent(await read<Snapshot>(state.deviceId!, entry)) !== snapshotContent(write.value as Snapshot)) {
              throw new Error("Immutable sync object changed");
            }
            reused = true;
          }
        }
        if (!reused && plaintext.length > MAX_OBJECT_BYTES / 2) {
          if (plaintext.length > MAX_PAYLOAD_BYTES) throw new Error("Payload too large");
          const parts: ObjectParts["parts"] = [];
          for (let offset = 0, index = 0; offset < plaintext.length; offset += PART_BYTES, index++) {
            const chunk = plaintext.slice(offset, offset + PART_BYTES);
            const chunkPath = `${path}/part/${index}`;
            let chunkBody = encoder.encode(JSON.stringify(await encryptObject(key, chunkPath, chunk)));
            if (chunkBody.length > MAX_OBJECT_BYTES) throw new Error("Sync part too large");
            try {
              await this.store.putObject(chunkPath, chunkBody, { ifNoneMatch: "*" }, options.signal);
            } catch (error) {
              if (!isS3Conflict(error)) throw error;
              const existing = await this.store.getObject(chunkPath, options.signal);
              if (!existing || existing.body.length > MAX_OBJECT_BYTES) {
                throw new Error("Immutable sync part changed");
              }
              let same = false;
              try {
                const previous = await decryptObject(key, chunkPath, JSON.parse(decoder.decode(existing.body)));
                same = previous.length === chunk.length && !previous.some((byte, index) => byte !== chunk[index]);
              } catch {
                // An unpublished part can be replaced below.
              }
              if (same) chunkBody = existing.body;
              else {
                if (await this.store.headObject(path, options.signal)) throw new Error("Immutable sync part changed");
                await this.store.deleteObject(chunkPath, options.signal);
                await this.store.putObject(chunkPath, chunkBody, { ifNoneMatch: "*" }, options.signal);
              }
            }
            parts.push({ bytes: chunkBody.length, sha256: await digest(chunkBody) });
          }
          storedValue = { multipart: 1, total: plaintext.length, parts } satisfies ObjectParts;
          plaintext = encoder.encode(JSON.stringify(storedValue));
        }
        if (!reused) {
          if (plaintext.length > MAX_OBJECT_BYTES / 2) throw new Error("Object too large");
          const body = encoder.encode(JSON.stringify(await encryptObject(key, path, plaintext)));
          if (body.length > MAX_OBJECT_BYTES) throw new Error("Object too large");
          entry.bytes = body.length;
          entry.sha256 = await digest(body);
          await this.store.putObject(path, body, { ifNoneMatch: "*" }, options.signal);
        }
      } catch (error) {
        if (!isS3Conflict(error)) {
          report.errors.push(error instanceof Error && error.message === "Immutable sync object changed"
            ? error.message : `Failed to push ${write.kind} object`);
          continue;
        }
        const existing = await this.store.getObject(path, options.signal);
        if (!existing || existing.body.length > MAX_OBJECT_BYTES) { report.errors.push(`Failed to verify ${write.kind} object`); continue; }
        try {
          const value = JSON.parse(decoder.decode(await decryptObject(key, path, JSON.parse(decoder.decode(existing.body)))));
          const same = write.kind === "snapshot" && !(storedValue && typeof storedValue === "object" && "multipart" in storedValue)
            ? snapshotContent(value as Snapshot) === snapshotContent(write.value as Snapshot)
            : canonical(value) === canonical(storedValue);
          if (!same) {
            report.errors.push("Immutable sync object changed");
            continue;
          }
        } catch {
          report.errors.push(`Failed to verify ${write.kind} object`);
          continue;
        }
        entry.bytes = existing.body.length;
        entry.sha256 = await digest(existing.body);
      }
      ownEntries.push(entry);
      published.push(entry);
      written++;
      options.onProgress?.({ phase: "push", completed: written, total: writes.length });
    }
    const deviceName = options.deviceName?.trim().slice(0, 60) || own?.manifest.name;
    if (written || own?.manifest.name !== deviceName && deviceName !== undefined) {
      const replacedSessions = new Set(published
        .filter((entry) => entry.kind === "session" || entry.kind === "session-delete")
        .map((entry) => entry.id));
      const replacedEdits = new Set(published.filter((entry) => entry.kind === "edit").map((entry) => entry.id));
      const obsolete = ownEntries.filter((entry) =>
        !published.includes(entry) && (entry.kind === "session" && replacedSessions.has(entry.id) ||
          entry.kind === "edit" && replacedEdits.has(entry.id)));
      const latest = new Map<string, Entry>();
      for (const entry of ownEntries) {
        if (entry.kind === "config" || entry.kind === "tombstone") latest.set(`${entry.kind}:${entry.id}`, entry);
      }
      for (const entry of ownEntries) {
        if ((entry.kind === "config" || entry.kind === "tombstone") &&
            latest.get(`${entry.kind}:${entry.id}`) !== entry) obsolete.push(entry);
      }
      const manifestEntries = ownEntries.filter((entry) => !obsolete.includes(entry));
      const path = `devices/${state.deviceId}/manifest`;
      const body = encoder.encode(JSON.stringify(await encryptObject(key, path, encoder.encode(JSON.stringify({
        version: 1, deviceId: state.deviceId!, name: deviceName, entries: manifestEntries,
      } satisfies Manifest)))));
      if (manifestEntries.length > 100_000 || body.length > MAX_MANIFEST_BYTES) report.errors.push("Sync manifest is too large");
      else {
        try {
          await this.store.putObject(path, body, own ? { ifMatch: own.etag } : { ifNoneMatch: "*" }, options.signal);
          const currentDevice = report.devices.find((device) => device.id === state.deviceId);
          if (currentDevice) {
            currentDevice.lastUpload = new Date(this.now()).toISOString();
            currentDevice.name = deviceName;
          } else report.devices.push({ id: state.deviceId!, name: deviceName, lastUpload: new Date(this.now()).toISOString() });
          report.pushed = written;
          for (const entry of published) {
            known.add(entryToken(state.deviceId!, entry));
            if (entry.kind === "snapshot") {
              state.published.push(entry.id);
              publishedSnapshotIds.add(entry.id);
            }
            if (entry.kind === "snapshot") {
              const snapshot = (writes.find((write) =>
                write.kind === "snapshot" && write.id === entry.id)!.value) as Snapshot;
              state.snapshotHashes[entry.id] = await snapshotHash(snapshot);
              state.assetRows[entry.id] = await assetKeys(snapshot);
              state.transactionRows[entry.id] = await transactionRows(snapshot);
            }
            const pendingTombstone = state.pendingTombstones[entry.id];
            if (entry.kind === "tombstone" && pendingTombstone &&
                entry.version === `${pendingTombstone.clock.ms}-${pendingTombstone.clock.counter}`) {
              delete state.pendingTombstones[entry.id];
            }
            if (entry.kind === "edit") delete state.pendingSnapshotEdits[entry.id];
            if (entry.kind === "config") delete state.pendingConfig[entry.id];
            if (entry.kind === "session") state.sessionHashes[entry.id] = entry.version;
            if (entry.kind === "session-delete") delete state.pendingSessionDeletions[entry.id];
          }
          state.known = [...known];
          await this.saveState(state);
          for (const entry of obsolete) {
            if (entry.kind === "config" || entry.kind === "tombstone") continue;
            try {
              const oldPath = await pathFor(state.deviceId!, entry);
              if (entry.kind === "session" || entry.kind === "edit") {
                const root = await readRoot(state.deviceId!, entry);
                if (root && typeof root === "object" && "multipart" in root) {
                  if (!validObjectParts(root as ObjectParts)) throw new Error("Invalid sync object parts");
                  for (const [index] of (root as ObjectParts).parts.entries()) {
                    await this.store.deleteObject(`${oldPath}/part/${index}`, options.signal);
                  }
                }
              }
              await this.store.deleteObject(oldPath, options.signal);
            } catch {
              report.errors.push("Failed to prune old sync object");
            }
          }
        } catch {
          report.errors.push("Failed to write sync manifest");
        }
      }
    }
    aborted();
    if (!report.errors.length) {
      for (const id of Object.keys(state.sessionDeletions)) {
        if (!state.pendingSessionDeletions[id]) delete state.sessionHashes[id];
      }
      state.trackedSessions = state.trackedSessions.filter((id) =>
        !state.sessionDeletions?.[id] || !!state.pendingSessionDeletions?.[id]);
      for (const [id, tombstone] of Object.entries(state.tombstones)) {
        if (!tombstone.deleted || state.pendingSnapshotEdits[id]) continue;
        delete state.assetRows[id];
        delete state.transactionRows[id];
      }
      state.lastSync = this.now();
      await this.saveState(state);
    }
    if (report.pulled || report.tombstonesApplied || report.configChanges) this.repo.dataChanged();
    return report;
  }
}
