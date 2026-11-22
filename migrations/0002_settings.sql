-- Small key/value store for instance settings, e.g. the GitHub App credentials
-- that GitHub hands back at the end of the app manifest flow.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,          -- JSON
  updated_at TEXT NOT NULL
);
