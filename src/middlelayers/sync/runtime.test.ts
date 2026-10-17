import { describe, expect, it, vi } from "vitest";
import { createSyncHeader } from "./crypto";
import { FakeS3, readSyncHeader, writeSyncHeader } from "./object-store";
import { SyncRuntime } from "./runtime";
import { defaultSyncSettings, type SyncSettings } from "./settings";

const configured: SyncSettings = {
  ...defaultSyncSettings, endpoint: "https://s3.example.test", region: "us-east-1",
  bucket: "track3", accessKeyId: "key", secretAccessKey: "secret",
};

describe("SyncRuntime", () => {
  it("shows a recovery state when saved sync settings cannot be read", async () => {
    const runtime = new SyncRuntime({
      load: async () => { throw new Error("decrypt failed"); },
      save: async () => {},
      store: () => new FakeS3(),
      engine: () => ({ engine: { syncOnce: vi.fn() }, unregister: () => {} }),
    });
    await runtime.initialize();
    expect(runtime.status().mode).toBe("unreadable");
  });
  it("starts a new round when a config choice is made during sync", async () => {
    let finishFirst!: () => void;
    let rounds = 0;
    const report = { pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] };
    const runtime = new SyncRuntime({
      load: async () => configured, save: async () => {}, store: () => new FakeS3(),
      engine: () => ({ engine: {
        syncOnce: async () => {
          rounds++;
          if (rounds === 1) await new Promise<void>((resolve) => { finishFirst = resolve; });
          return report;
        },
        resolveConfigConflict: async () => {},
      }, unregister: () => {} }),
    });
    await runtime.initialize();
    await runtime.configure(configured, "correct horse battery staple");
    const first = runtime.syncNow();
    await vi.waitFor(() => expect(rounds).toBe(1));
    const choice = runtime.resolveConfigConflict("7", "local");
    finishFirst();
    await Promise.all([first, choice]);
    await vi.waitFor(() => expect(rounds).toBe(2));
    runtime.stop();
  });
  it("uses a shared device name when no local alias exists", async () => {
    const runtime = new SyncRuntime({
      load: async () => configured, save: async () => {}, store: () => new FakeS3(),
      engine: () => ({ engine: { syncOnce: async () => ({
        pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [],
        devices: [{ id: "other", name: "Shared laptop" }],
      }) }, unregister: () => {} }),
    });
    await runtime.initialize();
    await runtime.configure(configured, "correct horse battery staple");
    await runtime.syncNow();
    expect(await runtime.devices()).toEqual([{ id: "other", name: "Shared laptop", current: false, lastUpload: undefined }]);
    runtime.stop();
  });
  it("creates a header on first enable, then requires a passphrase after restart", async () => {
    const s3 = new FakeS3();
    let saved = { ...configured };
    const deps = {
      load: async () => saved,
      save: async (next: SyncSettings) => { saved = next; },
      store: () => s3,
      engine: () => ({
        engine: { syncOnce: async () => ({ pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] }) },
        unregister: () => {},
      }),
    };
    const first = new SyncRuntime(deps);
    await first.initialize();
    expect(await first.configure(configured, "correct horse battery staple")).toBe("ok");
    expect((await readSyncHeader(s3))?.version).toBe(1);
    expect(saved.enabled).toBe(true);
    expect(await first.test(saved, "")).toBe("ok");
    first.stop();
    const second = new SyncRuntime(deps);
    await second.initialize();
    expect(second.status().mode).toBe("locked");
    expect(await second.unlock("wrong")).toBe("passphrase");
    expect(await second.unlock("correct horse battery staple")).toBe("ok");
    second.stop();
  });

  it("joins a header created by another device during setup", async () => {
    const s3 = new FakeS3();
    const put = s3.putObject.bind(s3);
    let raced = false;
    s3.putObject = async (key, body, conditions, signal) => {
      if (key === "sync-header" && !raced) {
        raced = true;
        await put(key, new TextEncoder().encode(JSON.stringify((await createSyncHeader("correct horse battery staple")).header)), { ifNoneMatch: "*" });
      }
      return put(key, body, conditions, signal);
    };
    const runtime = new SyncRuntime({
      load: async () => configured, save: async () => {}, store: () => s3,
      engine: () => ({ engine: { syncOnce: vi.fn() }, unregister: () => {} }),
    });
    expect(await runtime.configure(configured, "correct horse battery staple")).toBe("ok");
    runtime.stop();
  });

  it("disables without deleting local or remote data and forgets only remote data", async () => {
    const s3 = new FakeS3(1);
    await writeSyncHeader(s3, (await createSyncHeader("correct horse battery staple")).header);
    await s3.putObject("devices/a/manifest", new Uint8Array([1]));
    await s3.putObject("unrelated-file", new Uint8Array([2]));
    let saved = { ...configured, enabled: true };
    const runtime = new SyncRuntime({
      load: async () => saved,
      save: async (next) => { saved = next; },
      store: () => s3,
      engine: () => ({ engine: { syncOnce: vi.fn() }, unregister: () => {} }),
    });
    await runtime.initialize();
    await runtime.disable();
    expect(saved.enabled).toBe(false);
    expect(await readSyncHeader(s3)).not.toBeNull();
    await runtime.forgetRemote();
    expect((await s3.listObjectsV2()).objects.map((item) => item.key)).toEqual(["unrelated-file"]);
    runtime.stop();
  });

  it("stops this device from uploading before forgetting remote objects", async () => {
    const s3 = new FakeS3();
    await writeSyncHeader(s3, (await createSyncHeader("correct horse battery staple")).header);
    await s3.putObject("devices/a/manifest", new Uint8Array([1]));
    let saved = { ...configured, enabled: true };
    const enabledDuringDelete: boolean[] = [];
    const deleteObject = s3.deleteObject.bind(s3);
    s3.deleteObject = async (key, signal) => {
      enabledDuringDelete.push(saved.enabled);
      await deleteObject(key, signal);
    };
    const runtime = new SyncRuntime({
      load: async () => saved,
      save: async (next) => { saved = next; },
      store: () => s3,
      engine: () => ({ engine: { syncOnce: vi.fn() }, unregister: () => {} }),
    });
    await runtime.initialize();
    await runtime.unlock("correct horse battery staple");
    await runtime.forgetRemote();
    expect(enabledDuringDelete).toEqual([false, false]);
  });

  it("waits for an aborted round to finish before deleting remote data", async () => {
    const s3 = new FakeS3();
    await writeSyncHeader(s3, (await createSyncHeader("correct horse battery staple")).header);
    await s3.putObject("devices/a/manifest", new Uint8Array([1]));
    let finished = false;
    const deleteObject = s3.deleteObject.bind(s3);
    s3.deleteObject = async (key, signal) => {
      expect(finished).toBe(true);
      await deleteObject(key, signal);
    };
    const runtime = new SyncRuntime({
      load: async () => ({ ...configured, enabled: true }), save: async () => {},
      store: () => s3,
      engine: () => ({ engine: { syncOnce: async ({ signal } = {}) => new Promise((resolve) => {
        signal?.addEventListener("abort", () => setTimeout(() => {
          finished = true;
          resolve({ pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] });
        }, 10));
      }) }, unregister: () => {} }),
    });
    await runtime.initialize();
    await runtime.unlock("correct horse battery staple");
    const running = runtime.syncNow();
    await runtime.forgetRemote();
    await running;
  });

  it("resets publication state when the bucket changes and after remote data is forgotten", async () => {
    const first = new FakeS3();
    const second = new FakeS3();
    let saved = { ...configured };
    const resetState = vi.fn(async () => {});
    const runtime = new SyncRuntime({
      load: async () => saved,
      save: async (next) => { saved = next; },
      store: (settings) => settings.bucket === "other" ? second : first,
      engine: () => ({ engine: { syncOnce: async () =>
        ({ pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] }) },
        unregister: () => {} }),
      resetState,
    });
    await runtime.initialize();
    await runtime.configure(configured, "correct horse battery staple");
    resetState.mockClear();
    expect(await runtime.configure({ ...configured, bucket: "other" }, "")).toBe("ok");
    expect(resetState).toHaveBeenCalledTimes(1);
    await runtime.forgetRemote();
    expect(resetState).toHaveBeenCalledTimes(2);
  });

  it("reports invalid saved settings as a configuration error on unlock", async () => {
    const runtime = new SyncRuntime({
      load: async () => ({ ...configured, enabled: true, endpoint: "http://remote.example.test" }),
      save: async () => {},
      store: (settings) => {
        if (settings.endpoint.startsWith("http://")) throw new Error("Invalid S3 configuration");
        return new FakeS3();
      },
      engine: () => ({ engine: { syncOnce: vi.fn() }, unregister: () => {} }),
    });
    await runtime.initialize();
    expect(await runtime.unlock("correct horse battery staple")).toBe("configuration");
  });

  it("uses the last engine report for the device list without listing the bucket again", async () => {
    const id = crypto.randomUUID();
    const s3 = new FakeS3();
    await writeSyncHeader(s3, (await createSyncHeader("correct horse battery staple")).header);
    const list = vi.spyOn(s3, "listObjectsV2");
    const runtime = new SyncRuntime({
      load: async () => ({ ...configured, enabled: true }), save: async () => {}, store: () => s3,
      engine: () => ({ engine: { syncOnce: async () => ({
        pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [],
        devices: [{ id, lastUpload: "2026-10-17T00:00:00.000Z" }],
      }) }, unregister: () => {} }),
      deviceId: async () => id,
    });
    await runtime.initialize();
    await runtime.unlock("correct horse battery staple");
    await runtime.syncNow();
    const devices = await runtime.devices();
    expect(devices).toEqual([{ id, name: id.slice(0, 8), current: true, lastUpload: "2026-10-17T00:00:00.000Z" }]);
    expect(list).not.toHaveBeenCalled();
    runtime.stop();
  });

  it("finishes the old bucket's round before clearing publication state", async () => {
    const first = new FakeS3();
    const second = new FakeS3();
    let saved: SyncSettings = { ...defaultSyncSettings };
    let finished = false;
    let resetCount = 0;
    const runtime = new SyncRuntime({
      load: async () => saved,
      save: async (next) => { saved = next; },
      store: (settings) => settings.bucket === "other" ? second : first,
      engine: () => ({ engine: { syncOnce: async ({ signal } = {}) =>
        new Promise((resolve) => signal?.addEventListener("abort", () => setTimeout(() => {
          finished = true;
          resolve({ pulled: 0, pushed: 0, tombstonesApplied: 0, configChanges: 0, conflicts: [], errors: [] });
        }, 10))) }, unregister: () => {} }),
      resetState: async () => {
        if (resetCount++ > 0) expect(finished).toBe(true);
      },
    });
    await runtime.initialize();
    await runtime.configure(configured, "correct horse battery staple");
    const running = runtime.syncNow();
    expect(await runtime.configure({ ...configured, bucket: "other" }, "")).toBe("ok");
    await running;
    runtime.stop();
  });
});
