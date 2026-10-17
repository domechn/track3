import { createSyncHeader, unlockSyncHeader } from "./crypto";
import { createSqliteSyncEngine } from "./index";
import { isS3Conflict, readSyncHeader, writeSyncHeader, type S3Store } from "./object-store";
import { SyncScheduler, type SyncStatus } from "./scheduler";
import {
  classifySyncError, createSyncStore, defaultSyncSettings, loadSyncSettings,
  saveSyncSettings, testSyncConnection, validateSyncSettings,
  type SyncConnectionResult, type SyncSettings,
} from "./settings";
import type { SyncOptions, SyncReport } from "./engine";
import { resetSyncState } from "./engine";
import { SqliteSyncRepository } from "./sqlite-repository";

type EngineHandle = {
  engine: {
    syncOnce(options?: SyncOptions): Promise<SyncReport>;
    configConflicts?(): Promise<Array<{ id: string }>>;
    resolveConfigConflict?(id: string, choice: "local" | "remote"): Promise<void>;
  };
  unregister(): void;
};

type Dependencies = {
  load(): Promise<SyncSettings>;
  save(settings: SyncSettings): Promise<void>;
  store(settings: SyncSettings): S3Store;
  engine(store: S3Store, passphrase: string): EngineHandle;
  resetState?(): Promise<void>;
  deviceId?(): Promise<string | undefined>;
};

const production: Dependencies = {
  load: loadSyncSettings,
  save: saveSyncSettings,
  store: createSyncStore,
  engine: createSqliteSyncEngine,
  resetState: async () => {
    const repo = new SqliteSyncRepository();
    await repo.saveState(resetSyncState(await repo.loadState()));
  },
  deviceId: async () => (await new SqliteSyncRepository().loadState()).deviceId,
};

export type RuntimeStatus = {
  mode: "loading" | "disabled" | "locked" | "ready" | "unreadable";
  sync: SyncStatus;
};

export class SyncRuntime {
  private settings: SyncSettings = defaultSyncSettings;
  private passphrase?: string;
  private scheduler?: SyncScheduler;
  private handle?: EngineHandle;
  private listeners = new Set<() => void>();
  private snapshot: RuntimeStatus = { mode: "loading", sync: { phase: "idle" } };

  constructor(private readonly deps: Dependencies = production) {}

  status = (): RuntimeStatus => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSettings(): SyncSettings { return this.settings; }

  private publish(mode: RuntimeStatus["mode"], sync: SyncStatus = this.snapshot.sync): void {
    this.snapshot = { mode, sync };
    for (const listener of this.listeners) listener();
  }

  async initialize(): Promise<void> {
    try {
      this.settings = await this.deps.load();
      this.publish(this.settings.enabled ? "locked" : "disabled");
    } catch {
      this.publish("unreadable");
    }
  }

  async test(settings: SyncSettings, passphrase: string): Promise<SyncConnectionResult> {
    if (validateSyncSettings(settings)) return "configuration";
    return testSyncConnection(this.deps.store(settings), passphrase || this.passphrase || "");
  }

  async hasHeader(settings: SyncSettings): Promise<boolean> {
    return !!await readSyncHeader(this.deps.store(settings));
  }

  async configure(settings: SyncSettings, passphrase: string): Promise<SyncConnectionResult> {
    if (validateSyncSettings(settings)) return "configuration";
    const secret = passphrase || this.passphrase;
    if (!secret || secret.length < 16) return "passphrase";
    const store = this.deps.store(settings);
    const result = await testSyncConnection(store, secret);
    if (result !== "ok") return result;
    try {
      if (!await readSyncHeader(store)) {
        const { header } = await createSyncHeader(secret);
        try {
          await writeSyncHeader(store, header);
        } catch (error) {
          if (!isS3Conflict(error)) throw error;
          const current = await readSyncHeader(store);
          if (!current) return "header";
          try { await unlockSyncHeader(current, secret); }
          catch { return "passphrase"; }
        }
      }
      const next = { ...settings, enabled: true };
      await this.deps.save(next);
      await this.scheduler?.stop();
      if ((["endpoint", "region", "bucket", "prefix", "pathStyle"] as const).some((key) =>
        this.settings[key] !== next[key])) {
        await this.deps.resetState?.();
      }
      this.settings = next;
      this.activate(store, secret);
      return "ok";
    } catch (error) {
      return classifySyncError(error);
    }
  }

  async unlock(passphrase: string): Promise<SyncConnectionResult> {
    if (!this.settings.enabled) return "configuration";
    try {
      const store = this.deps.store(this.settings);
      const header = await readSyncHeader(store);
      if (!header) return "header";
      try {
        await unlockSyncHeader(header, passphrase);
      } catch {
        return "passphrase";
      }
      this.activate(store, passphrase);
      return "ok";
    } catch (error) {
      return classifySyncError(error);
    }
  }

  private activate(store: S3Store, passphrase: string): void {
    void this.scheduler?.stop();
    this.handle?.unregister();
    this.passphrase = passphrase;
    this.handle = this.deps.engine(store, passphrase);
    this.scheduler = new SyncScheduler(async (signal) => {
      const currentId = await this.deps.deviceId?.();
      return this.handle!.engine.syncOnce({
        signal, categories: this.settings.categories, deviceName: this.settings.deviceNames[currentId ?? ""],
      });
    });
    this.scheduler.subscribe(() => this.publish("ready", this.scheduler!.status()));
    this.publish("ready", this.scheduler.status());
    this.scheduler.trigger("start");
  }

  trigger(kind: "refresh" | "focus"): void { this.scheduler?.trigger(kind); }

  async syncNow(): Promise<void> { await this.scheduler?.syncNow(); }

  async configConflicts(): Promise<Array<{ id: string }>> {
    return this.handle?.engine.configConflicts?.() ?? [];
  }

  async resolveConfigConflict(id: string, choice: "local" | "remote"): Promise<void> {
    if (!this.handle?.engine.resolveConfigConflict) throw new Error("Sync is locked");
    await this.handle.engine.resolveConfigConflict(id, choice);
    this.scheduler?.trigger("refresh");
    await this.syncNow();
  }

  async disable(): Promise<void> {
    const next = { ...this.settings, enabled: false };
    await this.deps.save(next);
    this.settings = next;
    await this.scheduler?.stop();
    this.scheduler = undefined;
    this.handle?.unregister();
    this.handle = undefined;
    this.passphrase = undefined;
    this.publish("disabled", { phase: "idle" });
  }

  async forgetRemote(): Promise<void> {
    await this.disable();
    const store = this.deps.store(this.settings);
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await store.listObjectsV2({ prefix: "devices/", continuationToken });
      keys.push(...page.objects.map((item) => item.key));
      continuationToken = page.nextContinuationToken;
    } while (continuationToken);
    for (const key of keys) await store.deleteObject(key);
    if (await store.headObject("sync-header")) await store.deleteObject("sync-header");
    await this.deps.resetState?.();
  }

  async devices(): Promise<Array<{ id: string; name: string; lastUpload?: string; current: boolean }>> {
    const currentId = await this.deps.deviceId?.();
    return (this.snapshot.sync.report?.devices ?? []).map(({ id, name, lastUpload }) => ({
      id, name: this.settings.deviceNames[id] ?? name ?? id.slice(0, 8),
      lastUpload, current: id === currentId,
    }));
  }

  async renameDevice(id: string, name: string): Promise<void> {
    const next = { ...this.settings, deviceNames: { ...this.settings.deviceNames, [id]: name.trim() || id.slice(0, 8) } };
    await this.deps.save(next);
    this.settings = next;
    this.publish(this.snapshot.mode);
    if (id === await this.deps.deviceId?.()) this.scheduler?.trigger("refresh");
  }

  stop(): void {
    this.scheduler?.stop();
    this.handle?.unregister();
    this.scheduler = undefined;
    this.handle = undefined;
    this.passphrase = undefined;
  }
}

export const syncRuntime = new SyncRuntime();
