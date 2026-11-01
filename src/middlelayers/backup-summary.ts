import { selectFromDatabaseWithSql } from "./database";

export type BackupSummary = { snapshots: number; assets: number; transactions: number };

export async function queryBackupSummary(): Promise<BackupSummary> {
  const [summary] = await selectFromDatabaseWithSql<BackupSummary>(
    `SELECT
      (SELECT COUNT(*) FROM history_snapshots) AS snapshots,
      (SELECT COUNT(DISTINCT asset_type || ':' || symbol) FROM assets_v2
       WHERE uuid = (SELECT uuid FROM history_snapshots ORDER BY createdAt DESC, uuid DESC LIMIT 1)) AS assets,
      (SELECT COUNT(*) FROM transactions) AS transactions`,
    [],
  );
  return summary;
}
