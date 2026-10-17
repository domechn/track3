import { describe, expect, it } from "vitest";
import { createSyncHeader } from "./crypto";
import { FakeS3, S3Error, writeSyncHeader } from "./object-store";
import { classifySyncError, testSyncConnection, validateSyncSettings, type SyncSettings } from "./settings";

const settings: SyncSettings = {
  endpoint: "https://s3.example.test", region: "us-east-1", bucket: "track3",
  prefix: "", accessKeyId: "key", secretAccessKey: "secret", pathStyle: true,
  categories: { history: true, settings: true, secrets: false, rebalance: true, chat: true },
  enabled: false, deviceNames: {},
};

describe("sync settings", () => {
  it("rejects incomplete endpoint, bucket and credential settings", () => {
    expect(validateSyncSettings({ ...settings, bucket: "" })).toBe("configuration");
    expect(validateSyncSettings({ ...settings, secretAccessKey: "" })).toBe("configuration");
    expect(validateSyncSettings({ ...settings, endpoint: "http://remote.example.test" })).toBe("configuration");
    expect(validateSyncSettings(settings)).toBeNull();
    expect(validateSyncSettings({ ...settings, prefix: "/team/one/" })).toBeNull();
  });

  it("checks bucket access and an existing header with the passphrase", async () => {
    const store = new FakeS3();
    await writeSyncHeader(store, (await createSyncHeader("correct horse battery staple")).header);
    expect(await testSyncConnection(store, "correct horse battery staple")).toBe("ok");
    expect(await testSyncConnection(store, "wrong")).toBe("passphrase");
    expect(await testSyncConnection(store, "")).toBe("passphrase");
  });

  it("checks write access and conditional writes before reporting a working connection", async () => {
    const store = new FakeS3();
    store.putObject = async () => { throw new S3Error("secret", 403); };
    expect(await testSyncConnection(store, "correct horse battery staple")).toBe("access");
    const badConditions = new FakeS3();
    const put = badConditions.putObject.bind(badConditions);
    badConditions.putObject = (key, body) => put(key, body);
    expect(await testSyncConnection(badConditions, "correct horse battery staple")).toBe("conditions");
    const badMatch = new FakeS3();
    const matchPut = badMatch.putObject.bind(badMatch);
    badMatch.putObject = (key, body, conditions) => matchPut(key, body, conditions?.ifMatch ? undefined : conditions);
    expect(await testSyncConnection(badMatch, "correct horse battery staple")).toBe("conditions");
  });

  it("classifies access, missing bucket, network, and malformed header without leaking secrets", async () => {
    expect(classifySyncError(new S3Error("secret", 403))).toBe("access");
    expect(classifySyncError(new S3Error("secret", 404))).toBe("bucket");
    expect(classifySyncError(new Error("secret network payload"))).toBe("network");
    expect(classifySyncError(new Error("Invalid S3 configuration"))).toBe("configuration");
    const store = new FakeS3();
    await store.putObject("sync-header", new TextEncoder().encode("not json"));
    expect(await testSyncConnection(store, "long passphrase")).toBe("header");
  });
});
