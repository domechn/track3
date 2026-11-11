import { S3Error, SyncTimeoutError, listResponseBytes, type NotModifiedObject, type S3Store, type StoredObject, type StoreRetry } from "./object-store";

export const syncPhases = [
  "headerRead", "keyDerivation", "discover", "manifestsDownload", "pull",
  "localScan", "stateSave", "push", "manifestWrite", "prune",
] as const;
export type SyncPhase = typeof syncPhases[number];
export type SyncVerb = "GET" | "PUT" | "LIST" | "DELETE" | "HEAD";
export type SyncOutcome = "ok" | "notModified" | "notFound" | "preconditionFailed" | "conflict" | "rateLimited" | "serverError" | "timeout" | "retry" | "otherError";
type RequestCounts = {
  count: number;
  bytesSent: number;
  bytesReceived: number;
  outcomes: Record<SyncOutcome, { count: number; bytesSent: number; bytesReceived: number }>;
};
export type SyncDiagnostics = {
  wallMs: number;
  phases: Record<SyncPhase, number>;
  requests: Record<SyncVerb, RequestCounts>;
  retries: number;
  retryWaitMs: number;
  timeouts: number;
  syncStateBytes: number;
  snapshots: number;
  entries: number;
  knownTokens: number;
  slowest: Array<{ verb: SyncVerb; phase: SyncPhase; ms: number }>;
  failures?: Array<{ phase: SyncPhase; kind: string; reason: string; count: number }>;
  failedPulls?: { count: number; earliestRetryAt?: string };
  conflicts?: Record<"snapshot" | "edit" | "config" | "session" | "tombstone", number>;
  perDevice?: Record<string, { failed: number; succeeded: number; manifestVersion: number | "unknown"; appVersion: string }>;
  appVersion?: string;
  syncFormatVersion?: number;
};

export const serializeSyncDiagnostics = (diagnostics: SyncDiagnostics): string =>
  JSON.stringify(diagnostics, null, 2);

export function countSyncConflicts(conflicts: string[]): NonNullable<SyncDiagnostics["conflicts"]> {
  const counts = { snapshot: 0, edit: 0, config: 0, session: 0, tombstone: 0 };
  for (const conflict of new Set(conflicts)) {
    const type = conflict.split(":", 1)[0];
    if (type === "snapshot" || type === "edit" || type === "session" || type === "tombstone") counts[type]++;
    else counts.config++;
  }
  return counts;
}

export function summarizeFailedPulls(failedPulls: Record<string, number> | undefined): NonNullable<SyncDiagnostics["failedPulls"]> {
  const times = Object.values(failedPulls ?? {});
  const earliest = times.reduce((min, time) => Number.isFinite(time) && Math.abs(time) <= 8.64e15 && time < min ? time : min, Infinity);
  return { count: times.length, ...(earliest !== Infinity ? { earliestRetryAt: new Date(earliest).toISOString() } : {}) };
}

export function sanitizeImportError(error: unknown): string {
  const name = error instanceof Error && ["Error", "TypeError", "RangeError", "SqliteError"].includes(error.name)
    ? error.name : "Error";
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const text = message.slice(0, 120)
    .replace(/["'`][^"'`]*["'`]/g, "<redacted>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<redacted>")
    .replace(/\d{7,}/g, "<redacted>");
  if (/^(Failed to (open sync database|begin sync import|inspect sync snapshot|read local cost prices|insert sync (asset|price|transaction)|record sync snapshot|commit sync snapshot|roll back sync snapshot)|Invalid sync (snapshot|transaction asset)|Duplicate sync asset id)$/.test(text)) return `${name}: ${text}`;
  const constraint = /^(UNIQUE|NOT NULL|CHECK) constraint failed: (assets_v2|asset_prices|transactions|history_snapshots|snapshot_partial)(?:\.[A-Za-z_][A-Za-z_0-9]*)?/i.exec(text);
  if (constraint) return `${name}: ${constraint[1].toUpperCase()} constraint failed: ${constraint[2]}.<redacted>`;
  if (/^FOREIGN KEY constraint failed/i.test(text)) return `${name}: FOREIGN KEY constraint failed`;
  if (/^database is (locked|busy)/i.test(text)) return `${name}: database is ${/^database is locked/i.test(text) ? "locked" : "busy"}`;
  return `${name}: <redacted>`;
}

const verbs: SyncVerb[] = ["GET", "PUT", "LIST", "DELETE", "HEAD"];
const outcomes: SyncOutcome[] = ["ok", "notModified", "notFound", "preconditionFailed", "conflict", "rateLimited", "serverError", "timeout", "retry", "otherError"];
const size = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

export function recordSyncRetry(diagnostics: SyncDiagnostics, verb: SyncVerb, status: number, bytesSent: number, bytesReceived: number, waitMs: number, resumed = true): void {
  diagnostics.retryWaitMs += waitMs;
  if (!resumed) return;
  diagnostics.retries++;
  diagnostics.requests[verb].count++;
  diagnostics.requests[verb].bytesSent += bytesSent;
  diagnostics.requests[verb].bytesReceived += bytesReceived;
  diagnostics.requests[verb].outcomes.retry.count++;
  diagnostics.requests[verb].outcomes.retry.bytesSent += bytesSent;
  diagnostics.requests[verb].outcomes.retry.bytesReceived += bytesReceived;
  const outcome = status === 429 ? "rateLimited" : status >= 500 ? "serverError" : "otherError";
  diagnostics.requests[verb].outcomes[outcome].count++;
  diagnostics.requests[verb].outcomes[outcome].bytesSent += bytesSent;
  diagnostics.requests[verb].outcomes[outcome].bytesReceived += bytesReceived;
}

export function createSyncDiagnostics(inner: S3Store) {
  const started = performance.now();
  const diagnostics: SyncDiagnostics = {
    wallMs: 0,
    phases: Object.fromEntries(syncPhases.map((name) => [name, 0])) as SyncDiagnostics["phases"],
    requests: Object.fromEntries(verbs.map((verb) => [verb, {
      count: 0, bytesSent: 0, bytesReceived: 0,
      outcomes: Object.fromEntries(outcomes.map((outcome) => [outcome, {
        count: 0, bytesSent: 0, bytesReceived: 0,
      }])),
    }])) as SyncDiagnostics["requests"],
    retries: 0, retryWaitMs: 0, timeouts: 0, syncStateBytes: 0, snapshots: 0, entries: 0, knownTokens: 0, slowest: [],
    failures: [], failedPulls: { count: 0 }, conflicts: { snapshot: 0, edit: 0, config: 0, session: 0, tombstone: 0 },
    perDevice: {}, appVersion: "unknown", syncFormatVersion: 1,
  };
  const unsubscribe = inner.observeRetries?.((retry: StoreRetry) => {
    recordSyncRetry(diagnostics, retry.verb, retry.status, retry.bytesSent, retry.bytesReceived, retry.waitMs, retry.resumed);
  });
  let current: SyncPhase = "headerRead";
  let phaseStarted = started;
  const phase = (next?: SyncPhase) => {
    const now = performance.now();
    diagnostics.phases[current] += now - phaseStarted;
    phaseStarted = now;
    if (next) current = next;
  };
  const measureSave = async <T>(work: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try { return await work(); }
    finally { diagnostics.phases.stateSave += performance.now() - start; }
  };
  const record = async <T>(verb: SyncVerb, work: () => Promise<T>, sent = 0, received: (result: T) => number = () => 0): Promise<T> => {
    const start = performance.now();
    const counts = diagnostics.requests[verb];
    counts.count++;
    counts.bytesSent += sent;
    let outcome: SyncOutcome = "ok";
    let receivedBytes = 0;
    try {
      const result = await work();
      if (result === null) outcome = "notFound";
      else if (result && typeof result === "object" && "notModified" in result) outcome = "notModified";
      receivedBytes = received(result);
      counts.bytesReceived += receivedBytes;
      return result;
    } catch (error) {
      outcome = error instanceof SyncTimeoutError ? "timeout" :
        error instanceof S3Error && error.status === 304 ? "notModified" :
          error instanceof S3Error && error.status === 404 ? "notFound" :
            error instanceof S3Error && error.status === 412 ? "preconditionFailed" :
              error instanceof S3Error && error.status === 409 ? "conflict" :
              error instanceof S3Error && error.status === 429 ? "rateLimited" :
                error instanceof S3Error && error.status >= 500 ? "serverError" : "otherError";
      if (outcome === "timeout") diagnostics.timeouts++;
      throw error;
    } finally {
      counts.outcomes[outcome].count++;
      counts.outcomes[outcome].bytesSent += sent;
      counts.outcomes[outcome].bytesReceived += receivedBytes;
      const ms = performance.now() - start;
      diagnostics.slowest.push({ verb, phase: current, ms });
      diagnostics.slowest.sort((a, b) => b.ms - a.ms);
      diagnostics.slowest.length = Math.min(diagnostics.slowest.length, 5);
    }
  };
  function getObject(key: string, signal?: AbortSignal): Promise<StoredObject | null>;
  function getObject(key: string, signal: AbortSignal | undefined, ifNoneMatch: string): Promise<StoredObject | NotModifiedObject | null>;
  function getObject(key: string, signal?: AbortSignal, ifNoneMatch?: string): Promise<StoredObject | NotModifiedObject | null> {
    return record("GET", () => ifNoneMatch === undefined ? inner.getObject(key, signal) : inner.getObject(key, signal, ifNoneMatch), 0,
      (result) => result && "body" in result ? result.body.length : 0);
  }
  const store: S3Store = {
    putObject: (key, body, conditions, signal) =>
      record("PUT", () => inner.putObject(key, body, conditions, signal), body.length),
    getObject,
    headObject: (key, signal) =>
      record("HEAD", () => inner.headObject(key, signal)),
    deleteObject: (key, signal) =>
      record("DELETE", () => inner.deleteObject(key, signal)),
    listObjectsV2: (options) =>
      record("LIST", () => inner.listObjectsV2(options), 0, (result) =>
        (result as typeof result & { [listResponseBytes]?: number })[listResponseBytes] ?? size(result)),
  };
  return {
    store, diagnostics, phase, measureSave,
    finish: () => { phase(); diagnostics.wallMs = performance.now() - started; unsubscribe?.(); },
  };
}
