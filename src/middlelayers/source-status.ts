import type { PortfolioSourceStatus } from "./portfolio-baseline";
import { redactSecrets } from "./security/redact";
import { safePartialEndpoint } from "./datafetch/utils/source-failure";

const categories = new Set(["auth", "network", "rateLimit", "unsupported", "other"]);
const kinds = new Set(["exchange", "wallet", "broker", "others"]);
const details = new Set(["Source timed out", "Unsupported exchange", "Invalid source holdings"]);
const maskedHint = /^(?:[A-Za-z0-9_-]{4}…[A-Za-z0-9_-]{4}|[A-Za-z0-9_-]{6}…[A-Za-z0-9_-]{4}|#(?:[1-9]\d{0,4}))$/;

export function maskSourceIdentifier(value: string, start: 4 | 6): string | undefined {
  if (value.length < start + 8 || !/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  return `${value.slice(0, start)}…${value.slice(-4)}`;
}

export function normalizeSourceStatuses(value: unknown): PortfolioSourceStatus[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((source): PortfolioSourceStatus[] => {
    if (!source || typeof source.sourceId !== "string" || typeof source.label !== "string" ||
      !["ok", "partial", "stale", "failed"].includes(source.status)) return [];
    const provider = typeof source.provider === "string" ? redactSecrets(source.provider) : "";
    const endpoints: string[] = Array.isArray(source.partial?.endpoints)
      ? [...new Set<string>((source.partial.endpoints as unknown[]).filter((endpoint: unknown): endpoint is string =>
          typeof endpoint === "string" && safePartialEndpoint(endpoint) === endpoint))].slice(0, 12)
      : [];
    return [{
      sourceId: source.sourceId,
      label: redactSecrets(source.label),
      status: source.status,
      ...(source.status === "partial" ? { partial: {
        category: categories.has(source.partial?.category) ? source.partial.category : "other",
        endpoints,
        ...(typeof source.partial?.lowerThanPrevious === "boolean"
          ? { lowerThanPrevious: source.partial.lowerThanPrevious } : {}),
      } } : {}),
      ...(categories.has(source.category) ? { category: source.category } : {}),
      ...(kinds.has(source.kind) ? { kind: source.kind } : {}),
      ...(provider && provider.length <= 32 && /^[\w .-]+$/.test(provider) ? { provider } : {}),
      ...(typeof source.hint === "string" && maskedHint.test(source.hint.replace(/^API key /, ""))
        ? { hint: source.hint.replace(/^API key /, "") } : {}),
      ...(details.has(source.detail) ? { detail: source.detail } : {}),
      ...(typeof source.lastSuccessAt === "string" && Number.isFinite(Date.parse(source.lastSuccessAt)) &&
        source.lastSuccessAt.length <= 30 ? { lastSuccessAt: source.lastSuccessAt } : {}),
    }];
  });
}

export function sourceIdentity(source: PortfolioSourceStatus): string {
  return source.provider
    ? `${source.label} (${source.provider}${source.hint ? ` · ${source.hint}` : ""})`
    : source.label;
}

export function sortSourceStatuses(statuses: readonly PortfolioSourceStatus[]): PortfolioSourceStatus[] {
  const order = { failed: 0, stale: 1, partial: 2, ok: 3 };
  return [...statuses].sort((a, b) => order[a.status] - order[b.status]);
}
