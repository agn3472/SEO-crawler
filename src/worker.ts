import { Worker } from "bullmq";
import { redis } from "./queue.js";
import { crawlSite } from "./crawler.js";
import { finalizeAudit, setAuditStatus } from "./db.js";
import type { CrawlJobData } from "./types.js";

const worker = new Worker<CrawlJobData>('seo-crawls', async job => {
  try {
    const pages = await crawlSite(job.data.auditId, job.data.startUrl, job.data.maxPages, async n => { await job.updateProgress({pagesCrawled:n}); await setAuditStatus(job.data.auditId,'running',{pagesCrawled:n}); });
    await finalizeAudit(job.data.auditId,pages);
    return {pages};
  } catch(error) {
    await setAuditStatus(job.data.auditId,'failed',{error:error instanceof Error?error.message:'Unknown failure'});
    throw error;
  }
}, { connection: redis, concurrency: 2, limiter: { max: 4, duration: 1000 } });

worker.on('failed',(job,error)=>console.error('crawl failed',job?.id,error));
const shutdown=async()=>{await worker.close();await redis.quit();process.exit(0);};
process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
