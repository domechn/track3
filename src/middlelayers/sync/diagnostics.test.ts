import { expect, it } from "vitest";
import { createSyncDiagnostics, recordSyncRetry, serializeSyncDiagnostics } from "./diagnostics";
import { FakeS3, S3Error } from "./object-store";

it("counts store traffic without retaining object names or credentials", async () => {
  const secret = "fake-secret-access-key";
  const accessKey = "fake-access-key-id";
  const sessionToken = "fake-session-token";
  const endpoint = "https://fake-account.r2.example";
  const bucket = "fake-private-bucket";
  const store = Object.assign(new FakeS3(), {
    endpoint, bucket, credentials: { accessKeyId: accessKey, secretAccessKey: secret, sessionToken },
  });
  const { store: counted, diagnostics, phase } = createSyncDiagnostics(store);
  phase("headerRead");
  await counted.putObject(`${bucket}/${secret}`, new Uint8Array([1, 2, 3]));
  await expect(counted.putObject(`${bucket}/${secret}`, new Uint8Array([4]), { ifNoneMatch: "*" })).rejects.toThrow();
  await counted.getObject(`${bucket}/${secret}`);
  await counted.getObject(`${endpoint}/absent`);
  phase("discover");
  await counted.listObjectsV2({ prefix: bucket });
  phase();
  expect(diagnostics.requests.PUT.count).toBe(2);
  expect(diagnostics.requests.PUT.bytesSent).toBe(4);
  expect(diagnostics.requests.PUT.outcomes.preconditionFailed.count).toBe(1);
  expect(diagnostics.requests.GET.outcomes.notFound.count).toBe(1);
  expect(diagnostics.requests.PUT.outcomes.ok.bytesSent).toBe(3);
  expect(diagnostics.requests.GET.outcomes.ok.bytesReceived).toBe(3);
  expect(diagnostics.requests.GET.bytesReceived).toBe(3);
  expect(diagnostics.slowest.every((request) => request.phase === "headerRead" || request.phase === "discover")).toBe(true);
  const serialized = serializeSyncDiagnostics(diagnostics);
  for (const privateText of [accessKey, secret, sessionToken, endpoint, bucket]) {
    expect(serialized).not.toContain(privateText);
  }
});

it("counts transport retries separately from the final store outcome", async () => {
  const { store, diagnostics } = createSyncDiagnostics(new FakeS3());
  await store.putObject("snapshot", new Uint8Array([1, 2]));
  recordSyncRetry(diagnostics, "PUT", 503, 2, 0, 125);
  expect(diagnostics.retries).toBe(1);
  expect(diagnostics.retryWaitMs).toBe(125);
  expect(diagnostics.requests.PUT.count).toBe(2);
  expect(diagnostics.requests.PUT.bytesSent).toBe(4);
  expect(diagnostics.requests.PUT.outcomes.retry).toEqual({ count: 1, bytesSent: 2, bytesReceived: 0 });
  expect(diagnostics.requests.PUT.outcomes.serverError.count).toBe(1);
  expect(diagnostics.requests.PUT.outcomes.ok.count).toBe(1);
});

it("separates exhausted rate limits from server failures", async () => {
  const inner = new FakeS3();
  inner.getObject = async () => { throw new S3Error("rate limited", 429); };
  const { store, diagnostics } = createSyncDiagnostics(inner);
  await expect(store.getObject("snapshot")).rejects.toMatchObject({ status: 429 });
  expect(diagnostics.requests.GET.outcomes.rateLimited.count).toBe(1);
  expect(diagnostics.requests.GET.outcomes.serverError.count).toBe(0);
  expect(diagnostics.requests.GET.outcomes.otherError.count).toBe(0);
});
