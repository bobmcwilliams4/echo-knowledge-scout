# Echo Knowledge Scout

A Cloudflare Worker that automatically scans GitHub, HuggingFace, ArXiv, Reddit, Hacker News, Product Hunt, and RSS feeds daily for new AI/tech developments. Discoveries are scored for relevance, deduplicated, and optionally ingested into downstream knowledge systems.

## How It Works

Knowledge Scout runs on a daily cron (6am UTC) and:

1. Queries each source with configurable search terms
2. Scores discoveries by relevance (0.0–1.0)
3. Deduplicates against previous finds
4. Stores everything in D1
5. Optionally ingests high-relevance items into external knowledge bases

You can also trigger scans manually via the API.

```bash
# Trigger a full scan
curl -X POST https://your-worker.workers.dev/scan

# Scan a single source
curl -X POST https://your-worker.workers.dev/scan/github

# Browse discoveries
curl https://your-worker.workers.dev/discoveries?min_relevance=0.7&category=agent_framework
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Status and endpoint list |
| `GET` | `/health` | Health check |
| `GET` | `/discoveries` | List discoveries (filterable) |
| `GET` | `/discoveries/:id` | Get a single discovery |
| `GET` | `/runs` | List scan runs |
| `GET` | `/runs/:id` | Scan run details |
| `GET` | `/stats` | Metrics and statistics |
| `GET` | `/sources` | Source configuration |
| `POST` | `/scan` | Trigger full scan |
| `POST` | `/scan/:source` | Trigger single source scan |
| `POST` | `/ingest/:id` | Re-ingest a discovery |
| `POST` | `/ingest/pending` | Ingest all pending |

## Sources

| Source | What It Scans |
|--------|--------------|
| GitHub | Trending repos, new releases, topic searches |
| HuggingFace | New models, datasets, spaces |
| ArXiv | Papers in cs.AI, cs.CL, cs.LG |
| Reddit | r/LocalLLaMA, r/MachineLearning, r/artificial |
| Hacker News | Top stories matching AI/tech keywords |
| Product Hunt | New AI/developer tool launches |
| RSS | Custom feed list |

## Deploy Your Own

```bash
git clone https://github.com/bobmcwilliams4/echo-knowledge-scout.git
cd echo-knowledge-scout
npm install

# Create D1 database
npx wrangler d1 create echo-knowledge-scout

# Update wrangler.toml with your database ID, then:
npx wrangler d1 execute echo-knowledge-scout --remote --file=schema.sql

# Seed default source configs
npx wrangler d1 execute echo-knowledge-scout --remote --file=seed.sql

# Deploy
npx wrangler deploy
```

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Language**: TypeScript
- **Scheduling**: Cloudflare Cron Triggers

## Part of Echo Omega Prime

Knowledge Scout is the intelligence gathering layer of [Echo Omega Prime](https://github.com/bobmcwilliams4/Echo-Omega-Prime). It can run standalone or feed into the larger system's Shared Brain and Knowledge Forge.

## Author

**Bobby Don McWilliams II** · bobmcwilliams4@outlook.com

## License

MIT
