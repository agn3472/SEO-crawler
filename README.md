# SiteSignal SEO Crawler

Production foundation for evidence-based technical SEO audits of up to **500 pages per website**. It uses an authenticated Fastify API, BullMQ/Upstash queue, Railway workers, and Supabase Postgres.

## What is genuine today

- Same-site breadth-first crawling with URL normalization and duplicate suppression
- `robots.txt` enforcement, crawl depth/page/body/time limits, redirects, retry queue, cancellation and live progress
- SSRF protection that blocks private/reserved network destinations and rechecks redirect targets
- Per-page evidence: HTTP status, response time, bytes, metadata, canonicals, robots directives, headings, visible word count, language and link counts
- Sitewide keyword inventory for one-to-three-word phrases, including unique/total usage, page coverage, prominent placement, density, cannibalization risk and honest on-page strength labels
- Stored issue evidence, link graph, severity summary and deterministic 0–100 technical score
- 500-page audit cap (configurable downward), persistent results and resumable queue jobs

This is a technical/on-page crawler. Search volume, rankings, backlink indexes, traffic estimates and competitor keyword databases require licensed external data providers later; they must never be presented as crawler-derived facts.

## India-oriented deployment

Your selected topology is suitable: Supabase `ap-northeast-1` (Tokyo), Upstash `ap-south-1` (Mumbai), and Railway project `SEO-workers`. Put the API and worker in the nearest available Railway Asia region. The worker deliberately crawls each website politely; do not raise concurrency globally without per-host scheduling.

## Setup

1. In Supabase SQL Editor, run `supabase/migrations/001_initial.sql`.
2. In Railway, create two services from this repository:
   - `seo-api`: start command `npm run start:api`
   - `seo-worker`: start command `npm run start:worker`
3. Add the variables from `.env.example` to both services. Use the Supabase **direct/session-pooler PostgreSQL connection string** as `DATABASE_URL` and the Upstash TLS Redis URL as `REDIS_URL`.
4. Generate a long random `API_KEY`; keep it server-side. Never expose the service-role/database/Redis credentials in frontend code.
5. Deploy, then verify `GET /health` on the API.

Example audit request:

```bash
curl -X POST https://YOUR-API/v1/audits \
  -H 'content-type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{"url":"https://example.com","maxPages":500}'
```

Poll `GET /v1/audits/{id}` and retrieve evidence with `GET /v1/audits/{id}/issues?limit=100&offset=0`.
Keyword intelligence is available at `GET /v1/audits/{id}/keywords?limit=100&offset=0`. Its labels describe crawler-observed on-page targeting only; rankings, traffic, conversions, search volume and difficulty require external providers such as Google Search Console and an SEO data API.

## Local development

```bash
cp .env.example .env
npm install
npm test
npm run check
npm run dev:api
# another terminal
npm run dev:worker
```

## Next professional modules

Add sitemap ingestion and orphan comparison, redirect-chain persistence, duplicate-content clustering, structured-data validation, hreflang validation, Core Web Vitals through PageSpeed Insights/CrUX, Google Search Console, PDF/CSV branded reports, scheduled recrawls, historical diffs, multi-tenancy, billing and quotas. The schema and queue boundary are intentionally designed for those adapters.

## Responsible crawling

Only audit sites the customer owns or is authorized to test. Keep `robots.txt` compliance enabled, identify the bot with a real contact URL, respect 429/503 responses, and publish a bot information page and opt-out contact before commercial launch.
