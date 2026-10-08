import Database from 'better-sqlite3';
import path from 'node:path';

const db = new Database(process.env.DB_FILE || path.resolve('reaper.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  progress TEXT DEFAULT '',
  error TEXT,
  summary TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  type TEXT, severity TEXT, masked TEXT, location TEXT,
  status TEXT,            -- present | deleted_but_exposed
  commit_sha TEXT, author TEXT, committed_at TEXT, removed_in TEXT,
  context TEXT,           -- redacted snippet
  ai TEXT                 -- JSON from Gemini
);
INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (1, 'public@reaper', 'nopass');
`);
export default db;
