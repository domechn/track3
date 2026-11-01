import { invoke } from "@tauri-apps/api/core";
import { executeWrite, getDatabase } from "../database";
import { deleteSession, listSessions, loadSession, saveSyncedSession, stableSyncMessage, type ChatSession } from "../ai/sessions";
import { APP_SOFT_REFRESH_EVENT } from "@/utils/events";
import { invalidateCacheGroups } from "../datafetch/utils/cache";
import { cachePreferCurrency, markPortfolioInputChanged } from "../configuration";
import { runWithEncryptionWriteGate } from "../encryption-write-gate";
import { readSnapshot } from "../snapshot";
import { configurationKey, syncCategory } from "./config-keys";
import type { Snapshot, SyncRepository, SyncSession, SyncState, SyncMessage } from "./engine";

type SnapshotStateRow = {
  snapshotId: string;
  snapshotHash: string | null;
  snapshotEdit: string | null;
  pendingSnapshotEdit: string | null;
  published: number;
  known: string;
  assetRows: string | null;
  transactionRows: string | null;
  rowEvents: string | null;
  transactionEvents: string | null;
};

type DetailPresence = {
  assetRows: boolean;
  transactionRows: boolean;
  rowEvents: boolean;
  transactionEvents: boolean;
};

type StateBaseline = {
  rows: Map<string, SnapshotStateRow>;
  details: Set<string>;
  present: Map<string, DetailPresence>;
  globalData: string;
};

const snapshotFields = [
  "snapshotHashes", "snapshotEdits", "pendingSnapshotEdits", "assetRows",
  "transactionRows", "rowEvents", "transactionEvents",
] as const;

function snapshotTokenId(token: string): string | undefined {
  return /^[^:]{36}:snapshot:(.+):[^:]+$/.exec(token)?.[1];
}

function snapshotKnown(tokens: string[]): { global: string[]; byId: Map<string, string[]> } {
  const global: string[] = [];
  const byId = new Map<string, string[]>();
  for (const token of tokens) {
    const id = snapshotTokenId(token);
    if (id) byId.set(id, [...byId.get(id) ?? [], token]);
    else global.push(token);
  }
  return { global, byId };
}

function globalStateData(state: SyncState, known: string[]): string {
  const global = { ...state, known } as Record<string, unknown>;
  for (const field of snapshotFields) delete global[field];
  delete global.published;
  return JSON.stringify(global);
}

function storedJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

export class SqliteSyncRepository implements SyncRepository {
  private configReadErrors: string[] = [];
  private sessionReadErrors: string[] = [];
  private sessions = new Map<string, { metadata: string; session: SyncSession }>();
  private baselines = new WeakMap<SyncState, StateBaseline>();

  takeReadErrors() {
    const errors = { configIds: this.configReadErrors, sessionIds: this.sessionReadErrors };
    this.configReadErrors = [];
    this.sessionReadErrors = [];
    return errors;
  }

  async loadState(): Promise<SyncState> {
    const db = await getDatabase();
    const rows = await db.select<Array<{ data: string }>>("SELECT data FROM sync_state WHERE id = 1");
    const state = rows[0] ? JSON.parse(rows[0].data) as SyncState : {};
    const snapshotRows = await db.select<Array<SnapshotStateRow & {
      assetRowsPresent: number; transactionRowsPresent: number;
      rowEventsPresent: number; transactionEventsPresent: number;
    }>>(
      "SELECT snapshot_id AS snapshotId, snapshot_hash AS snapshotHash, snapshot_edit AS snapshotEdit, " +
      "pending_snapshot_edit AS pendingSnapshotEdit, published, known, " +
      "NULL AS assetRows, NULL AS transactionRows, NULL AS rowEvents, NULL AS transactionEvents, " +
      "asset_rows IS NOT NULL AS assetRowsPresent, transaction_rows IS NOT NULL AS transactionRowsPresent, " +
      "row_events IS NOT NULL AS rowEventsPresent, transaction_events IS NOT NULL AS transactionEventsPresent " +
      "FROM sync_snapshot_state",
    );
    state.snapshotHashes = {};
    state.snapshotEdits = {};
    state.pendingSnapshotEdits = {};
    state.assetRows = {};
    state.transactionRows = {};
    state.rowEvents = {};
    state.transactionEvents = {};
    state.published = [];
    state.known ??= [];
    for (const row of snapshotRows) {
      if (row.snapshotHash !== null) state.snapshotHashes[row.snapshotId] = row.snapshotHash;
      if (row.snapshotEdit !== null) state.snapshotEdits[row.snapshotId] = JSON.parse(row.snapshotEdit);
      if (row.pendingSnapshotEdit !== null) state.pendingSnapshotEdits[row.snapshotId] = JSON.parse(row.pendingSnapshotEdit);
      if (row.published) state.published.push(row.snapshotId);
      state.known.push(...JSON.parse(row.known) as string[]);
    }
    const baselineRows = new Map<string, SnapshotStateRow>();
    const present = new Map<string, DetailPresence>();
    for (const row of snapshotRows) {
      const { assetRowsPresent, transactionRowsPresent, rowEventsPresent, transactionEventsPresent, ...summary } = row;
      baselineRows.set(row.snapshotId, summary);
      present.set(row.snapshotId, {
        assetRows: !!assetRowsPresent, transactionRows: !!transactionRowsPresent,
        rowEvents: !!rowEventsPresent, transactionEvents: !!transactionEventsPresent,
      });
    }
    this.baselines.set(state, { rows: baselineRows, details: new Set(), present, globalData: rows[0]?.data ?? "" });
    return state;
  }

  async loadDeletedSnapshotRows(state: SyncState, ids: Iterable<string>): Promise<void> {
    const present = this.baselines.get(state)?.present;
    if (!present) return;
    await this.loadSnapshotDetails(state, [...ids].filter((id) =>
      present.get(id)?.assetRows || present.get(id)?.transactionRows));
  }

  async loadSnapshotDetails(state: SyncState, ids: Iterable<string>): Promise<void> {
    const baseline = this.baselines.get(state);
    if (!baseline) return;
    const missing = [...new Set(ids)].filter((id) => baseline.rows.has(id) && !baseline.details.has(id));
    if (!missing.length) return;
    const db = await getDatabase();
    for (let offset = 0; offset < missing.length; offset += 500) {
      const batch = missing.slice(offset, offset + 500);
      const rows = await db.select<Array<Pick<SnapshotStateRow,
        "snapshotId" | "assetRows" | "transactionRows" | "rowEvents" | "transactionEvents">>>(
        "SELECT snapshot_id AS snapshotId, asset_rows AS assetRows, transaction_rows AS transactionRows, " +
        "row_events AS rowEvents, transaction_events AS transactionEvents " +
        `FROM sync_snapshot_state WHERE snapshot_id IN (${batch.map(() => "?").join(",")})`, batch,
      );
      for (const row of rows) {
        const original = baseline.rows.get(row.snapshotId);
        if (!original) continue;
        for (const [column, field] of [
          ["assetRows", "assetRows"], ["transactionRows", "transactionRows"],
          ["rowEvents", "rowEvents"], ["transactionEvents", "transactionEvents"],
        ] as const) {
          original[column] = row[column];
          if (row[column] !== null && !Object.hasOwn(state[field] ?? {}, row.snapshotId)) {
            (state[field] ??= {})[row.snapshotId] = JSON.parse(row[column]!);
          }
        }
        baseline.details.add(row.snapshotId);
      }
    }
  }

  async saveState(state: SyncState): Promise<number> {
    const baseline = this.baselines.get(state);
    const { global, byId } = snapshotKnown(state.known ?? []);
    const data = globalStateData(state, global);
    const published = new Set(state.published ?? []);
    const ids = new Set<string>([...baseline?.rows.keys() ?? [], ...published, ...byId.keys()]);
    for (const field of snapshotFields) {
      for (const id of Object.keys(state[field] ?? {})) ids.add(id);
    }
    const changed = new Set<string>();
    const deletedIds: string[] = [];
    for (const id of ids) {
      const previous = baseline?.rows.get(id);
      const exists = published.has(id) || byId.has(id) ||
        snapshotFields.some((field) => Object.hasOwn(state[field] ?? {}, id)) ||
        (!!previous && !baseline?.details.has(id) &&
          Object.values(baseline?.present.get(id) ?? {}).some(Boolean));
      if (!exists) {
        if (previous && baseline) deletedIds.push(id);
        continue;
      }
      if (!previous || previous.snapshotHash !== (state.snapshotHashes?.[id] ?? null) ||
          previous.snapshotEdit !== storedJson(state.snapshotEdits?.[id]) ||
          previous.pendingSnapshotEdit !== storedJson(state.pendingSnapshotEdits?.[id]) ||
          previous.published !== Number(published.has(id)) ||
          previous.known !== JSON.stringify(byId.get(id) ?? []) ||
          baseline?.details.has(id)) changed.add(id);
    }
    if (baseline) await this.loadSnapshotDetails(state, changed);
    const rows: SnapshotStateRow[] = [];
    for (const id of changed) {
      const previous = baseline?.rows.get(id);
      const fieldJson = (field: "assetRows" | "transactionRows" | "rowEvents" | "transactionEvents") =>
        baseline?.details.has(id) || !previous ? storedJson(state[field]?.[id]) : previous[field];
      const row: SnapshotStateRow = {
        snapshotId: id,
        snapshotHash: state.snapshotHashes?.[id] ?? null,
        snapshotEdit: storedJson(state.snapshotEdits?.[id]),
        pendingSnapshotEdit: storedJson(state.pendingSnapshotEdits?.[id]),
        published: Number(published.has(id)),
        known: JSON.stringify(byId.get(id) ?? []),
        assetRows: fieldJson("assetRows"),
        transactionRows: fieldJson("transactionRows"),
        rowEvents: fieldJson("rowEvents"),
        transactionEvents: fieldJson("transactionEvents"),
      };
      if (!previous || JSON.stringify(previous) !== JSON.stringify(row)) rows.push(row);
    }
    if (!rows.length && !deletedIds.length && data === baseline?.globalData) return 0;
    await invoke("save_sync_state", { data, rows, deletedIds, clearSnapshots: !baseline });
    const updated = baseline ?? {
      rows: new Map<string, SnapshotStateRow>(), details: new Set<string>(),
      present: new Map<string, DetailPresence>(), globalData: "",
    };
    for (const id of deletedIds) {
      updated.rows.delete(id); updated.details.delete(id); updated.present.delete(id);
    }
    for (const row of rows) {
      updated.rows.set(row.snapshotId, row);
      updated.present.set(row.snapshotId, {
        assetRows: row.assetRows !== null, transactionRows: row.transactionRows !== null,
        rowEvents: row.rowEvents !== null, transactionEvents: row.transactionEvents !== null,
      });
    }
    updated.globalData = data;
    this.baselines.set(state, updated);
    return new TextEncoder().encode(data).length +
      rows.reduce((total, row) => total + new TextEncoder().encode(JSON.stringify(row)).length, 0);
  }

  async loadManifestCache(owner: string, salt: string): Promise<{ etag: string; manifest: unknown; lastModified?: string } | null> {
    const db = await getDatabase();
    const rows = await db.select<Array<{ etag: string; body: string; last_modified: string | null }>>(
      "SELECT etag, body, last_modified FROM sync_manifest_cache WHERE owner = ? AND header_salt = ? ORDER BY rowid DESC LIMIT 1",
      [owner, salt],
    );
    if (!rows[0]) return null;
    try {
      return { etag: rows[0].etag, manifest: JSON.parse(rows[0].body), lastModified: rows[0].last_modified ?? undefined };
    } catch {
      await this.clearManifestCache(owner);
      return null;
    }
  }

  async saveManifestCache(owner: string, salt: string, etag: string, manifest: unknown, lastModified?: string): Promise<void> {
    await executeWrite("DELETE FROM sync_manifest_cache WHERE owner = ? AND etag <> ?", [owner, etag]);
    await executeWrite(
      "INSERT INTO sync_manifest_cache (owner, header_salt, etag, body, last_modified) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(owner, etag) DO UPDATE SET header_salt = excluded.header_salt, body = excluded.body, last_modified = excluded.last_modified",
      [owner, salt, etag, JSON.stringify(manifest), lastModified ?? null],
    );
  }

  async clearManifestCache(owner?: string): Promise<void> {
    await executeWrite(owner === undefined ? "DELETE FROM sync_manifest_cache" : "DELETE FROM sync_manifest_cache WHERE owner = ?",
      owner === undefined ? [] : [owner]);
  }

  async listSnapshotIds(): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.select<Array<{ uuid: string }>>(
      "SELECT uuid FROM assets_v2 UNION SELECT uuid FROM transactions",
    );
    return rows.map((row) => row.uuid);
  }

  async listChangedSnapshotIds(since?: number): Promise<{ ids: string[]; revision: number }> {
    const db = await getDatabase();
    const revisionRows = await db.select<Array<{ revision: number }>>(
      "SELECT revision FROM sync_snapshot_revision_counter WHERE id = 1",
    );
    const revision = revisionRows[0]?.revision ?? 0;
    if (since === undefined) return { ids: await this.listSnapshotIds(), revision };
    const rows = await db.select<Array<{ uuid: string }>>(
      "SELECT uuid FROM sync_snapshot_revisions WHERE revision > ? AND revision <= ?",
      [since, revision],
    );
    return { ids: rows.map((row) => row.uuid), revision };
  }

  async readSnapshot(uuid: string): Promise<Snapshot> {
    return readSnapshot(uuid);
  }

  async importSnapshot(snapshot: Snapshot): Promise<boolean> {
    return invoke<boolean>("import_sync_snapshot", { snapshot });
  }

  async replaceSnapshot(snapshot: Snapshot): Promise<void> {
    await invoke("replace_sync_snapshot", { snapshot });
  }

  async deleteSnapshot(uuid: string): Promise<void> {
    await invoke("delete_sync_snapshot", { uuid });
  }

  async listConfig(): Promise<Record<string, string>> {
    this.configReadErrors = [];
    const db = await getDatabase();
    const rows = await db.select<Array<{ id: number; data: string }>>("SELECT id, data FROM configuration");
    const config: Record<string, string> = {};
    for (const row of rows) {
      const id = String(row.id);
      if (!syncCategory(id)) continue;
      try {
        config[id] = configurationKey(id)?.encrypted && row.data.startsWith("!ent:")
          ? await invoke<string>("decrypt", { data: row.data }) : row.data;
      } catch {
        this.configReadErrors.push(id);
      }
    }
    const rebalance = await db.select<Array<{ targets: string; tolerance_percent: number }>>(
      "SELECT targets, tolerance_percent FROM rebalance_profiles WHERE id = 1",
    );
    if (rebalance[0]) config.rebalance = JSON.stringify(rebalance[0]);
    return config;
  }

  async writeConfig(id: string, value: string | null): Promise<void> {
    if (!syncCategory(id)) throw new Error("Configuration key is not syncable");
    await runWithEncryptionWriteGate(async () => {
      if (id !== "rebalance") markPortfolioInputChanged();
      try {
        if (id === "rebalance") {
          if (value === null) await executeWrite("DELETE FROM rebalance_profiles WHERE id = 1");
          else {
            const profile = JSON.parse(value) as { targets: string; tolerance_percent: number };
            await executeWrite(
              "INSERT INTO rebalance_profiles (id, targets, tolerance_percent) VALUES (1, ?, ?) " +
              "ON CONFLICT(id) DO UPDATE SET targets = excluded.targets, tolerance_percent = excluded.tolerance_percent",
              [profile.targets, profile.tolerance_percent],
            );
          }
        } else if (value === null) {
          await executeWrite("DELETE FROM configuration WHERE id = ?", [Number(id)]);
        } else {
          const data = configurationKey(id)?.encrypted ? await invoke<string>("encrypt", { data: value }) : value;
          await executeWrite(
            "INSERT INTO configuration (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
            [Number(id), data],
          );
        }
        if (id === "7") cachePreferCurrency(value);
      } finally {
        if (id !== "rebalance") markPortfolioInputChanged();
      }
    });
  }

  async listSessions(): Promise<SyncSession[]> {
    this.sessionReadErrors = [];
    const result: SyncSession[] = [];
    const metadata = await listSessions();
    const ids = new Set(metadata.map((meta) => meta.id));
    for (const id of this.sessions.keys()) if (!ids.has(id)) this.sessions.delete(id);
    for (const meta of metadata) {
      const marker = JSON.stringify(meta);
      const cached = this.sessions.get(meta.id);
      if (cached?.metadata === marker) {
        result.push(cached.session);
        continue;
      }
      try {
        const session = await loadSession(meta.id);
        if (!session) continue;
        const messages: SyncMessage[] = session.messages.map((message, index) =>
          stableSyncMessage(meta.id, meta.createdAt, index, message));
        const value = { ...session, messages };
        this.sessions.set(meta.id, { metadata: marker, session: value });
        result.push(value);
      } catch {
        this.sessions.delete(meta.id);
        this.sessionReadErrors.push(meta.id);
      }
    }
    return result;
  }

  async listSessionIds(): Promise<string[]> {
    return (await listSessions()).map((meta) => meta.id);
  }

  async writeSession(session: SyncSession): Promise<void> {
    await saveSyncedSession(session as ChatSession);
    this.sessions.delete(session.id);
  }

  async deleteSession(id: string): Promise<void> {
    await deleteSession(id);
    this.sessions.delete(id);
  }

  dataChanged(): void {
    invalidateCacheGroups({ memory: ["data-fetch"] });
    if (typeof window !== "undefined") window.dispatchEvent(new Event(APP_SOFT_REFRESH_EVENT));
  }
}
