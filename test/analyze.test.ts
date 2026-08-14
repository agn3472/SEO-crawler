import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHtml, extractKeywords } from "../src/analyze.js";

test('extracts evidence and detects missing SEO elements',()=>{
  const result=analyzeHtml({url:'https://example.com/',finalUrl:'https://example.com/',depth:0,status:200,contentType:'text/html',responseMs:3000,bytes:100,html:'<html><body><a href="/about?utm_source=x">About</a><p>Short page</p></body></html>'});
  assert.equal(result.internalLinks[0],'https://example.com/about');
  assert.ok(result.issues.some(i=>i.code==='TITLE_MISSING'));
  assert.ok(result.issues.some(i=>i.code==='H1_MISSING'));
  assert.ok(result.issues.some(i=>i.code==='SLOW_TTFB'));
});

test('scores keywords by occurrences and prominent placements',()=>{
  const keywords=extractKeywords('Professional SEO Audit','SEO Audit','Technical SEO Audit','Our SEO audit finds SEO problems. A technical SEO audit improves SEO.');
  const seo=keywords.find(k=>k.keyword==='seo');
  assert.ok(seo);
  assert.equal(seo.inTitle,true);
  assert.equal(seo.inH1,true);
  assert.ok(seo.weightedScore>seo.occurrences);
  assert.ok(keywords.some(k=>k.keyword==='seo audit'));
});
