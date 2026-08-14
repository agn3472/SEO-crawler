import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { config } from "./config.js";
import { db } from "./db.js";
import { crawlQueue } from "./queue.js";
import { normalizeUrl } from "./url.js";

const app=Fastify({logger:true,bodyLimit:64_000});
await app.register(cors,{origin:false});
app.addHook('onRequest',async(req,reply)=>{if(req.url==='/health')return;const supplied=String(req.headers['x-api-key']??'');const a=Buffer.from(supplied),b=Buffer.from(config.API_KEY);if(a.length!==b.length||!timingSafeEqual(a,b))return reply.code(401).send({error:'Unauthorized'});});
app.get('/health',async()=>({ok:true}));

const createSchema=z.object({url:z.string().url(),maxPages:z.number().int().min(1).max(500).default(500)});
app.post('/v1/audits',async(req,reply)=>{
  const parsed=createSchema.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'Invalid request',details:parsed.error.flatten()});
  const url=normalizeUrl(parsed.data.url);if(!url)return reply.code(400).send({error:'Invalid URL'});
  const id=randomUUID();
  await db.query(`insert into audits(id,start_url,status,max_pages) values($1,$2,'queued',$3)`,[id,url,parsed.data.maxPages]);
  await crawlQueue.add('crawl',{auditId:id,startUrl:url,maxPages:parsed.data.maxPages},{jobId:id});
  return reply.code(202).send({id,status:'queued'});
});
app.get('/v1/audits/:id',async(req,reply)=>{const {id}=req.params as {id:string};const r=await db.query(`select id,start_url,status,max_pages,pages_crawled,score,summary,error,created_at,completed_at from audits where id=$1`,[id]);if(!r.rowCount)return reply.code(404).send({error:'Not found'});return r.rows[0];});
app.get('/v1/audits/:id/issues',async(req)=>{const {id}=req.params as {id:string};const q=req.query as {limit?:string;offset?:string};const limit=Math.min(500,Math.max(1,Number(q.limit??100)));const offset=Math.max(0,Number(q.offset??0));const r=await db.query(`select i.*,p.url from audit_issues i join audit_pages p on p.id=i.page_id where i.audit_id=$1 order by case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 when 'low' then 4 else 5 end,i.id limit $2 offset $3`,[id,limit,offset]);return {items:r.rows,limit,offset};});
app.get('/v1/audits/:id/keywords',async(req,reply)=>{
  const {id}=req.params as {id:string}; const q=req.query as {limit?:string;offset?:string};
  const limit=Math.min(500,Math.max(1,Number(q.limit??100))),offset=Math.max(0,Number(q.offset??0));
  const exists=await db.query(`select pages_crawled from audits where id=$1`,[id]); if(!exists.rowCount)return reply.code(404).send({error:'Not found'});
  const totals=await db.query(`select count(distinct keyword)::int unique_keywords,coalesce(sum(occurrences),0)::int total_occurrences from audit_page_keywords where audit_id=$1`,[id]);
  const result=await db.query(`with metrics as (
    select k.keyword,sum(k.occurrences)::int occurrences,count(*)::int page_count,
      count(*) filter(where k.in_title)::int title_pages,count(*) filter(where k.in_h1)::int h1_pages,
      count(*) filter(where k.in_headings)::int heading_pages,round(sum(k.weighted_score),1) weighted_score,
      round(100.0*sum(k.occurrences)/nullif(sum(p.word_count),0),2) density_percent,
      array_agg(p.url order by k.weighted_score desc)[1:5] example_pages
    from audit_page_keywords k join audit_pages p on p.id=k.page_id where k.audit_id=$1 group by k.keyword
  ) select *,case
      when title_pages>=2 then 'cannibalization-risk'
      when density_percent>4 then 'overused'
      when title_pages>0 and h1_pages>0 and weighted_score>=12 then 'strong-on-page'
      when occurrences>=3 and title_pages=0 and h1_pages=0 then 'opportunity'
      else 'weak-signal' end status
    from metrics order by weighted_score desc,occurrences desc limit $2 offset $3`,[id,limit,offset]);
  return {methodology:'Crawler-derived on-page signals; not search volume, ranking, traffic, or conversion performance.',pages_analyzed:exists.rows[0].pages_crawled,...totals.rows[0],items:result.rows,limit,offset};
});
app.post('/v1/audits/:id/cancel',async(req,reply)=>{const {id}=req.params as {id:string};const job=await crawlQueue.getJob(id);await job?.remove();await db.query(`update audits set status='cancelled',updated_at=now() where id=$1 and status in ('queued','running')`,[id]);return reply.code(202).send({id,status:'cancelled'});});

await app.listen({port:config.PORT,host:'0.0.0.0'});
