<h1 align="center">Echo Knowledge Scout</h1>

<p align="center">
  <strong>Autonomous daily intelligence scanner -- searches 7 sources for new AI/tech developments, scores relevance, deduplicates, and ingests into the Echo knowledge ecosystem.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/D1-SQLite-003B57?logo=sqlite" alt="D1" />
  <img src="https://img.shields.io/badge/Cron-Daily_6am_UTC-green" alt="Cron" />
  <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version" />
</p>

---

## How It Works

Knowledge Scout runs as a Cloudflare Worker with a daily cron trigger (6am UTC / midnight CST). Each run:

```
1. SCAN    --> Query each source with AI/tech search terms
2. SCORE   --> Relevance scoring (0.0-1.0) based on keyword matching + engagement metrics
3. DEDUP   --> Check against D1 database to skip previously seen items
4. STORE   --> Insert new discoveries into D1 with full metadata
5. INGEST  --> Push high-relevance items to Shared Brain + Knowledge Forge + OmniSync
6. REPORT  --> Broadcast daily summary to all Echo instances
```

The scout can also be triggered manually via the API for on-demand scanning.

---

## 7 Sources

| Source | What Gets Scanned | Search Strategy |
|--------|------------------|-----------------|
| **GitHub** | New repositories, trending repos, topic searches | 7 keyword queries + trending AI-agent repos with 1000+ stars |
| **HuggingFace** | Models (7 queries) and Spaces (5 queries) | Searches for agent, function-calling, tool-use, code, TTS, MCP |
| **ArXiv** | Academic papers in AI/ML/NLP | 6 queries covering agents, multi-agent, tool use, memory, MCP |
| **Reddit** | Top posts from 8 subreddits | r/MachineLearning, r/LocalLLaMA, r/ClaudeAI, r/AutoGPT, and more |
| **Hacker News** | Top and best stories | Filters for AI/tech keyword relevance, 50+ score minimum |
| **RSS** | 8 curated tech blogs | Cloudflare, OpenAI, Google, Hugging Face, LangChain, Latent Space, Simon Willison, Lilian Weng |
| **Product Hunt** | New AI/developer tool launches | AI category feed, relevance-scored |

---

## Relevance Scoring

Every discovery gets a relevance score (0.0 to 1.0) based on:

- **Keyword matching** (up to 0.5) -- 60+ tracked topics including autonomous agents, MCP, multi-agent orchestration, RAG, voice AI, browser automation, and more
- **Engagement signals** (up to 0.2) -- GitHub stars, HuggingFace likes, Reddit score, HN points
- **Priority boosts** -- Extra weight for MCP-related (+0.15), Cloudflare/Workers (+0.1), agent frameworks (+0.1), self-improving systems (+0.1)

Items scoring 0.15+ are stored. Items scoring 0.15+ are ingested into downstream knowledge systems. Items scoring 0.5+ are also stored in OmniSync for cross-instance awareness.

---

## Ingestion Pipeline

High-relevance discoveries are automatically pushed to three downstream systems:

| Target | Condition | Purpose |
|--------|-----------|---------|
| **Shared Brain** | Score >= 0.15 | Cross-instance memory (all AI instances can find it) |
| **Knowledge Forge** | Score >= 0.15 | Document store with metadata (5,387+ docs) |
| **OmniSync** | Score >= 0.50 | Cross-instance plans/todos (high-priority items) |

Ingestion uses Cloudflare Service Bindings for fast, no-cold-start Worker-to-Worker communication.

---

## Category Detection

Each discovery is automatically categorized:

| Category | Pattern |
|----------|---------|
| `agent_framework` | Agent SDK, orchestration, agentic platforms |
| `mcp_server` | Model Context Protocol servers and tools |
| `model` | LLMs, transformers, fine-tuned checkpoints |
| `memory_system` | RAG, GraphRAG, vector DBs, knowledge graphs |
| `vector_db` | Pinecone, Qdrant, Weaviate, Milvus, ChromaDB |
| `workflow_engine` | Temporal, Inngest, pipeline DAGs |
| `browser_automation` | Playwright, Selenium, web agents, computer use |
| `voice_ai` | TTS, STT, voice cloning, audio AI |
| `robotics` | Humanoid robots, ROS2, Isaac, manipulation |
| `security` | AI security, red teaming, guardrails |
| `protocol` | Specs, standards, A2A, RFCs |
| `infrastructure` | Cloud, serverless, edge, containers |
| `paper` | Academic research papers |
| `library` | Packages, SDKs, npm/pip modules |
| `tool` | CLI tools, utilities, helpers |

---

## API Reference

### Discovery Browsing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/discoveries` | List discoveries with filters (`source`, `category`, `min_relevance`, `ingested`, `days`, `limit`, `offset`) |
| `GET` | `/discoveries/:id` | Get a single discovery with full metadata |

### Scan Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scan` | Trigger full scan across all 7 sources |
| `POST` | `/scan/:source` | Trigger scan for a specific source |

### Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ingest/pending` | Ingest all pending discoveries (up to 100) |
| `POST` | `/ingest/:id` | Re-ingest a specific discovery |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stats` | Total discoveries, per-source counts, per-category counts, ingestion stats, top discoveries |
| `GET` | `/runs` | List scan run history with timing and error counts |
| `GET` | `/runs/:id` | Scan run details with associated discoveries |
| `GET` | `/sources` | Source configurations and search queries |
| `GET` | `/health` | D1 connectivity and basic health check |
| `GET` | `/` | API documentation and source list |

---

## Infrastructure

### Cloudflare Bindings

| Type | Name | Resource |
|------|------|----------|
| **D1** | `DB` | `echo-knowledge-scout` -- discoveries, scan_runs, source_configs |
| **KV** | `CACHE` | Scan result caching |
| **Service** | `SHARED_BRAIN_SVC` | Shared Brain (memory ingestion) |
| **Service** | `KNOWLEDGE_FORGE_SVC` | Knowledge Forge (document ingestion) |
| **Service** | `OMNISYNC_SVC` | OmniSync (high-priority broadcasts) |

---

## Source Files

```
src/
  index.ts     # Hono app, 13 route handlers, cron handler, scan orchestrator (554 lines)
  sources.ts   # 7 source scanners with rate limiting and deduplication (688 lines)
  ingest.ts    # 3-target ingestion pipeline with batch processing (275 lines)
  types.ts     # Full TypeScript type definitions
```

**Total**: ~1,600 lines across 4 TypeScript files.

---

## Deployment

```bash
# Clone and install
git clone https://github.com/bobmcwilliams4/echo-knowledge-scout.git
cd echo-knowledge-scout
npm install

# Create D1 database
npx wrangler d1 create echo-knowledge-scout
# Update database_id in wrangler.toml

# Run schema and seed data
npx wrangler d1 execute echo-knowledge-scout --remote --file=schema.sql
npx wrangler d1 execute echo-knowledge-scout --remote --file=seed.sql

# Set secrets
echo "YOUR_TOKEN" | npx wrangler secret put GITHUB_TOKEN
echo "YOUR_KEY" | npx wrangler secret put ECHO_API_KEY

# Deploy
npx wrangler deploy
```

The cron trigger (`0 6 * * *`) activates automatically after deployment.

---

## Usage Examples

```bash
# Trigger a full scan
curl -X POST https://echo-knowledge-scout.bmcii1976.workers.dev/scan

# Scan only GitHub
curl -X POST https://echo-knowledge-scout.bmcii1976.workers.dev/scan/github

# Browse high-relevance agent framework discoveries
curl "https://echo-knowledge-scout.bmcii1976.workers.dev/discoveries?category=agent_framework&min_relevance=0.5"

# Check scan history
curl https://echo-knowledge-scout.bmcii1976.workers.dev/runs

# View statistics
curl https://echo-knowledge-scout.bmcii1976.workers.dev/stats

# Ingest all pending discoveries
curl -X POST https://echo-knowledge-scout.bmcii1976.workers.dev/ingest/pending
```

---

## Part of Echo Omega Prime

Knowledge Scout is the intelligence gathering layer of [Echo Omega Prime](https://github.com/bobmcwilliams4/Echo-Omega-Prime). It feeds new knowledge into the Shared Brain (cross-instance memory), Knowledge Forge (document store), and OmniSync (system-wide plans and todos).

It can also run standalone as a general-purpose AI/tech trend scanner.

---

## Author

**Bobby Don McWilliams II** -- AI Systems Architect, Midland, Texas

- Email: bobmcwilliams4@outlook.com
- Web: [echo-op.com](https://echo-op.com) | [echo-ept.com](https://echo-ept.com)

## License

MIT
