-- Private D1 snapshot. Only Workers with a D1 binding may read payload.
CREATE TABLE IF NOT EXISTS catalog_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
