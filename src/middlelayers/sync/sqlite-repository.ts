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

export class SqliteSyncRepository implements SyncRepository {
  private configReadErrors: string[] = [];
  private sessionReadErrors: string[] = [];
  private sessions = new Map<string, { metadata: string; session: SyncSession }>();

  takeReadErrors() {
    const errors = { configIds: this.configReadErrors, sessionIds: this.sessionReadErrors };
    this.configReadErrors = [];
    this.sessionReadErrors = [];
    return errors;
  }

  async loadState(): Promise<SyncState> {
    const db = await getDatabase();
    const rows = await db.select<Array<{ data: string }>>("SELECT data FROM sync_state WHERE id = 1");
    return rows[0] ? JSON.parse(rows[0].data) as SyncState : {};
  }

  async saveState(state: SyncState): Promise<void> {
    await executeWrite(
      "INSERT INTO sync_state (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
      [JSON.stringify(state)],
    );
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
