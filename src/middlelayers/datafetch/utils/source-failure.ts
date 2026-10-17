import type { SourceErrorCategory } from "../../portfolio-baseline";

const safeMessages: Record<SourceErrorCategory, string> = {
  auth: "Authentication or invalid key",
  network: "Network or timeout",
  rateLimit: "Rate limit",
  unsupported: "Unsupported source",
  other: "Source provider failed",
};

export class SanitizedSourceError extends Error {
  readonly category: SourceErrorCategory;

  constructor(cause: unknown) {
    const category = classifySourceError(cause);
    super(safeMessages[category]);
    this.category = category;
  }
}

export function classifySourceError(error: unknown): SourceErrorCategory {
  if (error instanceof SanitizedSourceError) return error.category;
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 429) return "rateLimit";
  if (status === 401 || status === 403) return "auth";
  if (status === 408 || (status && status >= 500)) return "network";
  const detail = message.replace(/https?:\/\/[^\s)]+/gi, "");
  if (/rate.?limit|too many requests/i.test(detail)) return "rateLimit";
  if (/unauthoriz|forbidden|invalid.?key|invalid.?token|signature|credential|passphrase|password/i.test(detail)) return "auth";
  if (/unsupported|unknown exchange|unknown broker|not implemented/i.test(message)) return "unsupported";
  if (/request failed|request timed out|timeout|timed out|network|connect|offline|unavailable|fetch failed/i.test(detail)) return "network";
  return "other";
}

// Optional provider calls may return partial holdings. Keep their most
// actionable error until the owning source finishes.
const failures = new WeakMap<object, { error: unknown; priority: number }>();
const priority: Record<SourceErrorCategory, number> = {
  rateLimit: 4,
  auth: 3,
  network: 2,
  unsupported: 1,
  other: 0,
};

export function recordSourceFailure(source: object, error: unknown): void {
  const nextPriority = priority[classifySourceError(error)];
  if (!failures.has(source) || nextPriority > failures.get(source)!.priority) {
    failures.set(source, {
      error: new SanitizedSourceError(error ?? new Error("Source provider failed")),
      priority: nextPriority,
    });
  }
}

export function recordOptionalSourceFailure(source: object, error: unknown): void {
  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) return;
  if (status === 429 || status === 408 || (status !== undefined && status >= 500)) {
    recordSourceFailure(source, error);
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const detail = message.replace(/https?:\/\/[^\s)]+/gi, "");
  if (/\b(?:code\s*700011|not (?:enabled|opened|activated|allowed|supported)|permission denied|no (?:margin|futures|earn|portfolio) account)\b/i.test(detail)) return;
  recordSourceFailure(source, error);
}

export function takeSourceFailure(source: object): Error | undefined {
  const error = failures.get(source)?.error;
  failures.delete(source);
  return error === undefined ? undefined : new SanitizedSourceError(error);
}
