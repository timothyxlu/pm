-- Initial schema for pm.timothyxlu.xyz
CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,              -- 'BLOG', used for identifiers like BLOG-12
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done','archived')),
  github_repos TEXT NOT NULL DEFAULT '[]',        -- JSON array, e.g. ["timothyxlu/blog"]
  next_number  INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE issues (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id),
  number       INTEGER,                           -- per-project counter; NULL for migrated issues
  identifier   TEXT NOT NULL UNIQUE,              -- 'BLOG-12'; migrated issues keep Linear ids like 'ENG-42'
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo'
               CHECK (status IN ('backlog','todo','in_progress','in_review','done','canceled')),
  priority     INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4), -- 0 none, 1 urgent, 2 high, 3 medium, 4 low
  parent_id    TEXT REFERENCES issues(id),
  due_date     TEXT,
  sort_order   REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  completed_at TEXT,
  deleted_at   TEXT,
  UNIQUE (project_id, number)
);
CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_issues_updated ON issues(updated_at);

CREATE TABLE labels (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT
);
CREATE TABLE issue_labels (
  issue_id TEXT NOT NULL REFERENCES issues(id),
  label_id TEXT NOT NULL REFERENCES labels(id),
  PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  issue_id   TEXT NOT NULL REFERENCES issues(id),
  actor      TEXT NOT NULL CHECK (actor IN ('me','claude','github')),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_comments_issue ON comments(issue_id, created_at);

CREATE TABLE github_links (
  id         TEXT PRIMARY KEY,
  issue_id   TEXT NOT NULL REFERENCES issues(id),
  repo       TEXT NOT NULL,                       -- 'timothyxlu/blog'
  kind       TEXT NOT NULL CHECK (kind IN ('pr','issue')),
  number     INTEGER NOT NULL,
  title      TEXT,
  url        TEXT NOT NULL,
  state      TEXT,                                -- open / draft / merged / closed
  updated_at TEXT NOT NULL,
  UNIQUE (issue_id, repo, kind, number)
);

CREATE TABLE activity (
  id         TEXT PRIMARY KEY,
  issue_id   TEXT REFERENCES issues(id),
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,                       -- created, updated, commented, linked_github ...
  data       TEXT,                                -- JSON
  created_at TEXT NOT NULL
);
CREATE INDEX idx_activity_issue ON activity(issue_id, created_at);
CREATE INDEX idx_activity_created ON activity(created_at);

CREATE TABLE api_tokens (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,              -- SHA-256 hex; plaintext is shown once
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at   TEXT
);

-- Full-text search over issues
CREATE VIRTUAL TABLE issues_fts USING fts5(identifier, title, description, content='issues', content_rowid='rowid');
CREATE TRIGGER issues_ai AFTER INSERT ON issues BEGIN
  INSERT INTO issues_fts(rowid, identifier, title, description) VALUES (new.rowid, new.identifier, new.title, new.description);
END;
CREATE TRIGGER issues_ad AFTER DELETE ON issues BEGIN
  INSERT INTO issues_fts(issues_fts, rowid, identifier, title, description) VALUES ('delete', old.rowid, old.identifier, old.title, old.description);
END;
CREATE TRIGGER issues_au AFTER UPDATE OF identifier, title, description ON issues BEGIN
  INSERT INTO issues_fts(issues_fts, rowid, identifier, title, description) VALUES ('delete', old.rowid, old.identifier, old.title, old.description);
  INSERT INTO issues_fts(rowid, identifier, title, description) VALUES (new.rowid, new.identifier, new.title, new.description);
END;
