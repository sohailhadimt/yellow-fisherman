CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'New',
  name TEXT, phone TEXT, method TEXT, postcode TEXT, slot TEXT, notes TEXT, items TEXT, total REAL, source TEXT
);
CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at DESC);
