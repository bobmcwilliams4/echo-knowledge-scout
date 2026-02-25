// Echo Knowledge Scout v1.0.0
// Daily autonomous knowledge search — scans GitHub, HuggingFace, ArXiv,
// Reddit, Hacker News, RSS feeds, Product Hunt for new AI/tech to integrate
// into Echo Omega Prime. Ingests into Shared Brain + Knowledge Forge + OmniSync.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Discovery, ScanRun, SourceType } from './types';
import { runAllScanners, runSingleScanner } from './sources';
import { ingestBatch, broadcastDailySummary } from './ingest';

type HonoEnv = { Bindings: Env };
const app = new Hono<HonoEnv>();

app.use('*', cors());

// ============================================================================
// HEALTH / STATUS
// ============================================================================

app.get('/', (c) => {
  return c.json({
    name: 'Echo Knowledge Scout',
    version: '1.0.0',
    status: 'operational',
    description: 'Daily autonomous knowledge search for Echo Omega Prime',
    sources: ['github', 'huggingface', 'arxiv', 'reddit', 'hackernews', 'rss', 'producthunt'],
    endpoints: {
      'GET /': 'This status page',
      'GET /health': 'Health check',
      'GET /discoveries': 'List discoveries (query: ?source=&category=&min_relevance=&limit=&offset=)',
      'GET /discoveries/:id': 'Get single discovery',
      'GET /runs': 'List scan runs',
      'GET /runs/:id': 'Get scan run details',
      'GET /stats': 'Statistics and metrics',
      'GET /sources': 'Source configuration',
      'POST /scan': 'Trigger manual scan (body: { sources?: string[] })',
      'POST /scan/:source': 'Trigger single source scan',
      'POST /ingest/:id': 'Re-ingest a specific discovery',
      'POST /ingest/pending': 'Ingest all pending discoveries',
    },
    cron: '0 6 * * * (daily at 6am UTC)',
  });
});

app.get('/health', async (c) => {
  const env = c.env;
  let dbOk = false;
  try {
    const r = await env.DB.prepare('SELECT COUNT(*) as cnt FROM discoveries').first<{ cnt: number }>();
    dbOk = r !== null;
  } catch { /* */ }

  return c.json({
    status: dbOk ? 'healthy' : 'degraded',
    db: dbOk,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// DISCOVERIES — Browse what the scout has found
// ============================================================================

app.get('/discoveries', async (c) => {
  const env = c.env;
  const source = c.req.query('source');
  const category = c.req.query('category');
  const minRelevance = parseFloat(c.req.query('min_relevance') || '0');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = parseInt(c.req.query('offset') || '0');
  const ingested = c.req.query('ingested'); // 'true' or 'false'
  const days = parseInt(c.req.query('days') || '30');

  let sql = 'SELECT * FROM discoveries WHERE relevance_score >= ?';
  const params: (string | number)[] = [minRelevance];

  if (source) { sql += ' AND source = ?'; params.push(source); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (ingested === 'true') { sql += ' AND ingested_to_brain = 1'; }
  if (ingested === 'false') { sql += ' AND ingested_to_brain = 0'; }
  if (days > 0) { sql += ` AND discovered_at >= datetime('now', '-${days} days')`; }

  sql += ' ORDER BY relevance_score DESC, discovered_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const results = await env.DB.prepare(sql).bind(...params).all();

  // Parse JSON fields
  const discoveries = (results.results || []).map(row => ({
    ...row,
    tags: safeJsonParse(row.tags as string, []),
    raw_data: safeJsonParse(row.raw_data as string, {}),
  }));

  return c.json({
    count: discoveries.length,
    offset,
    limit,
    discoveries,
  });
});

app.get('/discoveries/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const row = await c.env.DB.prepare('SELECT * FROM discoveries WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({
    ...row,
    tags: safeJsonParse(row.tags as string, []),
    raw_data: safeJsonParse(row.raw_data as string, {}),
  });
});

// ============================================================================
// SCAN RUNS — History of scout operations
// ============================================================================

app.get('/runs', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const results = await c.env.DB.prepare(
    'SELECT * FROM scan_runs ORDER BY started_at DESC LIMIT ?'
  ).bind(limit).all();

  return c.json({
    count: results.results?.length || 0,
    runs: (results.results || []).map(r => ({
      ...r,
      sources_scanned: safeJsonParse(r.sources_scanned as string, []),
      errors: safeJsonParse(r.errors as string, []),
    })),
  });
});

app.get('/runs/:id', async (c) => {
  const runId = c.req.param('id');
  const run = await c.env.DB.prepare('SELECT * FROM scan_runs WHERE run_id = ?').bind(runId).first();
  if (!run) return c.json({ error: 'Not found' }, 404);

  const discoveries = await c.env.DB.prepare(
    'SELECT id, source, title, category, relevance_score, ingested_to_brain FROM discoveries WHERE scan_run_id = ? ORDER BY relevance_score DESC'
  ).bind(runId).all();

  return c.json({
    ...run,
    sources_scanned: safeJsonParse(run.sources_scanned as string, []),
    errors: safeJsonParse(run.errors as string, []),
    discoveries: discoveries.results || [],
  });
});

// ============================================================================
// STATS — Metrics and overview
// ============================================================================

app.get('/stats', async (c) => {
  const env = c.env;

  const [total, bySource, byCategory, recentRuns, topDiscoveries, ingestStats] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as cnt FROM discoveries').first<{ cnt: number }>(),
    env.DB.prepare('SELECT source, COUNT(*) as cnt FROM discoveries GROUP BY source ORDER BY cnt DESC').all(),
    env.DB.prepare('SELECT category, COUNT(*) as cnt FROM discoveries GROUP BY category ORDER BY cnt DESC').all(),
    env.DB.prepare('SELECT COUNT(*) as cnt FROM scan_runs WHERE status = "completed"').first<{ cnt: number }>(),
    env.DB.prepare('SELECT id, title, source, category, relevance_score FROM discoveries ORDER BY relevance_score DESC LIMIT 10').all(),
    env.DB.prepare(`
      SELECT
        SUM(ingested_to_brain) as brain,
        SUM(ingested_to_knowledge) as knowledge,
        SUM(ingested_to_omnisync) as omnisync,
        COUNT(*) as total
      FROM discoveries
    `).first<{ brain: number; knowledge: number; omnisync: number; total: number }>(),
  ]);

  return c.json({
    total_discoveries: total?.cnt || 0,
    total_scan_runs: recentRuns?.cnt || 0,
    by_source: bySource.results || [],
    by_category: byCategory.results || [],
    ingestion: {
      brain: ingestStats?.brain || 0,
      knowledge: ingestStats?.knowledge || 0,
      omnisync: ingestStats?.omnisync || 0,
      total: ingestStats?.total || 0,
    },
    top_discoveries: topDiscoveries.results || [],
  });
});

// ============================================================================
// SOURCES — View and configure source scanners
// ============================================================================

app.get('/sources', async (c) => {
  const results = await c.env.DB.prepare('SELECT * FROM source_configs ORDER BY source').all();
  return c.json({
    sources: (results.results || []).map(r => ({
      ...r,
      search_queries: safeJsonParse(r.search_queries as string, []),
      config: safeJsonParse(r.config as string, {}),
    })),
  });
});

// ============================================================================
// MANUAL SCAN — Trigger on-demand
// ============================================================================

app.post('/scan', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { sources?: string[] };
  const env = c.env;

  // Start scan run
  const runId = `manual_${Date.now()}`;
  const startTime = Date.now();

  await env.DB.prepare(
    'INSERT INTO scan_runs (run_id, trigger, status) VALUES (?, ?, ?)'
  ).bind(runId, 'manual', 'running').run();

  try {
    const scanResults = body.sources && body.sources.length > 0
      ? await Promise.all(body.sources.map(s => runSingleScanner(s as SourceType, env)))
      : await runAllScanners(env);

    const result = await processScanResults(scanResults, runId, env);
    return c.json(result);
  } catch (e: unknown) {
    await env.DB.prepare(
      'UPDATE scan_runs SET status = ?, completed_at = datetime("now"), errors = ? WHERE run_id = ?'
    ).bind('failed', JSON.stringify([(e as Error).message]), runId).run();
    return c.json({ error: (e as Error).message }, 500);
  }
});

app.post('/scan/:source', async (c) => {
  const source = c.req.param('source') as SourceType;
  const env = c.env;

  const runId = `manual_${source}_${Date.now()}`;
  await env.DB.prepare(
    'INSERT INTO scan_runs (run_id, trigger, status) VALUES (?, ?, ?)'
  ).bind(runId, 'manual', 'running').run();

  try {
    const scanResult = await runSingleScanner(source, env);
    const result = await processScanResults([scanResult], runId, env);
    return c.json(result);
  } catch (e: unknown) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ============================================================================
// RE-INGEST — Push existing discoveries to brain/knowledge
// ============================================================================

// IMPORTANT: /ingest/pending MUST come before /ingest/:id to avoid route collision
app.post('/ingest/pending', async (c) => {
  const env = c.env;
  const rows = await env.DB.prepare(
    'SELECT * FROM discoveries WHERE ingested_to_brain = 0 ORDER BY relevance_score DESC LIMIT 100'
  ).all();

  if (!rows.results || rows.results.length === 0) {
    return c.json({ message: 'No pending discoveries to ingest', total: 0 });
  }

  const discoveries: Discovery[] = (rows.results || []).map(row => ({
    id: row.id as number,
    source: row.source as SourceType,
    source_url: row.source_url as string,
    title: row.title as string,
    summary: row.summary as string,
    category: row.category as string as any,
    relevance_score: row.relevance_score as number,
    tags: safeJsonParse(row.tags as string, []),
    raw_data: safeJsonParse(row.raw_data as string, {}),
    ingested_to_brain: false,
    ingested_to_knowledge: false,
    ingested_to_omnisync: false,
    discovered_at: row.discovered_at as string,
    scan_run_id: row.scan_run_id as string,
  }));

  const result = await ingestBatch(discoveries, env);

  // Batch update DB
  for (const d of discoveries) {
    await env.DB.prepare(`
      UPDATE discoveries SET ingested_to_brain = 1, ingested_at = datetime('now') WHERE id = ?
    `).bind(d.id).run();
  }

  return c.json(result);
});

app.post('/ingest/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const env = c.env;

  const row = await env.DB.prepare('SELECT * FROM discoveries WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);

  const discovery: Discovery = {
    id: row.id as number,
    source: row.source as SourceType,
    source_url: row.source_url as string,
    title: row.title as string,
    summary: row.summary as string,
    category: row.category as string as any,
    relevance_score: row.relevance_score as number,
    tags: safeJsonParse(row.tags as string, []),
    raw_data: safeJsonParse(row.raw_data as string, {}),
    ingested_to_brain: false,
    ingested_to_knowledge: false,
    ingested_to_omnisync: false,
    discovered_at: row.discovered_at as string,
    scan_run_id: row.scan_run_id as string,
  };

  const result = await ingestBatch([discovery], env);

  // Update DB
  await env.DB.prepare(`
    UPDATE discoveries SET
      ingested_to_brain = ?,
      ingested_to_knowledge = ?,
      ingested_to_omnisync = ?,
      ingested_at = datetime('now')
    WHERE id = ?
  `).bind(
    result.brain_ok > 0 ? 1 : 0,
    result.knowledge_ok > 0 ? 1 : 0,
    result.omnisync_ok > 0 ? 1 : 0,
    id
  ).run();

  return c.json(result);
});

// ============================================================================
// SCAN RESULT PROCESSOR — shared between cron and manual triggers
// ============================================================================

async function processScanResults(
  scanResults: Awaited<ReturnType<typeof runAllScanners>>,
  runId: string,
  env: Env
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  const allErrors: string[] = [];
  let totalDiscoveries = 0;
  let newDiscoveries = 0;
  const newDiscoveryObjects: Discovery[] = [];
  const sourceCounts: { source: string; count: number }[] = [];

  for (const result of scanResults) {
    allErrors.push(...result.errors);
    totalDiscoveries += result.discoveries.length;

    let sourceNew = 0;
    for (const raw of result.discoveries) {
      // Deduplicate against DB
      const existing = await env.DB.prepare(
        'SELECT id FROM discoveries WHERE source = ? AND source_url = ?'
      ).bind(raw.source, raw.source_url).first();

      if (existing) continue;

      const relevance = scoreRelevanceFromRaw(raw);

      // Insert into D1
      const insertResult = await env.DB.prepare(`
        INSERT INTO discoveries (source, source_url, title, summary, category, relevance_score, tags, raw_data, scan_run_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        raw.source,
        raw.source_url,
        raw.title,
        raw.description,
        raw.category,
        relevance,
        JSON.stringify(raw.tags),
        JSON.stringify(raw.raw_data),
        runId
      ).run();

      if (insertResult.success) {
        newDiscoveries++;
        sourceNew++;
        newDiscoveryObjects.push({
          id: insertResult.meta?.last_row_id as number,
          source: raw.source,
          source_url: raw.source_url,
          title: raw.title,
          summary: raw.description,
          category: raw.category,
          relevance_score: relevance,
          tags: raw.tags,
          raw_data: raw.raw_data,
          ingested_to_brain: false,
          ingested_to_knowledge: false,
          ingested_to_omnisync: false,
          discovered_at: new Date().toISOString(),
          scan_run_id: runId,
        });
      }
    }

    sourceCounts.push({ source: result.source, count: sourceNew });

    // Update source last_scanned_at
    await env.DB.prepare(
      'UPDATE source_configs SET last_scanned_at = datetime("now") WHERE source = ?'
    ).bind(result.source).run();
  }

  // Ingest high-relevance discoveries
  const highRelevance = newDiscoveryObjects
    .filter(d => d.relevance_score >= 0.15)
    .sort((a, b) => b.relevance_score - a.relevance_score);

  let ingestResult = { total: 0, brain_ok: 0, knowledge_ok: 0, omnisync_ok: 0, errors: [] as string[] };
  if (highRelevance.length > 0) {
    ingestResult = await ingestBatch(highRelevance, env);

    // Update ingestion status in DB
    for (const d of highRelevance) {
      await env.DB.prepare(`
        UPDATE discoveries SET
          ingested_to_brain = 1,
          ingested_to_knowledge = 1,
          ingested_to_omnisync = CASE WHEN relevance_score >= 0.5 THEN 1 ELSE 0 END,
          ingested_at = datetime('now')
        WHERE id = ?
      `).bind(d.id).run();
    }
  }

  const duration = Date.now() - startTime;

  // Update scan run record
  await env.DB.prepare(`
    UPDATE scan_runs SET
      status = 'completed',
      completed_at = datetime('now'),
      sources_scanned = ?,
      discoveries_count = ?,
      ingested_count = ?,
      errors = ?,
      duration_ms = ?
    WHERE run_id = ?
  `).bind(
    JSON.stringify(scanResults.map(r => r.source)),
    newDiscoveries,
    ingestResult.brain_ok,
    JSON.stringify(allErrors.slice(0, 50)),
    duration,
    runId
  ).run();

  // Broadcast daily summary
  await broadcastDailySummary(sourceCounts, highRelevance, env);

  return {
    run_id: runId,
    status: 'completed',
    total_found: totalDiscoveries,
    new_discoveries: newDiscoveries,
    duplicates_skipped: totalDiscoveries - newDiscoveries,
    ingested: {
      attempted: highRelevance.length,
      brain: ingestResult.brain_ok,
      knowledge: ingestResult.knowledge_ok,
      omnisync: ingestResult.omnisync_ok,
    },
    sources: sourceCounts,
    errors: allErrors.length,
    error_details: allErrors.slice(0, 20),
    duration_ms: duration,
  };
}

// ============================================================================
// CRON HANDLER — runs daily at 6am UTC
// ============================================================================

async function handleCron(env: Env): Promise<void> {
  const runId = `cron_${Date.now()}`;

  await env.DB.prepare(
    'INSERT INTO scan_runs (run_id, trigger, status) VALUES (?, ?, ?)'
  ).bind(runId, 'cron', 'running').run();

  try {
    const scanResults = await runAllScanners(env);
    await processScanResults(scanResults, runId, env);
  } catch (e: unknown) {
    await env.DB.prepare(
      'UPDATE scan_runs SET status = ?, completed_at = datetime("now"), errors = ? WHERE run_id = ?'
    ).bind('failed', JSON.stringify([(e as Error).message]), runId).run();
    console.error('Cron scan failed:', (e as Error).message);
  }
}

// ============================================================================
// UTILITY
// ============================================================================

function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function scoreRelevanceFromRaw(raw: { title: string; description: string; stars?: number; tags?: string[] }): number {
  const text = `${raw.title} ${raw.description} ${(raw.tags || []).join(' ')}`.toLowerCase();
  let score = 0.1;

  const TOPICS = [
    'autonomous agent', 'ai agent', 'multi-agent', 'agent framework', 'mcp',
    'model context protocol', 'cloudflare', 'workers', 'llm', 'tool use',
    'function calling', 'rag', 'vector', 'memory', 'browser automation',
    'tts', 'voice', 'robotics', 'workflow', 'orchestration', 'self-improving',
  ];

  let hits = 0;
  for (const t of TOPICS) { if (text.includes(t)) hits++; }
  score += Math.min(hits * 0.06, 0.5);

  if (raw.stars) {
    if (raw.stars > 10000) score += 0.2;
    else if (raw.stars > 1000) score += 0.1;
    else if (raw.stars > 100) score += 0.05;
  }

  if (/\bmcp\b/.test(text)) score += 0.15;
  if (/cloudflare|workers/.test(text)) score += 0.1;
  if (/agent.?framework|multi.?agent/.test(text)) score += 0.1;

  return Math.min(score, 1.0);
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(env));
  },
};
