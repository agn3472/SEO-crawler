import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_KEY: z.string().min(24),
  PORT: z.coerce.number().int().positive().default(3000),
  CRAWL_MAX_PAGES: z.coerce.number().int().min(1).max(500).default(500),
  CRAWL_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(2),
  CRAWL_DELAY_MS: z.coerce.number().int().min(200).default(500),
  CRAWL_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),
  CRAWL_MAX_BODY_BYTES: z.coerce.number().int().min(100000).default(3145728),
  CRAWL_MAX_DEPTH: z.coerce.number().int().min(1).max(30).default(15),
  CRAWLER_USER_AGENT: z.string().default("SiteSignalBot/1.0")
});

export const config = schema.parse(process.env);
