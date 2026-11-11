import { expect, it } from "vitest";
import { countSyncConflicts, createSyncDiagnostics, recordSyncRetry, sanitizeImportError, serializeSyncDiagnostics, summarizeFailedPulls } from "./diagnostics";
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

it("counts one conflict of each kind without copying any conflict id", () => {
  expect(countSyncConflicts([
    "snapshot:private", "edit:private", "10", "session:private", "tombstone:private",
  ])).toEqual({ snapshot: 1, edit: 1, config: 1, session: 1, tombstone: 1 });
});

it("redacts untrusted import messages, including quoted values and long identifiers", () => {
  expect(sanitizeImportError(new Error(
    "UNIQUE constraint failed: assets_v2.uuid; value 'secret-name' 123456789 11111111-2222-4333-8444-555555555555",
  ))).toBe("Error: UNIQUE constraint failed: assets_v2.<redacted>");
  expect(sanitizeImportError(new Error("token=secret https://s3.example.com/private/path"))).not.toMatch(/secret|s3\.example|private/);
  expect(sanitizeImportError("Failed to insert sync asset")).toBe("Error: Failed to insert sync asset");
});

it("summarizes retry times without letting malformed local state break diagnostics", () => {
  expect(summarizeFailedPulls({
    first: Date.parse("2026-01-04T00:00:00Z"),
    second: Date.parse("2026-01-03T00:00:00Z"),
  })).toEqual({ count: 2, earliestRetryAt: "2026-01-03T00:00:00.000Z" });
  expect(summarizeFailedPulls({ malformed: Number.POSITIVE_INFINITY })).toEqual({ count: 1 });
});

it("serializes a round without configured credentials, object paths, or full device ids", async () => {
  const bucket = "my-secret-bucket";
  const endpoint = "https://s3.example.com";
  const passphrase = "super-private-passphrase";
  const accessKeyId = "my-access-key";
  const secretAccessKey = "my-secret-access-key";
  const sessionToken = "my-session-token";
  const deviceId = "abcdefab-2222-4333-8444-555555555555";
  const store = Object.assign(new FakeS3(), {
    bucket, endpoint, passphrase, credentials: { accessKeyId, secretAccessKey, sessionToken },
  });
  const { store: counted, diagnostics } = createSyncDiagnostics(store);
  await counted.putObject(`devices/${deviceId}/${bucket}/${passphrase}`, new Uint8Array([1]));
  diagnostics.perDevice = { [deviceId.slice(0, 8)]: { failed: 1, succeeded: 0, manifestVersion: 1, appVersion: "unknown" } };
  diagnostics.failures = [{ phase: "pull", kind: "snapshot", reason: "read-failed:hash", count: 1 }];
  const output = serializeSyncDiagnostics(diagnostics);
  for (const secret of [bucket, endpoint, passphrase, accessKeyId, secretAccessKey, sessionToken, deviceId]) {
    expect(output).not.toContain(secret);
  }
  expect(output).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  const strings = (value: unknown): string[] => typeof value === "string" ? [value]
    : value && typeof value === "object" ? Object.entries(value).flatMap(([key, item]) => [key, ...strings(item)]) : [];
  expect(strings(JSON.parse(output)).join(" ")).not.toMatch(/\d{7,}/);
});
