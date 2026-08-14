import pg from "pg";
import type { PageResult } from "./types.js";
import { config } from "./config.js";

export const db = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });

export async function setAuditStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
  await db.query(`update audits set status=$2, updated_at=now(), pages_crawled=coalesce($3,pages_crawled), error=$4 where id=$1`, [id, status, extra.pagesCrawled ?? null, extra.error ?? null]);
}

export async function savePage(auditId: string, page: PageResult) {
  await db.query('begin');
  try {
    const result = await db.query(`insert into audit_pages
      (audit_id,url,final_url,depth,status_code,content_type,response_ms,bytes,title,description,canonical,robots,h1_count,h2_count,word_count,lang,internal_links,external_links)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      on conflict (audit_id,url) do update set final_url=excluded.final_url,status_code=excluded.status_code,response_ms=excluded.response_ms
      returning id`, [auditId,page.url,page.finalUrl,page.depth,page.status,page.contentType,page.responseMs,page.bytes,page.title,page.description,page.canonical,page.robots,page.h1Count,page.h2Count,page.wordCount,page.lang,page.internalLinks.length,page.externalLinks.length]);
    const pageId = result.rows[0].id;
    for (const i of page.issues) await db.query(`insert into audit_issues(audit_id,page_id,code,severity,message,evidence) values($1,$2,$3,$4,$5,$6)`, [auditId,pageId,i.code,i.severity,i.message,i.evidence ?? {}]);
    for (const k of page.keywords) await db.query(`insert into audit_page_keywords(audit_id,page_id,keyword,occurrences,in_title,in_h1,in_headings,weighted_score)
      values($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict(audit_id,page_id,keyword) do update set occurrences=excluded.occurrences,in_title=excluded.in_title,in_h1=excluded.in_h1,in_headings=excluded.in_headings,weighted_score=excluded.weighted_score`,
      [auditId,pageId,k.keyword,k.occurrences,k.inTitle,k.inH1,k.inHeadings,k.weightedScore]);
    for (const target of page.internalLinks) await db.query(`insert into audit_links(audit_id,source_url,target_url,is_internal) values($1,$2,$3,true) on conflict do nothing`, [auditId,page.finalUrl,target]);
    await db.query('commit');
  } catch (error) { await db.query('rollback'); throw error; }
}

export async function finalizeAudit(id: string, pages: number) {
  const result = await db.query(`select severity,count(*)::int count from audit_issues where audit_id=$1 group by severity`, [id]);
  const counts = Object.fromEntries(result.rows.map(r => [r.severity, r.count]));
  const deductions = (counts.critical ?? 0)*10 + (counts.high ?? 0)*4 + (counts.medium ?? 0)*2 + (counts.low ?? 0)*0.5;
  const score = Math.max(0, Math.round(100 - Math.min(100, deductions / Math.max(1, Math.sqrt(pages)))));
  await db.query(`update audits set status='completed',pages_crawled=$2,score=$3,summary=$4,completed_at=now(),updated_at=now() where id=$1`, [id,pages,score,counts]);
}
