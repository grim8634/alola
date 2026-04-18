-- 001_init.sql — initial schema for alola todos

CREATE TABLE IF NOT EXISTS schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  tz             TEXT NOT NULL DEFAULT 'Europe/London',
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    INTEGER NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  user_agent    TEXT,
  ip            TEXT
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE api_keys (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at  INTEGER,
  revoked_at    INTEGER
);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix) WHERE revoked_at IS NULL;

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, name)
);

CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  notes         TEXT,
  priority      INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  due_at        INTEGER,
  completed_at  INTEGER,
  position      INTEGER NOT NULL DEFAULT 0,
  client_id     TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_tasks_user_completed ON tasks(user_id, completed_at);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_at);
CREATE INDEX idx_tasks_user_category ON tasks(user_id, category_id);
CREATE INDEX idx_tasks_user_updated ON tasks(user_id, updated_at);
CREATE UNIQUE INDEX idx_tasks_user_client_id ON tasks(user_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE subtasks (
  id            INTEGER PRIMARY KEY,
  task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  completed_at  INTEGER,
  position      INTEGER NOT NULL DEFAULT 0,
  client_id     TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_subtasks_task ON subtasks(task_id, position);
CREATE UNIQUE INDEX idx_subtasks_task_client_id ON subtasks(task_id, client_id) WHERE client_id IS NOT NULL;

CREATE TABLE deletions (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  entity      TEXT NOT NULL CHECK (entity IN ('task', 'subtask', 'category')),
  entity_id   INTEGER NOT NULL,
  deleted_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_deletions_user_deleted_at ON deletions(user_id, deleted_at);
