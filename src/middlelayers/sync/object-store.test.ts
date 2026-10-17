import { describe, expect, it } from "vitest";
import { createSyncHeader } from "./crypto";
import { EncryptedStore, FakeS3, S3Error, readSyncHeader, writeSyncHeader } from "./object-store";

describe("FakeS3", () => {
  it("can model a concurrent conditional request conflict", async () => {
    const s3 = new FakeS3(1000, 409);
    await s3.putObject("manifest", new Uint8Array([1]), { ifNoneMatch: "*" });
    await expect(s3.putObject("manifest", new Uint8Array([2]), { ifNoneMatch: "*" }))
      .rejects.toMatchObject({ status: 409 });
  });
  it("enforces create only and If-Match writes against ETags", async () => {
    const s3 = new FakeS3();
    const first = await s3.putObject("manifest", new Uint8Array([1]), { ifNoneMatch: "*" });
    await expect(s3.putObject("manifest", new Uint8Array([2]), { ifNoneMatch: "*" })).rejects.toMatchObject({ status: 412 });
    await expect(s3.putObject("manifest", new Uint8Array([2]), { ifMatch: '"stale"' })).rejects.toMatchObject({ status: 412 });
    const second = await s3.putObject("manifest", new Uint8Array([2]), { ifMatch: first.etag });
    expect(second.etag).not.toBe(first.etag);
    expect((await s3.getObject("manifest"))?.body).toEqual(new Uint8Array([2]));
  });

  it("paginates by prefix and continuation token", async () => {
    const s3 = new FakeS3(2);
    for (const key of ["snap/a", "snap/b", "snap/c", "other/d"]) {
      await s3.putObject(key, new Uint8Array([1]));
    }
    const first = await s3.listObjectsV2({ prefix: "snap/" });
    expect(first.objects.map((object) => object.key)).toEqual(["snap/a", "snap/b"]);
    const second = await s3.listObjectsV2({ prefix: "snap/", continuationToken: first.nextContinuationToken });
    expect(second.objects.map((object) => object.key)).toEqual(["snap/c"]);
  });
});

describe("EncryptedStore", () => {
  it("persists the plaintext header once for future passphrase checks", async () => {
    const s3 = new FakeS3();
    const { header } = await createSyncHeader("a long passphrase");
    expect(await readSyncHeader(s3)).toBeNull();
    await writeSyncHeader(s3, header);
    expect(await readSyncHeader(s3)).toEqual(header);
    await expect(writeSyncHeader(s3, header)).rejects.toMatchObject({ status: 412 });
  });

  it("round trips listed JSON using opaque remote keys", async () => {
    const s3 = new FakeS3();
    const { key } = await createSyncHeader("a long passphrase");
    const store = new EncryptedStore(s3, key);
    await store.putJson("snap/uuid-one", { balance: 12 });
    expect(await store.getJson("snap/uuid-one")).toEqual({ value: { balance: 12 }, etag: expect.any(String) });
    expect(await store.listJson("snap/")).toEqual([{ path: "snap/uuid-one", value: { balance: 12 }, etag: expect.any(String) }]);
    expect((await s3.listObjectsV2({ prefix: "snap/" })).objects[0].key).not.toContain("uuid");
    await store.deleteJson("snap/uuid-one");
    expect(await store.getJson("snap/uuid-one")).toBeNull();
  });

  it("uses conditional manifest writes and preserves the prior value on conflict", async () => {
    const s3 = new FakeS3();
    const { key } = await createSyncHeader("a long passphrase");
    const store = new EncryptedStore(s3, key);
    const first = await store.putManifest("manifest", { revision: 1 });
    await expect(store.putManifest("manifest", { revision: 2 }, '"stale"')).rejects.toBeInstanceOf(S3Error);
    expect(await store.getJson("manifest")).toEqual({ value: { revision: 1 }, etag: first.etag });
    await store.putManifest("manifest", { revision: 2 }, first.etag);
    expect((await store.getJson("manifest"))?.value).toEqual({ revision: 2 });
  });

  it("rejects swapped encrypted objects", async () => {
    const s3 = new FakeS3();
    const { key } = await createSyncHeader("a long passphrase");
    const store = new EncryptedStore(s3, key);
    await store.putJson("snap/one", { balance: 1 });
    await store.putJson("snap/two", { balance: 2 });
    const listed = await s3.listObjectsV2({ prefix: "snap/" });
    const first = await s3.getObject(listed.objects[0].key);
    const second = await s3.getObject(listed.objects[1].key);
    await s3.putObject(listed.objects[0].key, second!.body);
    await s3.putObject(listed.objects[1].key, first!.body);
    await expect(store.getJson("snap/one")).rejects.toThrow();
  });

  it("lists encrypted JSON across pages", async () => {
    const s3 = new FakeS3(1);
    const { key } = await createSyncHeader("a long passphrase");
    const store = new EncryptedStore(s3, key);
    await store.putJson("snap/one", 1);
    await store.putJson("snap/two", 2);
    expect((await store.listJson("snap/")).map((item) => item.path).sort()).toEqual(["snap/one", "snap/two"]);
  });

  it("passes cancellation through encrypted store operations", async () => {
    const s3 = new FakeS3();
    const { key } = await createSyncHeader("a long passphrase");
    const store = new EncryptedStore(s3, key);
    const controller = new AbortController();
    controller.abort();
    await expect(store.putJson("snap/one", 1, undefined, controller.signal)).rejects.toThrow(/abort/i);
    await expect(store.getJson("snap/one", controller.signal)).rejects.toThrow(/abort/i);
    await expect(store.listJson("snap/", controller.signal)).rejects.toThrow(/abort/i);
    await expect(store.deleteJson("snap/one", controller.signal)).rejects.toThrow(/abort/i);
  });
});
