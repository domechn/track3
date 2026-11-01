CREATE TABLE IF NOT EXISTS sync_manifest_cache (
  owner TEXT NOT NULL,
  header_salt TEXT NOT NULL,
  etag TEXT NOT NULL,
  body TEXT NOT NULL CHECK (json_valid(body)),
  last_modified TEXT,
  PRIMARY KEY (owner, etag)
);
