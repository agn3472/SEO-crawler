import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHtml } from "../src/analyze.js";

test('extracts evidence and detects missing SEO elements',()=>{
  const result=analyzeHtml({url:'https://example.com/',finalUrl:'https://example.com/',depth:0,status:200,contentType:'text/html',responseMs:3000,bytes:100,html:'<html><body><a href="/about?utm_source=x">About</a><p>Short page</p></body></html>'});
  assert.equal(result.internalLinks[0],'https://example.com/about');
  assert.ok(result.issues.some(i=>i.code==='TITLE_MISSING'));
  assert.ok(result.issues.some(i=>i.code==='H1_MISSING'));
  assert.ok(result.issues.some(i=>i.code==='SLOW_TTFB'));
});
