import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl, sameSite } from "../src/url.js";

test('normalizes tracking parameters, fragments and trailing slash',()=>assert.equal(normalizeUrl('/a/?utm_source=x&b=2#x','https://EXAMPLE.com'), 'https://example.com/a?b=2'));
test('treats www as same site',()=>assert.equal(sameSite('https://www.example.com/a','https://example.com'),true));
