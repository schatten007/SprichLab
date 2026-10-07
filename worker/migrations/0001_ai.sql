CREATE TABLE IF NOT EXISTS ai_requests (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  transcript TEXT,
  response_json TEXT,
  error_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  retry_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_requests_expiry ON ai_requests(expires_at);
CREATE TABLE IF NOT EXISTS ai_counters (
  counter_key TEXT PRIMARY KEY,
  used INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_counters_expiry ON ai_counters(expires_at);
