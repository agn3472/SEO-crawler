import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import type { CrawlJobData } from "./types.js";

export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
export const crawlQueue = new Queue<CrawlJobData>('seo-crawls', { connection: redis, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 100, removeOnFail: 500 } });
