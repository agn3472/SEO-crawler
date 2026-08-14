import robotsParserModule from "robots-parser";
import { config } from "./config.js";
import { analyzeHtml } from "./analyze.js";
import { assertPublicUrl, normalizeUrl, sameSite } from "./url.js";
import { savePage, setAuditStatus } from "./db.js";

type Candidate = { url: string; depth: number };
type Robots = { isAllowed(url: string, userAgent?: string): boolean };
const robotsParser = robotsParserModule as unknown as (url: string, contents: string) => Robots;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchLimited(url: string): Promise<{ response: Response; body: string; ms: number; bytes: number }> {
  await assertPublicUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.CRAWL_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'user-agent': config.CRAWLER_USER_AGENT, accept: 'text/html,application/xhtml+xml' } });
    await assertPublicUrl(response.url);
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > config.CRAWL_MAX_BODY_BYTES) throw new Error('Response exceeds body limit');
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (reader) { const {done,value}=await reader.read(); if(done) break; bytes += value.byteLength; if(bytes > config.CRAWL_MAX_BODY_BYTES){ await reader.cancel(); throw new Error('Response exceeds body limit'); } chunks.push(value); }
    const body = new TextDecoder().decode(Buffer.concat(chunks));
    return { response, body, ms: Math.round(performance.now()-started), bytes };
  } finally { clearTimeout(timeout); }
}

async function getRobots(startUrl: string) {
  const url = new URL('/robots.txt', startUrl).toString();
  try { const r = await fetchLimited(url); return robotsParser(url, r.body); } catch { return robotsParser(url, ''); }
}

export async function crawlSite(auditId: string, rawStartUrl: string, requestedMax: number, onProgress?: (n:number)=>Promise<void>) {
  const startUrl = normalizeUrl(rawStartUrl);
  if (!startUrl) throw new Error('Invalid start URL');
  await assertPublicUrl(startUrl);
  const maxPages = Math.min(config.CRAWL_MAX_PAGES, Math.max(1, requestedMax));
  const robots = await getRobots(startUrl);
  const pending: Candidate[] = [{url:startUrl,depth:0}];
  const seen = new Set<string>(); let crawled = 0;
  await setAuditStatus(auditId, 'running');

  while (pending.length && crawled < maxPages) {
    const candidate = pending.shift()!;
    if (seen.has(candidate.url) || candidate.depth > config.CRAWL_MAX_DEPTH || !robots.isAllowed(candidate.url, config.CRAWLER_USER_AGENT)) continue;
    seen.add(candidate.url);
    try {
      const {response,body,ms,bytes}=await fetchLimited(candidate.url);
      const contentType=response.headers.get('content-type')??'';
      if (!contentType.includes('text/html')) continue;
      const page=analyzeHtml({url:candidate.url,finalUrl:response.url,depth:candidate.depth,status:response.status,contentType,responseMs:ms,bytes,html:body});
      await savePage(auditId,page); crawled++;
      for(const link of page.internalLinks) if(!seen.has(link)&&sameSite(link,startUrl)) pending.push({url:link,depth:candidate.depth+1});
      await onProgress?.(crawled);
    } catch (error) {
      await savePage(auditId,{url:candidate.url,finalUrl:candidate.url,depth:candidate.depth,status:0,contentType:'',responseMs:0,bytes:0,title:null,description:null,canonical:null,robots:null,h1Count:0,h2Count:0,wordCount:0,lang:null,internalLinks:[],externalLinks:[],keywords:[],issues:[{code:'FETCH_FAILED',severity:'high',message:error instanceof Error?error.message:'Fetch failed'}]});
      crawled++;
    }
    await sleep(config.CRAWL_DELAY_MS);
  }
  return crawled;
}
