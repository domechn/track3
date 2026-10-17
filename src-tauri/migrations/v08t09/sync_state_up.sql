CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL CHECK (json_valid(data))
);

CREATE TABLE IF NOT EXISTS sync_applied_objects (
  object_key TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_snapshot_revision_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL
);
INSERT OR IGNORE INTO sync_snapshot_revision_counter (id, revision) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS sync_snapshot_revisions (
  uuid TEXT PRIMARY KEY,
  revision INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_snapshot_revisions_revision ON sync_snapshot_revisions (revision);

CREATE TRIGGER IF NOT EXISTS sync_assets_insert AFTER INSERT ON assets_v2 BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT NEW.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS sync_assets_update AFTER UPDATE ON assets_v2 BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT NEW.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS sync_assets_delete AFTER DELETE ON assets_v2 BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT OLD.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;

CREATE TRIGGER IF NOT EXISTS sync_prices_insert AFTER INSERT ON asset_prices BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT NEW.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS sync_prices_update AFTER UPDATE ON asset_prices BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT NEW.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS sync_prices_delete AFTER DELETE ON asset_prices BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT OLD.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;

CREATE TRIGGER IF NOT EXISTS sync_transactions_insert AFTER INSERT ON transactions BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT NEW.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS sync_transactions_update AFTER UPDATE ON transactions BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT NEW.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;
CREATE TRIGGER IF NOT EXISTS sync_transactions_delete AFTER DELETE ON transactions BEGIN
  UPDATE sync_snapshot_revision_counter SET revision = revision + 1 WHERE id = 1;
  INSERT INTO sync_snapshot_revisions (uuid, revision)
    SELECT OLD.uuid, revision FROM sync_snapshot_revision_counter WHERE id = 1
    ON CONFLICT(uuid) DO UPDATE SET revision = excluded.revision;
END;
