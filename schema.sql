-- Echo Knowledge Scout — D1 Schema
-- Tracks all discovered knowledge, sources, ingestion status

CREATE TABLE IF NOT EXISTS discoveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,              -- github, huggingface, arxiv, reddit, rss, hackernews
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  category TEXT NOT NULL,            -- agent_framework, model, tool, protocol, library, paper, infrastructure
  relevance_score REAL NOT NULL,     -- 0.0-1.0, how relevant to Echo Prime
  tags TEXT DEFAULT '[]',            -- JSON array of tags
  raw_data TEXT DEFAULT '{}',        -- JSON raw source data
  ingested_to_brain INTEGER DEFAULT 0,
  ingested_to_knowledge INTEGER DEFAULT 0,
  ingested_to_omnisync INTEGER DEFAULT 0,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  ingested_at TEXT,
  scan_run_id TEXT NOT NULL,
  duplicate_of INTEGER,              -- FK to earlier discovery if duplicate
  UNIQUE(source, source_url)
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  trigger TEXT NOT NULL DEFAULT 'cron', -- cron, manual, api
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  sources_scanned TEXT DEFAULT '[]',    -- JSON array
  discoveries_count INTEGER DEFAULT 0,
  ingested_count INTEGER DEFAULT 0,
  errors TEXT DEFAULT '[]',            -- JSON array of error messages
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running' -- running, completed, failed
);

CREATE TABLE IF NOT EXISTS source_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  search_queries TEXT NOT NULL DEFAULT '[]',   -- JSON array of search terms
  last_scanned_at TEXT,
  scan_interval_hours INTEGER DEFAULT 24,
  max_results_per_scan INTEGER DEFAULT 50,
  config TEXT DEFAULT '{}'                     -- source-specific config JSON
);

CREATE TABLE IF NOT EXISTS integration_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discovery_id INTEGER NOT NULL,
  target TEXT NOT NULL,               -- shared_brain, knowledge_forge, omnisync
  status TEXT NOT NULL,               -- success, failed, skipped
  response TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (discovery_id) REFERENCES discoveries(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_discoveries_source ON discoveries(source);
CREATE INDEX IF NOT EXISTS idx_discoveries_category ON discoveries(category);
CREATE INDEX IF NOT EXISTS idx_discoveries_relevance ON discoveries(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_discoveries_scan_run ON discoveries(scan_run_id);
CREATE INDEX IF NOT EXISTS idx_discoveries_ingested ON discoveries(ingested_to_brain);
CREATE INDEX IF NOT EXISTS idx_scan_runs_status ON scan_runs(status);
CREATE INDEX IF NOT EXISTS idx_integration_log_discovery ON integration_log(discovery_id);
