#!/usr/bin/env node
/**
 * Fase A: espejo de imágenes remotas YA curadas → public/media (WebP 120/320/800).
 * No busca fotos nuevas. No toca ni borra WebP ya locales (/media) ni re-sube a R2.
 * Solo encola src https://…; si el -800.webp del hash ya existe, reusa archivo.
 *
 *   node scripts/mirror-remote-media.mjs
 *   node scripts/mirror-remote-media.mjs --dry-run
 *   node scripts/mirror-remote-media.mjs --limit=20
 *   node scripts/mirror-remote-media.mjs --only=places|food|content
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require(path.join(process.env.TEMP || '/tmp', 'pz-imgopt/node_modules/sharp'));
} catch {
  try {
    sharp = require('sharp');
  } catch {
    sharp = null;
  }
}
if (!sharp) {
  console.error('sharp no disponible (TEMP/pz-imgopt o sharp). Abort.');
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0) || Infinity;
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || 'all';

const UA = 'PerezeandoContentBot/1.0 (https://perezeando.com; mapa de Costa Rica; build-time mirror)';
const MEDIA = path.join(ROOT, 'public', 'media');
const SIZES = [
  { tag: 120, w: 120, q: 72 },
  { tag: 320, w: 320, q: 74 },
  { tag: 800, w: 800, q: 78 },
];
const CONCURRENCY = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dishKey = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function isRemote(src) {
  return typeof src === 'string' && /^https?:\/\//i.test(src);
}
function isLocal(src) {
  return typeof src === 'string' && (src.startsWith('/media/') || src.includes('/media/'));
}

/** Preferir thumb más grande / original Wikimedia. */
function enlargeUrl(src) {
  const clean = String(src).replace(/\?utm_[^#]*$/, '').split('#')[0];
  const out = [clean];
  if (/\/thumb\/.+\/\d+px-/.test(clean)) {
    out.push(clean.replace(/\/(\d+)px-/, '/1280px-'));
    out.push(clean.replace(/\/(\d+)px-/, '/960px-'));
    out.push(clean.replace(/\/(\d+)px-/, '/800px-'));
    // original: …/thumb/a/ab/File.jpg/960px-File.jpg → …/a/ab/File.jpg
    const orig = clean.replace(/\/thumb\/([^/]+\/[^/]+\/)([^/]+)\/\d+px-\2$/i, '/$1$2');
    if (orig !== clean) out.push(orig);
  }
  return [...new Set(out)];
}

async function optimizeLocalImage(buf, destDir, baseId) {
  fs.mkdirSync(destDir, { recursive: true });
  const meta = await sharp(buf).rotate().metadata();
  let bytes800 = 0;
  for (const { tag, w, q } of SIZES) {
    let pipe = sharp(buf).rotate();
    if ((meta.width || 0) > w) pipe = pipe.resize({ width: w, withoutEnlargement: true });
    const out = path.join(destDir, `${baseId}-${tag}.webp`);
    const info = await pipe.webp({ quality: q, effort: 4 }).toFile(out);
    if (tag === 800) bytes800 = info.size;
  }
  return {
    local: `/media/${path.relative(MEDIA, path.join(destDir, `${baseId}-800.webp`)).split(path.sep).join('/')}`,
    bytes: bytes800,
  };
}

async function downloadToMedia(src, destDir, baseId) {
  const existing = path.join(destDir, `${baseId}-800.webp`);
  if (fs.existsSync(existing)) {
    return {
      local: `/media/${path.relative(MEDIA, existing).split(path.sep).join('/')}`,
      bytes: fs.statSync(existing).size,
      cached: true,
    };
  }
  let lastErr = null;
  for (const url of enlargeUrl(src)) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(90000),
      });
      if (!r.ok) {
        lastErr = new Error('HTTP ' + r.status);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 800) {
        lastErr = new Error('tiny');
        continue;
      }
      const opt = await optimizeLocalImage(buf, destDir, baseId);
      return { ...opt, from: url };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('dl fail');
}

/** Pool simple */
async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

// ---------- collect jobs ----------
/** @type {{ kind: string, key: string, src: string, destSub: string, baseId: string, apply: (local: string) => void }[]} */
const jobs = [];
const seenUrl = new Map(); // url -> baseId preference (first wins for apply list)

function enqueue({ kind, key, src, destSub, apply }) {
  if (!isRemote(src)) return;
  if (ONLY !== 'all' && ONLY !== kind) return;
  const baseId = createHash('sha1').update(`${kind}:${key}`).digest('hex').slice(0, 10);
  jobs.push({ kind, key, src, destSub, baseId, apply });
}

// places sources (inline img wins over photos.json in build-data)
const placeFiles = [
  'data/places.json',
  'data/places-wd.json',
  'data/places-extra.json',
  'data/fauna-extra.json',
];
const placeDocs = new Map();
const enqueuePlaceImg = (p, rel) => {
  if (!p?.id || !isRemote(p.img?.src)) return;
  enqueue({
    kind: 'places',
    key: `${rel}:${p.id}`,
    src: p.img.src,
    destSub: 'places',
    apply: (local) => {
      const prev = p.img.src;
      p.img = { ...p.img, src: local, remote: p.img.remote || prev };
      delete p.img.allowRemote;
    },
  });
};
for (const rel of placeFiles) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  placeDocs.set(rel, { abs, raw });
  for (const p of Array.isArray(raw) ? raw : []) enqueuePlaceImg(p, rel);
}

// OSM: { places: [...] }
{
  const rel = 'data/places-osm.json';
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
    placeDocs.set(rel, { abs, raw });
    for (const p of Array.isArray(raw) ? raw : raw.places || []) enqueuePlaceImg(p, rel);
  }
}

// enrich.json: { [id]: { img?: { src } } } — build-data lo usa si el lugar no trae foto
{
  const rel = 'data/enrich.json';
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
    placeDocs.set(rel, { abs, raw });
    for (const [id, x] of Object.entries(raw || {})) {
      if (!isRemote(x?.img?.src)) continue;
      enqueue({
        kind: 'places',
        key: `enrich:${id}`,
        src: x.img.src,
        destSub: 'places',
        apply: (local) => {
          const prev = x.img.src;
          x.img = { ...x.img, src: local, remote: x.img.remote || prev };
        },
      });
    }
  }
}

// photos-hand.json: overrides manuales
{
  const rel = 'data/photos-hand.json';
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
    placeDocs.set(rel, { abs, raw });
    for (const [id, img] of Object.entries(raw || {})) {
      if (!isRemote(img?.src)) continue;
      enqueue({
        kind: 'places',
        key: `hand:${id}`,
        src: img.src,
        destSub: 'places',
        apply: (local) => {
          const prev = img.src;
          raw[id] = { ...img, src: local, remote: img.remote || prev };
        },
      });
    }
  }
}

const photosPath = path.join(ROOT, 'data/photos.json');
const photos = JSON.parse(fs.readFileSync(photosPath, 'utf8'));
photos.found ||= {};
for (const [id, img] of Object.entries(photos.found)) {
  if (!isRemote(img?.src)) continue;
  enqueue({
    kind: 'places',
    key: `photos:${id}`,
    src: img.src,
    destSub: 'places',
    apply: (local) => {
      photos.found[id] = { ...img, src: local, remote: img.remote || img.src, how: img.how || 'mirror' };
    },
  });
}

const foodPath = path.join(ROOT, 'scripts/data/food-photos.json');
const foodPhotos = fs.existsSync(foodPath) ? JSON.parse(fs.readFileSync(foodPath, 'utf8')) : {};
for (const [k, img] of Object.entries(foodPhotos)) {
  if (!isRemote(img?.src)) continue;
  enqueue({
    kind: 'food',
    key: k,
    src: img.src,
    destSub: 'food',
    apply: (local) => {
      foodPhotos[k] = { ...img, src: local, remote: img.remote || img.src };
    },
  });
}

const pcPath = path.join(ROOT, 'public/data/provinces-content.json');
const pc = JSON.parse(fs.readFileSync(pcPath, 'utf8'));
/** culture/sports/food vienen anidados (museums, heritage, items, arrays…); solo tocamos img remotas. */
const stampTree = (node, section) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const x of node) stampTree(x, section);
    return;
  }
  if (node.img?.src && isRemote(node.img.src)) {
    const name =
      typeof node.name === 'string' ? node.name : node.name?.es || node.title?.es || node.id || node.img.src;
    const kind = section === 'food' ? 'food' : 'content';
    const destSub = section === 'food' ? 'food' : 'content';
    enqueue({
      kind,
      key: `${section}:${dishKey(name)}:${node.img.src}`,
      src: node.img.src,
      destSub,
      apply: (local) => {
        const prev = node.img.src;
        node.img = { ...node.img, src: local, remote: node.img.remote || prev };
        if (section === 'food') {
          const k = dishKey(name);
          if (k) foodPhotos[k] = { ...(foodPhotos[k] || {}), ...node.img, src: local };
        }
      },
    });
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'img') continue;
    stampTree(v, section);
  }
};
stampTree(pc.national?.food, 'food');
for (const p of Object.values(pc.provinces || {})) {
  stampTree(p.food, 'food');
  stampTree(p.culture, 'culture');
  stampTree(p.sports, 'sports');
  stampTree(p.activities, 'activities');
}

// dedupe identical URL+dest within same apply batch still runs all applies after one download
const byDownload = new Map(); // `${destSub}|${url}` -> { job meta, applies[] }
for (const j of jobs) {
  const dk = `${j.destSub}|${j.src}`;
  if (!byDownload.has(dk)) {
    byDownload.set(dk, {
      kind: j.kind,
      key: j.key,
      src: j.src,
      destSub: j.destSub,
      baseId: j.baseId,
      applies: [j.apply],
    });
  } else {
    byDownload.get(dk).applies.push(j.apply);
  }
}

let queue = [...byDownload.values()];
if (Number.isFinite(LIMIT)) queue = queue.slice(0, LIMIT);

console.log(
  JSON.stringify(
    {
      dry: DRY,
      only: ONLY,
      collectedJobs: jobs.length,
      uniqueDownloads: byDownload.size,
      queued: queue.length,
      byKind: jobs.reduce((a, j) => ((a[j.kind] = (a[j.kind] || 0) + 1), a), {}),
    },
    null,
    2,
  ),
);

if (DRY) {
  process.exit(0);
}

const report = { ok: 0, fail: 0, cached: 0, errors: [], started: new Date().toISOString() };
let done = 0;

await mapPool(queue, CONCURRENCY, async (job) => {
  const destDir = path.join(MEDIA, job.destSub);
  try {
    const dl = await downloadToMedia(job.src, destDir, job.baseId);
    for (const apply of job.applies) apply(dl.local);
    if (dl.cached) report.cached++;
    else report.ok++;
  } catch (e) {
    report.fail++;
    if (report.errors.length < 40) report.errors.push({ key: job.key, src: job.src.slice(0, 120), err: String(e.message || e) });
  }
  done++;
  if (done % 15 === 0 || done === queue.length) {
    console.log(`progress ${done}/${queue.length} ok=${report.ok} cached=${report.cached} fail=${report.fail}`);
  }
  await sleep(200);
});

// persist (compacto salvo food-photos / photos-hand si ya venían con formato)
for (const [rel, { abs, raw }] of placeDocs) {
  if (rel.endsWith('photos-hand.json')) fs.writeFileSync(abs, JSON.stringify(raw, null, 2) + '\n');
  else fs.writeFileSync(abs, JSON.stringify(raw));
}
fs.writeFileSync(photosPath, JSON.stringify(photos));
fs.writeFileSync(foodPath, JSON.stringify(foodPhotos, null, 2) + '\n');
fs.writeFileSync(pcPath, JSON.stringify(pc));

report.finished = new Date().toISOString();
fs.mkdirSync(path.join(ROOT, 'perf'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'perf/mirror-remote-media.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, errors: report.errors.length }, null, 2));
console.log('Listo. Corré `pnpm build-data` para regenerar atlas.json.');
