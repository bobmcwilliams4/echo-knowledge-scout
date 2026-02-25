// Echo Knowledge Scout — Type Definitions

export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  SHARED_BRAIN_URL: string;
  MEMORY_PRIME_URL: string;
  KNOWLEDGE_FORGE_URL: string;
  OMNISYNC_URL: string;
  ECHO_API_KEY: string;
  GITHUB_TOKEN: string;
  ENVIRONMENT: string;
  // Service bindings
  SHARED_BRAIN_SVC: Fetcher;
  KNOWLEDGE_FORGE_SVC: Fetcher;
  OMNISYNC_SVC: Fetcher;
}

export interface Discovery {
  id?: number;
  source: SourceType;
  source_url: string;
  title: string;
  summary: string;
  category: CategoryType;
  relevance_score: number;
  tags: string[];
  raw_data: Record<string, unknown>;
  ingested_to_brain: boolean;
  ingested_to_knowledge: boolean;
  ingested_to_omnisync: boolean;
  discovered_at: string;
  ingested_at?: string;
  scan_run_id: string;
  duplicate_of?: number;
}

export type SourceType = 'github' | 'huggingface' | 'arxiv' | 'reddit' | 'rss' | 'hackernews' | 'producthunt';

export type CategoryType =
  | 'agent_framework'
  | 'model'
  | 'tool'
  | 'protocol'
  | 'library'
  | 'paper'
  | 'infrastructure'
  | 'mcp_server'
  | 'robotics'
  | 'memory_system'
  | 'vector_db'
  | 'workflow_engine'
  | 'browser_automation'
  | 'voice_ai'
  | 'security'
  | 'other';

export interface ScanRun {
  id?: number;
  run_id: string;
  trigger: 'cron' | 'manual' | 'api';
  started_at: string;
  completed_at?: string;
  sources_scanned: string[];
  discoveries_count: number;
  ingested_count: number;
  errors: string[];
  duration_ms?: number;
  status: 'running' | 'completed' | 'failed';
}

export interface SourceConfig {
  source: SourceType;
  enabled: boolean;
  search_queries: string[];
  last_scanned_at?: string;
  scan_interval_hours: number;
  max_results_per_scan: number;
  config: Record<string, unknown>;
}

export interface RawDiscovery {
  source: SourceType;
  source_url: string;
  title: string;
  description: string;
  category: CategoryType;
  tags: string[];
  raw_data: Record<string, unknown>;
  stars?: number;
  published_at?: string;
}

export interface ScanResult {
  source: SourceType;
  discoveries: RawDiscovery[];
  errors: string[];
  duration_ms: number;
}

export interface IngestResult {
  discovery_id: number;
  brain: boolean;
  knowledge: boolean;
  omnisync: boolean;
  errors: string[];
}
