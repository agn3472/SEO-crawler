import * as cheerio from "cheerio";
import type { Issue, KeywordMetric, PageResult } from "./types.js";
import { normalizeUrl, sameSite } from "./url.js";

const issue = (code: string, severity: Issue['severity'], message: string, evidence?: Record<string, unknown>): Issue => ({ code, severity, message, evidence });

const stopWords = new Set(`a an and are as at be been but by can could did do does for from had has have he her hers him his how i if in into is it its may more most my no not of on or our ours she should so than that the their them then there these they this those to too was we were what when where which who why will with would you your about after all also any because before between both each few other over same some such through under very website page home contact privacy terms तथा और एक यह के की को का में है हैं पर से लिए भी या नहीं`.split(/\s+/));
const words = (text: string) => (text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{1,}/gu) ?? []).map(w => w.replace(/^['’-]+|['’-]+$/g, '')).filter(w => w.length >= 3 && !stopWords.has(w) && !/^\d+$/.test(w));

export function extractKeywords(titleText: string, h1Text: string, headingText: string, bodyText: string): KeywordMetric[] {
  const bodyWords = words(bodyText);
  const counts = new Map<string, number>();
  for (let size=1; size<=3; size++) for(let i=0;i<=bodyWords.length-size;i++) {
    const phrase=bodyWords.slice(i,i+size).join(' ');
    counts.set(phrase,(counts.get(phrase)??0)+1);
  }
  const contains=(haystack:string,keyword:string)=>haystack.toLocaleLowerCase().includes(keyword);
  return [...counts].map(([keyword,occurrences])=>{
    const inTitle=contains(titleText,keyword), inH1=contains(h1Text,keyword), inHeadings=contains(headingText,keyword);
    return {keyword,occurrences,inTitle,inH1,inHeadings,weightedScore:occurrences+(inTitle?5:0)+(inH1?4:0)+(inHeadings?2:0)};
  }).filter(k=>k.occurrences>=2||k.inTitle||k.inH1).sort((a,b)=>b.weightedScore-a.weightedScore||b.occurrences-a.occurrences).slice(0,100);
}

export function analyzeHtml(input: Omit<PageResult, 'title'|'description'|'canonical'|'robots'|'h1Count'|'h2Count'|'wordCount'|'lang'|'internalLinks'|'externalLinks'|'keywords'|'issues'> & { html: string }): PageResult {
  const $ = cheerio.load(input.html);
  $('script,style,noscript,template,svg').remove();
  const title = $('title').first().text().trim() || null;
  const description = $('meta[name="description" i]').attr('content')?.trim() || null;
  const canonical = normalizeUrl($('link[rel="canonical" i]').attr('href') ?? '', input.finalUrl);
  const robots = $('meta[name="robots" i]').attr('content')?.trim() || null;
  const lang = $('html').attr('lang')?.trim() || null;
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const bodyText=$('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = (bodyText.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  const keywords=extractKeywords(title??'', $('h1').text(), $('h1,h2,h3').text(), bodyText);
  const links = new Set<string>();
  $('a[href]').each((_, el) => { const url = normalizeUrl($(el).attr('href') ?? '', input.finalUrl); if (url) links.add(url); });
  const internalLinks = [...links].filter(url => sameSite(url, input.finalUrl));
  const externalLinks = [...links].filter(url => !sameSite(url, input.finalUrl));
  const issues: Issue[] = [];
  if (input.status >= 500) issues.push(issue('HTTP_5XX', 'critical', `Server error ${input.status}`));
  else if (input.status >= 400) issues.push(issue('HTTP_4XX', 'high', `Broken page ${input.status}`));
  if (!title) issues.push(issue('TITLE_MISSING', 'high', 'Page has no title element'));
  else if (title.length < 30 || title.length > 60) issues.push(issue('TITLE_LENGTH', 'medium', 'Title is outside the recommended 30–60 character range', { length: title.length }));
  if (!description) issues.push(issue('DESCRIPTION_MISSING', 'medium', 'Meta description is missing'));
  else if (description.length < 70 || description.length > 160) issues.push(issue('DESCRIPTION_LENGTH', 'low', 'Meta description is outside the recommended 70–160 character range', { length: description.length }));
  if (h1Count === 0) issues.push(issue('H1_MISSING', 'high', 'Page has no H1'));
  if (h1Count > 1) issues.push(issue('H1_MULTIPLE', 'medium', 'Page has multiple H1 headings', { count: h1Count }));
  if (!canonical) issues.push(issue('CANONICAL_MISSING', 'medium', 'Canonical URL is missing or invalid'));
  if (!lang) issues.push(issue('LANG_MISSING', 'low', 'HTML language attribute is missing'));
  if (wordCount < 200) issues.push(issue('THIN_CONTENT', 'medium', 'Page has fewer than 200 visible words', { wordCount }));
  if (input.responseMs > 2000) issues.push(issue('SLOW_TTFB', 'medium', 'HTML response took longer than 2 seconds', { responseMs: input.responseMs }));
  if (robots && /noindex/i.test(robots)) issues.push(issue('NOINDEX', 'info', 'Page declares noindex'));
  return { ...input, title, description, canonical, robots, h1Count, h2Count, wordCount, lang, internalLinks, externalLinks, keywords, issues };
}
