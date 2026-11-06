/**
 * Auditoría REMOTA explícita (no corre en build).
 * HEAD/GET throttled ≤1 req/1.2s, cache 7d en scripts/data/remote-audit-cache.json
 * Uso: node scripts/audit-remote.mjs [--limit=40]
 */
import fs from 'node:fs';
import path from 'node:path';
const BASE = process.cwd();
const limit = Number((process.argv.find((a) => a.startsWith('--limit=')) || '--limit=40').split('=')[1]);
const atlas = JSON.parse(fs.readFileSync(path.join(BASE, 'public', 'data', 'atlas.json'), 'utf8'));
const cachePath = path.join(BASE, 'scripts', 'data', 'remote-audit-cache.json');
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WEEK = 7 * 24 * 3600 * 1000;
const urls = [];
for (const p of atlas.places) {
  const s = p.img?.src;
  if (s?.startsWith('http')) urls.push({ id: p.id, url: s });
  if (p.visit?.src?.url) urls.push({ id: p.id + '#visit', url: p.visit.src.url });
}
const uniq = [...new Map(urls.map((u) => [u.url, u])).values()].slice(0, limit);
const out = [];
for (const u of uniq) {
  const c = cache[u.url];
  if (c && Date.now() - c.at < WEEK) {
    out.push({ ...u, ...c, cached: true });
    continue;
  }
  try {
    await sleep(1200);
    const res = await fetch(u.url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'PerezeandoMap/1.0 (link audit; polite)' },
      signal: AbortSignal.timeout(15000),
    });
    const row = { status: res.status, ok: res.ok, at: Date.now() };
    cache[u.url] = row;
    out.push({ ...u, ...row });
    console.log(res.status, u.id);
  } catch (e) {
    const row = { status: 0, ok: false, err: e.message, at: Date.now() };
    cache[u.url] = row;
    out.push({ ...u, ...row });
  }
}
fs.writeFileSync(cachePath, JSON.stringify(cache));
fs.writeFileSync(path.join(BASE, 'perf', 'audit-remote.json'), JSON.stringify({ checked: out.length, bad: out.filter((x) => !x.ok).length, out }, null, 2));
console.log('done', out.length, 'bad', out.filter((x) => !x.ok).length);
