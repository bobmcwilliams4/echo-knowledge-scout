# Echo Knowledge Scout

A Cloudflare Worker that automatically scans 7 sources daily for new AI/tech developments and ingests them into a searchable knowledge base.

## What It Does

Knowledge Scout runs on a cron schedule (daily at 6am UTC) and scans:

- **GitHub** — Trending repos, new releases
- **HuggingFace** — New models and datasets
- **ArXiv** — Recent AI/ML papers
- **Reddit** — r/LocalLLaMA, r/MachineLearning, r/artificial
- **Hacker News** — Top AI/tech stories
- **RSS Feeds** — Curated tech blogs
- **Product Hunt** — New AI tools and launches

Each discovery is scored for relevance, categorized, and stored in D1. High-relevance items are automatically ingested into the broader knowledge system.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Status and endpoint list |
| `GET` | `/health` | Health check |
| `GET` | `/discoveries` | List discoveries (filterable) |
| `GET` | `/discoveries/:id` | Get single discovery |
| `GET` | `/runs` | List scan runs |
| `GET` | `/stats` | Statistics and metrics |
| `GET` | `/sources` | Source configuration |
| `POST` | `/scan` | Trigger manual scan |
| `POST` | `/scan/:source` | Scan a single source |
| `POST` | `/ingest/:id` | Re-ingest a discovery |
| `POST` | `/ingest/pending` | Ingest all pending items |

## Deploy Your Own

```bash
git clone https://github.com/bobmcwilliams4/echo-knowledge-scout.git
cd echo-knowledge-scout
npm install

# Create D1 database
npx wrangler d1 create echo-knowledge-scout

# Update wrangler.toml with your database ID, then:
npx wrangler d1 execute echo-knowledge-scout --remote --file=./schema.sql
npx wrangler d1 execute echo-knowledge-scout --remote --file=./seed.sql

# Deploy
npx wrangler deploy
```

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1
- **Language**: TypeScript
- **Scheduling**: Cloudflare Cron Triggers

## Part of Echo Omega Prime

Knowledge Scout is the automated intelligence gathering layer of [Echo Omega Prime](https://github.com/bobmcwilliams4/Echo-Omega-Prime). It feeds discoveries into the Shared Brain and Knowledge Forge for cross-system access.

## Author

**Bobby Don McWilliams II** · bobmcwilliams4@outlook.com

## License

MIT
