import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const tracking = /^(utm_.+|gclid|fbclid|msclkid)$/i;

export function normalizeUrl(input: string, base?: string): string | null {
  try {
    const url = new URL(input, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch { return null; }
}

export function sameSite(a: string, b: string): boolean {
  const x = new URL(a).hostname.replace(/^www\./, '');
  const y = new URL(b).hostname.replace(/^www\./, '');
  return x === y;
}

function privateIp(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  if (!isIP(ip)) return true;
  const p = ip.split('.').map(Number);
  return p.length === 4 && (p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && (p[1] ?? 0) >= 16 && (p[1] ?? 0) <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 0);
}

export async function assertPublicUrl(input: string): Promise<void> {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe URL');
  const records = await lookup(url.hostname, { all: true });
  if (!records.length || records.some(r => privateIp(r.address))) throw new Error('Private or reserved network targets are forbidden');
}
