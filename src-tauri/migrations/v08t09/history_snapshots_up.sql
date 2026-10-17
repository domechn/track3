CREATE TABLE IF NOT EXISTS history_snapshots (
  uuid TEXT PRIMARY KEY NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS history_snapshots_time_idx ON history_snapshots (createdAt DESC, uuid DESC);

INSERT OR REPLACE INTO history_snapshots (uuid, createdAt)
SELECT uuid, MAX(createdAt) FROM assets_v2
GROUP BY uuid
LIMIT (SELECT CASE WHEN EXISTS (SELECT 1 FROM history_snapshots) THEN 0 ELSE -1 END);

CREATE TRIGGER IF NOT EXISTS history_snapshots_insert
AFTER INSERT ON assets_v2
BEGIN
  INSERT INTO history_snapshots (uuid, createdAt) VALUES (NEW.uuid, NEW.createdAt)
  ON CONFLICT(uuid) DO UPDATE SET createdAt =
    CASE WHEN excluded.createdAt < history_snapshots.createdAt
      THEN (SELECT MAX(createdAt) FROM assets_v2 WHERE uuid = excluded.uuid)
      ELSE excluded.createdAt END;
END;

CREATE TRIGGER IF NOT EXISTS history_snapshots_delete
AFTER DELETE ON assets_v2
BEGIN
  DELETE FROM history_snapshots WHERE uuid = OLD.uuid
    AND NOT EXISTS (SELECT 1 FROM assets_v2 WHERE uuid = OLD.uuid);
  UPDATE history_snapshots SET createdAt =
    (SELECT MAX(createdAt) FROM assets_v2 WHERE uuid = OLD.uuid)
    WHERE uuid = OLD.uuid AND createdAt = OLD.createdAt
      AND NOT EXISTS (SELECT 1 FROM assets_v2 WHERE uuid = OLD.uuid AND createdAt = OLD.createdAt);
END;

CREATE TRIGGER IF NOT EXISTS history_snapshots_update
AFTER UPDATE OF uuid, createdAt ON assets_v2
BEGIN
  DELETE FROM history_snapshots WHERE uuid = OLD.uuid
    AND NOT EXISTS (SELECT 1 FROM assets_v2 WHERE uuid = OLD.uuid);
  UPDATE history_snapshots SET createdAt =
    (SELECT MAX(createdAt) FROM assets_v2 WHERE uuid = OLD.uuid)
    WHERE uuid = OLD.uuid AND createdAt = OLD.createdAt
      AND NOT EXISTS (SELECT 1 FROM assets_v2 WHERE uuid = OLD.uuid AND createdAt = OLD.createdAt);
  INSERT INTO history_snapshots (uuid, createdAt) VALUES (NEW.uuid, NEW.createdAt)
  ON CONFLICT(uuid) DO UPDATE SET createdAt =
    CASE WHEN excluded.createdAt < history_snapshots.createdAt
      THEN (SELECT MAX(createdAt) FROM assets_v2 WHERE uuid = excluded.uuid)
      ELSE excluded.createdAt END;
END;
