// Echo Knowledge Scout — Source Scanners
// Each scanner searches one external source for new AI/tech knowledge

import type { RawDiscovery, ScanResult, SourceType, CategoryType, Env } from './types';

// ============================================================================
// RELEVANCE KEYWORDS — what matters to Echo Prime
// ============================================================================

const ECHO_RELEVANT_TOPICS = [
  // Agent frameworks & orchestration
  'autonomous agent', 'ai agent', 'multi-agent', 'agent framework', 'agent orchestration',
  'crew ai', 'crewai', 'langgraph', 'autogen', 'metagpt', 'openhands', 'opendevin',
  'claude agent', 'agent sdk', 'swarm', 'agentic', 'function calling', 'tool use',
  // MCP & protocols
  'model context protocol', 'mcp server', 'mcp tool', 'a2a protocol', 'agent protocol',
  'agent-to-agent', 'composio', 'toolhouse',
  // Memory & knowledge
  'agent memory', 'rag', 'graphrag', 'lightrag', 'vector database', 'knowledge graph',
  'mem0', 'letta', 'memgpt', 'zep memory', 'turbopuffer', 'lancedb',
  // Models & inference
  'open source llm', 'code model', 'coding agent', 'function calling model',
  'groq', 'cerebras', 'together ai', 'inference', 'quantization', 'gguf',
  // Infrastructure
  'cloudflare workers', 'durable objects', 'edge compute', 'serverless',
  'temporal', 'inngest', 'workflow orchestration', 'modal', 'replicate',
  // Browser & automation
  'browser automation', 'playwright', 'browser use', 'web agent', 'computer use',
  'screen automation', 'gui agent',
  // Voice & multimodal
  'text to speech', 'tts', 'voice clone', 'whisper', 'speech recognition',
  'multimodal', 'vision model', 'video understanding',
  // Robotics
  'humanoid robot', 'robotics framework', 'ros2', 'isaac', 'groot',
  // Security
  'ai security', 'prompt injection', 'red team', 'ai safety', 'guardrails',
  // Dev tools
  'ai coding', 'code generation', 'copilot', 'cursor', 'windsurf', 'cline',
  'claude code', 'devin', 'codex',
];

const SEARCH_QUERIES = [
  'autonomous AI agent framework 2026',
  'MCP model context protocol server',
  'multi-agent orchestration open source',
  'AI agent memory system',
  'LLM tool use function calling',
  'cloudflare workers AI',
  'browser automation AI agent',
  'voice AI text to speech open source',
  'agentic workflow orchestration',
  'AI coding agent autonomous',
];

// ============================================================================
// CATEGORY DETECTION
// ============================================================================

function detectCategory(title: string, desc: string, topics: string[] = []): CategoryType {
  const text = `${title} ${desc} ${topics.join(' ')}`.toLowerCase();
  if (/\bagent\s*(framework|sdk|orchestrat|platform)\b/.test(text)) return 'agent_framework';
  if (/\bmcp\s*(server|tool|protocol)\b/.test(text) || /model\s*context\s*protocol/.test(text)) return 'mcp_server';
  if (/\b(llm|language\s*model|transformer|gpt|claude|gemini|llama|qwen|mistral)\b/.test(text) && /\b(model|weights|checkpoint|fine.?tun)\b/.test(text)) return 'model';
  if (/\b(robot|humanoid|ros2?|isaac|groot|manipulation)\b/.test(text)) return 'robotics';
  if (/\b(memory|rag|retrieval|vector|knowledge\s*graph|graphrag|embedding)\b/.test(text)) return 'memory_system';
  if (/\b(vector\s*db|vectorize|pinecone|qdrant|weaviate|milvus|chroma|turbopuffer|lancedb)\b/.test(text)) return 'vector_db';
  if (/\b(workflow|orchestrat|temporal|inngest|pipeline|dag|cron)\b/.test(text)) return 'workflow_engine';
  if (/\b(browser|playwright|selenium|puppeteer|web\s*agent|computer\s*use)\b/.test(text)) return 'browser_automation';
  if (/\b(tts|stt|voice|speech|whisper|elevenlabs|audio\s*ai)\b/.test(text)) return 'voice_ai';
  if (/\b(security|pentest|red.?team|vulnerability|exploit|guardrail)\b/.test(text)) return 'security';
  if (/\b(protocol|spec|standard|rfc|a2a)\b/.test(text)) return 'protocol';
  if (/\b(infra|cloud|serverless|edge|deploy|container|docker)\b/.test(text)) return 'infrastructure';
  if (/\b(paper|arxiv|research|preprint|study)\b/.test(text)) return 'paper';
  if (/\b(library|package|sdk|npm|pip|crate)\b/.test(text)) return 'library';
  if (/\b(tool|utility|cli|helper)\b/.test(text)) return 'tool';
  return 'other';
}

// ============================================================================
// RELEVANCE SCORING
// ============================================================================

function scoreRelevance(title: string, desc: string, stars?: number, tags?: string[]): number {
  const text = `${title} ${desc} ${(tags || []).join(' ')}`.toLowerCase();
  let score = 0.1; // baseline

  // Keyword matches (up to 0.5)
  let keywordHits = 0;
  for (const topic of ECHO_RELEVANT_TOPICS) {
    if (text.includes(topic.toLowerCase())) {
      keywordHits++;
    }
  }
  score += Math.min(keywordHits * 0.05, 0.5);

  // Star bonus for GitHub/HF (up to 0.2)
  if (stars !== undefined) {
    if (stars > 10000) score += 0.2;
    else if (stars > 5000) score += 0.15;
    else if (stars > 1000) score += 0.1;
    else if (stars > 100) score += 0.05;
  }

  // Direct Echo relevance boost
  if (/\b(mcp|model\s*context\s*protocol)\b/.test(text)) score += 0.15;
  if (/\b(cloudflare|workers|durable\s*objects)\b/.test(text)) score += 0.1;
  if (/\b(agent\s*framework|multi.?agent)\b/.test(text)) score += 0.1;
  if (/\b(autonomous|self.?improv|self.?heal)\b/.test(text)) score += 0.1;

  return Math.min(score, 1.0);
}

// ============================================================================
// GITHUB SCANNER
// ============================================================================

async function scanGitHub(env: Env): Promise<ScanResult> {
  const start = Date.now();
  const discoveries: RawDiscovery[] = [];
  const errors: string[] = [];

  const queries = [
    'autonomous+agent+framework',
    'mcp+server+model+context+protocol',
    'multi+agent+orchestration',
    'ai+agent+memory',
    'llm+tool+use+function+calling',
    'browser+automation+ai+agent',
    'agentic+workflow',
  ];

  for (const q of queries) {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'EchoKnowledgeScout/1.0',
      };
      if (env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;
      }

      const resp = await fetch(
        `https://api.github.com/search/repositories?q=${q}+created:>=${getDateDaysAgo(7)}&sort=stars&order=desc&per_page=15`,
        { headers }
      );

      if (!resp.ok) {
        errors.push(`GitHub search "${q}": ${resp.status} ${resp.statusText}`);
        continue;
      }

      const data = await resp.json() as { items: Array<{
        full_name: string; html_url: string; description: string;
        stargazers_count: number; topics: string[]; language: string;
        created_at: string; updated_at: string;
      }> };

      for (const repo of (data.items || [])) {
        if (repo.stargazers_count < 10) continue; // skip noise
        const desc = repo.description || '';
        const relevance = scoreRelevance(repo.full_name, desc, repo.stargazers_count, repo.topics);
        if (relevance < 0.2) continue;

        discoveries.push({
          source: 'github',
          source_url: repo.html_url,
          title: repo.full_name,
          description: desc,
          category: detectCategory(repo.full_name, desc, repo.topics),
          tags: repo.topics || [],
          raw_data: {
            stars: repo.stargazers_count,
            language: repo.language,
            created: repo.created_at,
            updated: repo.updated_at,
            topics: repo.topics,
          },
          stars: repo.stargazers_count,
          published_at: repo.created_at,
        });
      }

      // Rate limit courtesy
      await sleep(500);
    } catch (e: unknown) {
      errors.push(`GitHub "${q}": ${(e as Error).message}`);
    }
  }

  // Also check GitHub trending via the events API
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'EchoKnowledgeScout/1.0',
    };
    if (env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;

    const resp = await fetch(
      'https://api.github.com/search/repositories?q=stars:>1000+pushed:>=' + getDateDaysAgo(3) + '+topic:ai-agent&sort=updated&per_page=20',
      { headers }
    );
    if (resp.ok) {
      const data = await resp.json() as { items: Array<{
        full_name: string; html_url: string; description: string;
        stargazers_count: number; topics: string[]; language: string;
        created_at: string; updated_at: string;
      }> };
      for (const repo of (data.items || [])) {
        const desc = repo.description || '';
        const relevance = scoreRelevance(repo.full_name, desc, repo.stargazers_count, repo.topics);
        if (relevance < 0.25) continue;
        if (discoveries.some(d => d.source_url === repo.html_url)) continue;
        discoveries.push({
          source: 'github',
          source_url: repo.html_url,
          title: repo.full_name,
          description: desc,
          category: detectCategory(repo.full_name, desc, repo.topics),
          tags: repo.topics || [],
          raw_data: { stars: repo.stargazers_count, language: repo.language, trending: true },
          stars: repo.stargazers_count,
        });
      }
    }
  } catch (e: unknown) {
    errors.push(`GitHub trending: ${(e as Error).message}`);
  }

  return { source: 'github', discoveries: dedup(discoveries), errors, duration_ms: Date.now() - start };
}

// ============================================================================
// HUGGING FACE SCANNER
// ============================================================================

async function scanHuggingFace(_env: Env): Promise<ScanResult> {
  const start = Date.now();
  const discoveries: RawDiscovery[] = [];
  const errors: string[] = [];

  // Search trending models
  const modelQueries = ['agent', 'function-calling', 'tool-use', 'code', 'tts', 'whisper', 'mcp'];
  for (const q of modelQueries) {
    try {
      const resp = await fetch(
        `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&sort=likes&direction=-1&limit=10`,
        { headers: { 'User-Agent': 'EchoKnowledgeScout/1.0' } }
      );
      if (!resp.ok) { errors.push(`HF models "${q}": ${resp.status}`); continue; }
      const models = await resp.json() as Array<{
        id: string; likes: number; downloads: number; tags: string[];
        pipeline_tag: string; lastModified: string;
      }>;

      for (const m of models) {
        const desc = `${m.pipeline_tag || ''} model with ${m.downloads || 0} downloads, ${m.likes || 0} likes. Tags: ${(m.tags || []).join(', ')}`;
        const relevance = scoreRelevance(m.id, desc, m.likes, m.tags);
        if (relevance < 0.2) continue;

        discoveries.push({
          source: 'huggingface',
          source_url: `https://huggingface.co/${m.id}`,
          title: m.id,
          description: desc,
          category: detectCategory(m.id, desc, m.tags),
          tags: m.tags || [],
          raw_data: { likes: m.likes, downloads: m.downloads, pipeline: m.pipeline_tag, lastModified: m.lastModified },
          stars: m.likes,
          published_at: m.lastModified,
        });
      }
      await sleep(300);
    } catch (e: unknown) {
      errors.push(`HF models "${q}": ${(e as Error).message}`);
    }
  }

  // Search trending spaces
  const spaceQueries = ['agent', 'mcp', 'autonomous', 'browser', 'voice'];
  for (const q of spaceQueries) {
    try {
      const resp = await fetch(
        `https://huggingface.co/api/spaces?search=${encodeURIComponent(q)}&sort=likes&direction=-1&limit=10`,
        { headers: { 'User-Agent': 'EchoKnowledgeScout/1.0' } }
      );
      if (!resp.ok) continue;
      const spaces = await resp.json() as Array<{
        id: string; likes: number; tags: string[]; lastModified: string;
      }>;

      for (const s of spaces) {
        const desc = `HuggingFace Space. ${s.likes || 0} likes. Tags: ${(s.tags || []).join(', ')}`;
        const relevance = scoreRelevance(s.id, desc, s.likes, s.tags);
        if (relevance < 0.2) continue;
        discoveries.push({
          source: 'huggingface',
          source_url: `https://huggingface.co/spaces/${s.id}`,
          title: `[Space] ${s.id}`,
          description: desc,
          category: detectCategory(s.id, desc, s.tags),
          tags: s.tags || [],
          raw_data: { likes: s.likes, type: 'space' },
          stars: s.likes,
        });
      }
      await sleep(300);
    } catch (e: unknown) {
      errors.push(`HF spaces "${q}": ${(e as Error).message}`);
    }
  }

  return { source: 'huggingface', discoveries: dedup(discoveries), errors, duration_ms: Date.now() - start };
}

// ============================================================================
// ARXIV SCANNER
// ============================================================================

async function scanArxiv(_env: Env): Promise<ScanResult> {
  const start = Date.now();
  const discoveries: RawDiscovery[] = [];
  const errors: string[] = [];

  const queries = [
    'all:autonomous+agent+AND+all:language+model',
    'all:multi-agent+AND+all:orchestration',
    'all:tool+use+AND+all:large+language+model',
    'all:agent+memory+AND+all:retrieval',
    'all:self-improving+AND+all:artificial+intelligence',
    'all:model+context+protocol',
  ];

  for (const q of queries) {
    try {
      const resp = await fetch(
        `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=10`,
        { headers: { 'User-Agent': 'EchoKnowledgeScout/1.0' } }
      );
      if (!resp.ok) { errors.push(`ArXiv "${q}": ${resp.status}`); continue; }
      const xml = await resp.text();

      // Parse Atom XML entries
      const entries = xml.split('<entry>').slice(1);
      for (const entry of entries) {
        const title = extractXmlTag(entry, 'title').replace(/\s+/g, ' ').trim();
        const summary = extractXmlTag(entry, 'summary').replace(/\s+/g, ' ').trim().slice(0, 500);
        const id = extractXmlTag(entry, 'id');
        const published = extractXmlTag(entry, 'published');

        // Extract categories
        const catMatches = entry.match(/category term="([^"]+)"/g) || [];
        const cats = catMatches.map(m => m.match(/term="([^"]+)"/)?.[1] || '');

        const relevance = scoreRelevance(title, summary, undefined, cats);
        if (relevance < 0.25) continue;

        discoveries.push({
          source: 'arxiv',
          source_url: id.replace('http://', 'https://'),
          title,
          description: summary,
          category: 'paper',
          tags: cats,
          raw_data: { published, categories: cats },
          published_at: published,
        });
      }
      await sleep(1000); // ArXiv rate limit: 1 req/sec
    } catch (e: unknown) {
      errors.push(`ArXiv "${q}": ${(e as Error).message}`);
    }
  }

  return { source: 'arxiv', discoveries: dedup(discoveries), errors, duration_ms: Date.now() - start };
}

// ============================================================================
// REDDIT SCANNER (via old.reddit.com JSON)
// ============================================================================

async function scanReddit(_env: Env): Promise<ScanResult> {
  const start = Date.now();
  const discoveries: RawDiscovery[] = [];
  const errors: string[] = [];

  const subreddits = [
    'MachineLearning', 'artificial', 'LocalLLaMA', 'ClaudeAI',
    'AutoGPT', 'LangChain', 'ChatGPTPro', 'singularity',
  ];

  for (const sub of subreddits) {
    try {
      const resp = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=25`,
        { headers: { 'User-Agent': 'EchoKnowledgeScout/1.0 (by /u/echo_prime_bot)' } }
      );
      if (!resp.ok) { errors.push(`Reddit r/${sub}: ${resp.status}`); continue; }
      const data = await resp.json() as {
        data: { children: Array<{ data: {
          title: string; selftext: string; url: string; permalink: string;
          score: number; num_comments: number; created_utc: number;
          link_flair_text: string; subreddit: string;
        } }> }
      };

      for (const post of (data.data?.children || [])) {
        const p = post.data;
        // Only posts from last 7 days with meaningful engagement
        const ageHours = (Date.now() / 1000 - p.created_utc) / 3600;
        if (ageHours > 168) continue; // older than 7 days
        if (p.score < 50) continue; // low engagement

        const desc = p.selftext?.slice(0, 500) || p.title;
        const relevance = scoreRelevance(p.title, desc, p.score);
        if (relevance < 0.2) continue;

        discoveries.push({
          source: 'reddit',
          source_url: `https://reddit.com${p.permalink}`,
          title: `[r/${p.subreddit}] ${p.title}`,
          description: desc,
          category: detectCategory(p.title, desc),
          tags: [p.subreddit, p.link_flair_text || ''].filter(Boolean),
          raw_data: {
            score: p.score, comments: p.num_comments,
            subreddit: p.subreddit, flair: p.link_flair_text,
            external_url: p.url !== `https://reddit.com${p.permalink}` ? p.url : undefined,
          },
          stars: p.score,
          published_at: new Date(p.created_utc * 1000).toISOString(),
        });
      }
      await sleep(1000); // Reddit rate limit
    } catch (e: unknown) {
      errors.push(`Reddit r/${sub}: ${(e as Error).message}`);
    }
  }

  return { source: 'reddit', discoveries: dedup(discoveries), errors, duration_ms: Date.now() - start };
}

// ============================================================================
// HACKER NEWS SCANNER
// ============================================================================

async function scanHackerNews(_env: Env): Promise<ScanResult> {
  const start = Date.now();
  const discoveries: RawDiscovery[] = [];
  const errors: string[] = [];

  try {
    // Get top and best stories
    for (const feed of ['topstories', 'beststories']) {
      const resp = await fetch(`https://hacker-news.firebaseio.com/v0/${feed}.json`);
      if (!resp.ok) { errors.push(`HN ${feed}: ${resp.status}`); continue; }
      const ids = (await resp.json() as number[]).slice(0, 50);

      // Fetch stories in batches of 10
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const stories = await Promise.all(
          batch.map(async (id) => {
            const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            return r.ok ? r.json() as Promise<{
              title: string; url: string; score: number; by: string;
              time: number; descendants: number; id: number;
            }> : null;
          })
        );

        for (const story of stories) {
          if (!story || !story.title) continue;
          if (story.score < 50) continue;

          const relevance = scoreRelevance(story.title, story.url || '', story.score);
          if (relevance < 0.2) continue;

          discoveries.push({
            source: 'hackernews',
            source_url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            title: story.title,
            description: `HN score: ${story.score}, ${story.descendants || 0} comments. By: ${story.by}`,
            category: detectCategory(story.title, story.url || ''),
            tags: ['hackernews'],
            raw_data: { score: story.score, comments: story.descendants, by: story.by, hn_id: story.id },
            stars: story.score,
            published_at: new Date(story.time * 1000).toISOString(),
          });
        }
        await sleep(200);
      }
    }
  } catch (e: unknown) {
    errors.push(`HN: ${(e as Error).message}`);
  }

  return { source: 'hackernews', discoveries: dedup(discoveries), errors, duration_ms: Date.now() - start };
}

// ============================================================================
// RSS FEED SCANNER (tech blogs, AI news)
// ============================================================================

async function scanRSS(_env: Env): Promise<ScanResult> {
  const start = Date.now();
  const discoveries: RawDiscovery[] = [];
  const errors: string[] = [];

  const feeds = [
    { url: 'https://blog.cloudflare.com/rss/', name: 'Cloudflare Blog' },
    { url: 'https://openai.com/blog/rss.xml', name: 'OpenAI Blog' },
    { url: 'https://blog.google/rss/', name: 'Google Blog' },
    { url: 'https://huggingface.co/blog/feed.xml', name: 'Hugging Face Blog' },
    { url: 'https://blog.langchain.dev/rss', name: 'LangChain Blog' },
    { url: 'https://www.latent.space/feed', name: 'Latent Space' },
    { url: 'https://simonwillison.net/atom/everything/', name: 'Simon Willison' },
    { url: 'https://lilianweng.github.io/index.xml', name: 'Lilian Weng (OpenAI)' },
  ];

  for (const feed of feeds) {
    try {
      const resp = await fetch(feed.url, {
        headers: { 'User-Agent': 'EchoKnowledgeScout/1.0' },
      });
      if (!resp.ok) { errors.push(`RSS ${feed.name}: ${resp.status}`); continue; }
      const xml = await resp.text();

      // Parse RSS items (handles both RSS 2.0 and Atom)
      const items = xml.includes('<entry>') ? xml.split('<entry>').slice(1) : xml.split('<item>').slice(1);

      for (const item of items.slice(0, 10)) {
        const title = extractXmlTag(item, 'title');
        const link = item.includes('<link href=') ?
          (item.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '' :
          extractXmlTag(item, 'link');
        const desc = extractXmlTag(item, 'description') || extractXmlTag(item, 'summary') || '';
        const pubDate = extractXmlTag(item, 'pubDate') || extractXmlTag(item, 'published') || extractXmlTag(item, 'updated') || '';

        if (!title || !link) continue;

        // Only last 7 days
        if (pubDate) {
          const age = Date.now() - new Date(pubDate).getTime();
          if (age > 7 * 24 * 3600 * 1000) continue;
        }

        const cleanDesc = desc.replace(/<[^>]+>/g, '').slice(0, 500);
        const relevance = scoreRelevance(title, cleanDesc);
        if (relevance < 0.15) continue;

        discoveries.push({
          source: 'rss',
          source_url: link,
          title: `[${feed.name}] ${title}`,
          description: cleanDesc,
          category: detectCategory(title, cleanDesc),
          tags: [feed.name.toLowerCase().replace(/\s+/g, '-')],
          raw_data: { feed_name: feed.name, feed_url: feed.url, pub_date: pubDate },
          published_at: pubDate,
        });
      }
      await sleep(300);
    } catch (e: unknown) {
      errors.push(`RSS ${feed.name}: ${(e as Error).message}`);
    }
  }

  return { source: 'rss', discoveries: dedup(discoveries), errors, duration_ms: Date.now() - start };
}

// ============================================================================
// PRODUCT HUNT SCANNER (new AI launches)
// ============================================================================

async function scanProductHunt(_env: Env): Promise<ScanResult> {
  const start = Date.now();
  const discoveries: RawDiscovery[] = [];
  const errors: string[] = [];

  try {
    // Use the public feed
    const resp = await fetch(
      'https://www.producthunt.com/feed?category=artificial-intelligence',
      { headers: { 'User-Agent': 'EchoKnowledgeScout/1.0' } }
    );
    if (resp.ok) {
      const xml = await resp.text();
      const items = xml.split('<item>').slice(1);

      for (const item of items.slice(0, 20)) {
        const title = extractXmlTag(item, 'title');
        const link = extractXmlTag(item, 'link');
        const desc = extractXmlTag(item, 'description').replace(/<[^>]+>/g, '').slice(0, 500);
        const pubDate = extractXmlTag(item, 'pubDate');

        if (!title || !link) continue;

        const relevance = scoreRelevance(title, desc);
        if (relevance < 0.2) continue;

        discoveries.push({
          source: 'producthunt',
          source_url: link,
          title: `[ProductHunt] ${title}`,
          description: desc,
          category: detectCategory(title, desc),
          tags: ['producthunt', 'launch'],
          raw_data: { pub_date: pubDate },
          published_at: pubDate,
        });
      }
    }
  } catch (e: unknown) {
    errors.push(`ProductHunt: ${(e as Error).message}`);
  }

  return { source: 'producthunt', discoveries: dedup(discoveries), errors, duration_ms: Date.now() - start };
}

// ============================================================================
// ORCHESTRATOR — Runs all scanners
// ============================================================================

export async function runAllScanners(env: Env): Promise<ScanResult[]> {
  // Run scanners in parallel batches to respect rate limits
  const batch1 = await Promise.all([
    scanGitHub(env),
    scanHuggingFace(env),
    scanArxiv(env),
  ]);

  const batch2 = await Promise.all([
    scanReddit(env),
    scanHackerNews(env),
    scanRSS(env),
    scanProductHunt(env),
  ]);

  return [...batch1, ...batch2];
}

export async function runSingleScanner(source: SourceType, env: Env): Promise<ScanResult> {
  switch (source) {
    case 'github': return scanGitHub(env);
    case 'huggingface': return scanHuggingFace(env);
    case 'arxiv': return scanArxiv(env);
    case 'reddit': return scanReddit(env);
    case 'hackernews': return scanHackerNews(env);
    case 'rss': return scanRSS(env);
    case 'producthunt': return scanProductHunt(env);
    default: return { source, discoveries: [], errors: [`Unknown source: ${source}`], duration_ms: 0 };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function extractXmlTag(xml: string, tag: string): string {
  // Handle CDATA
  const cdataPattern = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = xml.match(cdataPattern);
  if (cdataMatch) return cdataMatch[1].trim();

  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1].trim() : '';
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dedup(discoveries: RawDiscovery[]): RawDiscovery[] {
  const seen = new Set<string>();
  return discoveries.filter(d => {
    if (seen.has(d.source_url)) return false;
    seen.add(d.source_url);
    return true;
  });
}
