import type { PortfolioSourceResult, PortfolioSourceStatus, SourceErrorCategory, SourceKind } from "./portfolio-baseline";
import { normalizeWalletToMD5 } from "@/lib/utils";
import { getDatabase } from "./database";

type PartialReader = {
  select<T>(sql: string, values?: unknown[]): Promise<T>;
};

export async function isSnapshotPartial(uuid: string, reader?: PartialReader): Promise<boolean> {
  const db = reader ?? await getDatabase();
  const rows = await db.select<Array<{ uuid: string }>>(
    "SELECT uuid FROM snapshot_partial WHERE uuid = ? LIMIT 1", [uuid],
  );
  return rows.length > 0;
}

export async function partialSnapshotIds(uuids: string[], reader?: PartialReader): Promise<Set<string>> {
  const partial = new Set<string>();
  if (!uuids.length) return partial;
  const db = reader ?? await getDatabase();
  for (let index = 0; index < uuids.length; index += 500) {
    const batch = uuids.slice(index, index + 500);
    const rows = await db.select<Array<{ uuid: string }>>(
      `SELECT uuid FROM snapshot_partial WHERE uuid IN (${batch.map(() => "?").join(",")})`, batch,
    );
    rows.forEach((row) => partial.add(row.uuid));
  }
  return partial;
}

export async function isLatestSnapshotPartial(reader?: PartialReader): Promise<boolean> {
  const db = reader ?? await getDatabase();
  const rows = await db.select<Array<{ uuid: string }>>(
    `SELECT p.uuid FROM snapshot_partial p WHERE p.uuid = (
       SELECT uuid FROM assets_v2 ORDER BY createdAt DESC, id DESC LIMIT 1
     ) LIMIT 1`,
  );
  return rows.length > 0;
}

export async function snapshotExclusionOptions(
  uuid: string,
  reader?: PartialReader,
): Promise<Array<{ provider: string; value: number }>> {
  const db = reader ?? await getDatabase();
  const markers = await db.select<Array<{ missing: string }>>(
    "SELECT missing FROM snapshot_partial WHERE uuid = ? LIMIT 1", [uuid],
  );
  if (!markers.length) return [];
  const missing = JSON.parse(markers[0].missing) as PartialSnapshot["missing"];
  const wallets = [...new Set(missing.map((source) => source.wallet))];
  const rows = await db.select<Array<{ wallet: string; value: number }>>(
    `SELECT wallet, SUM(value) AS value FROM assets_v2 WHERE uuid = ? AND wallet IN (${wallets.map(() => "?").join(",")}) GROUP BY wallet`,
    [uuid, ...wallets],
  );
  const valueByWallet = new Map(rows.map((row) => [row.wallet, row.value]));
  const walletsByProvider = new Map<string, Set<string>>();
  for (const source of missing) {
    const providerWallets = walletsByProvider.get(source.provider) ?? new Set<string>();
    providerWallets.add(source.wallet);
    walletsByProvider.set(source.provider, providerWallets);
  }
  return [...walletsByProvider].map(([provider, providerWallets]) => ({
    provider,
    value: [...providerWallets].reduce((total, wallet) => total + (valueByWallet.get(wallet) ?? 0), 0),
  })).sort((a, b) => a.provider.localeCompare(b.provider));
}

export type PartialSnapshot = {
  sourcesTotal: number;
  missing: Array<{
    wallet: string;
    kind: SourceKind;
    provider: string;
    category: SourceErrorCategory;
    lastSuccessAt?: string;
  }>;
  fill: "last_known";
  createdAt: string;
};

export type PartialRow = {
  uuid: string;
  sources_total: number;
  missing: string;
  fill: "last_known";
  created_at: string;
};

export function partialFromRow(row: PartialRow): PartialSnapshot {
  return {
    sourcesTotal: row.sources_total,
    missing: JSON.parse(row.missing),
    fill: row.fill,
    createdAt: row.created_at,
  };
}

export function validatePartialSnapshot(value: PartialSnapshot): PartialSnapshot {
  const validDate = (date: unknown) => typeof date === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(date) &&
    !Number.isNaN(Date.parse(date)) && new Date(date).toISOString() === date;
  const kinds = ["exchange", "wallet", "broker", "others"];
  const categories = ["auth", "service", "network", "rateLimit", "quota", "unsupported", "other"];
  if (!value || Object.keys(value).sort().join() !== "createdAt,fill,missing,sourcesTotal" ||
      !Number.isInteger(value.sourcesTotal) || value.sourcesTotal < 1 || value.sourcesTotal > 10000 ||
      value.fill !== "last_known" || !validDate(value.createdAt) ||
      !Array.isArray(value.missing) || value.missing.length < 1 || value.missing.length > 64 ||
      value.missing.some((source) =>
        !source || typeof source.wallet !== "string" || !/^[0-9a-f]{32}$/.test(source.wallet) ||
        !kinds.includes(source.kind) || typeof source.provider !== "string" ||
        source.provider.length < 1 || new TextEncoder().encode(source.provider).length > 80 ||
        /[\p{Cc}\uD800-\uDFFF]/u.test(source.provider) ||
        !categories.includes(source.category) ||
        Object.keys(source).some((key) => !["wallet", "kind", "provider", "category", "lastSuccessAt"].includes(key)) ||
        (source.lastSuccessAt !== undefined && !validDate(source.lastSuccessAt)))) {
    throw new Error("Invalid partial snapshot");
  }
  return value;
}

export function partialFromSourceStatuses(
  statuses: PortfolioSourceStatus[],
  results: PortfolioSourceResult[] | undefined,
  createdAt: string,
): PartialSnapshot | undefined {
  const missing: PartialSnapshot["missing"] = [];
  for (const status of statuses) {
    if (status.status !== "stale") continue;
    const source = results?.find((item) => item.sourceId === status.sourceId);
    if (!source?.walletIdentities.length || !status.kind || !status.provider) continue;
    for (const identity of source.walletIdentities) {
      if (missing.length === 64) break;
      const wallet = normalizeWalletToMD5(identity);
      if (!/^[0-9a-f]{32}$/.test(wallet)) continue;
      missing.push({
        wallet, kind: status.kind,
        provider: status.provider.slice(0, 80), category: status.category ?? "other",
        ...(status.lastSuccessAt && !Number.isNaN(Date.parse(status.lastSuccessAt))
          ? { lastSuccessAt: new Date(status.lastSuccessAt).toISOString() } : {}),
      });
    }
  }
  if (!missing.length) return undefined;
  try {
    return validatePartialSnapshot({
      sourcesTotal: statuses.length, missing, fill: "last_known", createdAt,
    });
  } catch {
    return undefined;
  }
}
