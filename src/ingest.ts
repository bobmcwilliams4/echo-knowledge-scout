// Echo Knowledge Scout — Ingestion Pipeline
// Takes scored discoveries and pushes to Shared Brain, Knowledge Forge, OmniSync

import type { Env, Discovery, IngestResult } from './types';

// ============================================================================
// INGEST TO SHARED BRAIN
// ============================================================================

async function ingestToSharedBrain(discovery: Discovery, env: Env): Promise<boolean> {
  const content = [
    `KNOWLEDGE SCOUT DISCOVERY [${discovery.source.toUpperCase()}]:`,
    `Title: ${discovery.title}`,
    `Category: ${discovery.category}`,
    `Relevance: ${(discovery.relevance_score * 100).toFixed(0)}%`,
    `URL: ${discovery.source_url}`,
    `Summary: ${discovery.summary}`,
    `Tags: ${discovery.tags.join(', ')}`,
  ].join('\n');

  const importance = discovery.relevance_score >= 0.7 ? 8 :
                     discovery.relevance_score >= 0.5 ? 7 :
                     discovery.relevance_score >= 0.3 ? 6 : 5;

  const body = JSON.stringify({
    instance_id: 'echo_knowledge_scout_worker',
    role: 'system',
    content,
    importance,
    tags: ['knowledge_scout', discovery.source, discovery.category, ...discovery.tags.slice(0, 5)],
  });

  try {
    // Prefer service binding (faster, no cold start)
    const resp = env.SHARED_BRAIN_SVC
      ? await env.SHARED_BRAIN_SVC.fetch('https://echo-shared-brain.bmcii1976.workers.dev/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      : await fetch(`${env.SHARED_BRAIN_URL}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });

    return resp.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// INGEST TO KNOWLEDGE FORGE
// ============================================================================

async function ingestToKnowledgeForge(discovery: Discovery, env: Env): Promise<boolean> {
  const doc = {
    title: discovery.title,
    content: discovery.summary,
    source: discovery.source,
    source_url: discovery.source_url,
    category: discovery.category,
    tags: discovery.tags,
    metadata: {
      relevance_score: discovery.relevance_score,
      discovered_at: discovery.discovered_at,
      raw_data: discovery.raw_data,
    },
  };

  try {
    const resp = env.KNOWLEDGE_FORGE_SVC
      ? await env.KNOWLEDGE_FORGE_SVC.fetch('https://echo-knowledge-forge.bmcii1976.workers.dev/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Echo-API-Key': env.ECHO_API_KEY || '',
          },
          body: JSON.stringify(doc),
        })
      : await fetch(`${env.KNOWLEDGE_FORGE_URL}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Echo-API-Key': env.ECHO_API_KEY || '',
          },
          body: JSON.stringify(doc),
        });

    return resp.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// INGEST TO OMNISYNC (for high-relevance items)
// ============================================================================

async function ingestToOmniSync(discovery: Discovery, env: Env): Promise<boolean> {
  // Only store high-relevance items as OmniSync memories
  if (discovery.relevance_score < 0.5) return true; // skip but don't mark as failure

  const memKey = `SCOUT_${discovery.source.toUpperCase()}_${discovery.category.toUpperCase()}_${Date.now()}`;
  const value = {
    title: discovery.title,
    url: discovery.source_url,
    category: discovery.category,
    relevance: discovery.relevance_score,
    summary: discovery.summary,
    tags: discovery.tags,
    discovered: discovery.discovered_at,
  };

  try {
    const resp = env.OMNISYNC_SVC
      ? await env.OMNISYNC_SVC.fetch('https://omniscient-sync.bmcii1976.workers.dev/memory/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: memKey, value }),
        })
      : await fetch(`${env.OMNISYNC_URL}/memory/store`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: memKey, value }),
        });

    return resp.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// FULL INGESTION PIPELINE
// ============================================================================

export async function ingestDiscovery(discovery: Discovery, env: Env): Promise<IngestResult> {
  const errors: string[] = [];

  // Parallel ingestion to all 3 targets
  const [brain, knowledge, omnisync] = await Promise.all([
    ingestToSharedBrain(discovery, env).catch(e => { errors.push(`brain: ${e}`); return false; }),
    ingestToKnowledgeForge(discovery, env).catch(e => { errors.push(`knowledge: ${e}`); return false; }),
    ingestToOmniSync(discovery, env).catch(e => { errors.push(`omnisync: ${e}`); return false; }),
  ]);

  return {
    discovery_id: discovery.id || 0,
    brain,
    knowledge,
    omnisync,
    errors,
  };
}

// ============================================================================
// BATCH INGESTION — process all new discoveries
// ============================================================================

export async function ingestBatch(discoveries: Discovery[], env: Env): Promise<{
  total: number;
  brain_ok: number;
  knowledge_ok: number;
  omnisync_ok: number;
  errors: string[];
}> {
  let brain_ok = 0, knowledge_ok = 0, omnisync_ok = 0;
  const errors: string[] = [];

  // Process in batches of 5 to avoid overwhelming downstream workers
  for (let i = 0; i < discoveries.length; i += 5) {
    const batch = discoveries.slice(i, i + 5);
    const results = await Promise.all(batch.map(d => ingestDiscovery(d, env)));

    for (const r of results) {
      if (r.brain) brain_ok++;
      if (r.knowledge) knowledge_ok++;
      if (r.omnisync) omnisync_ok++;
      errors.push(...r.errors);
    }

    // Brief pause between batches
    if (i + 5 < discoveries.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return {
    total: discoveries.length,
    brain_ok,
    knowledge_ok,
    omnisync_ok,
    errors,
  };
}

// ============================================================================
// BROADCAST DAILY SUMMARY
// ============================================================================

export async function broadcastDailySummary(
  scanResults: { source: string; count: number }[],
  topDiscoveries: Discovery[],
  env: Env
): Promise<void> {
  const totalDiscoveries = scanResults.reduce((sum, r) => sum + r.count, 0);

  const sourceSummary = scanResults
    .filter(r => r.count > 0)
    .map(r => `${r.source}: ${r.count}`)
    .join(', ');

  const topItems = topDiscoveries
    .slice(0, 5)
    .map((d, i) => `${i + 1}. [${d.category}] ${d.title} (${(d.relevance_score * 100).toFixed(0)}%)`)
    .join('\n');

  const message = [
    `KNOWLEDGE SCOUT DAILY REPORT`,
    `Found ${totalDiscoveries} new discoveries across ${scanResults.length} sources`,
    `Sources: ${sourceSummary}`,
    ``,
    `Top Discoveries:`,
    topItems,
  ].join('\n');

  // Broadcast to OmniSync
  try {
    const broadcastUrl = env.OMNISYNC_SVC
      ? 'https://omniscient-sync.bmcii1976.workers.dev/broadcasts'
      : `${env.OMNISYNC_URL}/broadcasts`;

    const fetcher = env.OMNISYNC_SVC || fetch;
    await (env.OMNISYNC_SVC
      ? env.OMNISYNC_SVC.fetch(broadcastUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, priority: 'normal', source: 'knowledge_scout' }),
        })
      : fetch(broadcastUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, priority: 'normal', source: 'knowledge_scout' }),
        })
    );
  } catch { /* non-critical */ }

  // Store summary in Shared Brain
  try {
    const body = JSON.stringify({
      instance_id: 'echo_knowledge_scout_worker',
      role: 'system',
      content: `DAILY SCOUT SUMMARY: ${message}`,
      importance: 7,
      tags: ['knowledge_scout', 'daily_summary'],
    });

    if (env.SHARED_BRAIN_SVC) {
      await env.SHARED_BRAIN_SVC.fetch('https://echo-shared-brain.bmcii1976.workers.dev/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } else {
      await fetch(`${env.SHARED_BRAIN_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    }
  } catch { /* non-critical */ }
}
