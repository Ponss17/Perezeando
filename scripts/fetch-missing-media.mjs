#!/usr/bin/env node
/**
 * Fase B: busca fotos libres para lugares SIN img y las guarda en /media + photos.json.
 * Criterios estrictos (nombre / wiki del lugar); no inventa portadas.
 *
 *   node scripts/fetch-missing-media.mjs
 *   node scripts/fetch-missing-media.mjs --skip-cat=gastronomia
 *   node scripts/fetch-missing-media.mjs --limit=50
 *   node scripts/fetch-missing-media.mjs --include-gastro
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
  console.error('sharp no disponible. Abort.');
  process.exit(1);
}

const args = process.argv.slice(2);
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0) || Infinity;
const INCLUDE_GASTRO = args.includes('--include-gastro');
const ONLY_WIKI = args.includes('--only-wiki');
const SKIP = new Set(
  (args.find((a) => a.startsWith('--skip-cat=')) || `skip-cat=${INCLUDE_GASTRO ? '' : 'gastronomia'}`)
    .split('=')[1]
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || [],
);

const UA = 'PerezeandoContentBot/1.0 (https://perezeando.com; mapa de Costa Rica; build-time fetch)';
const MEDIA = path.join(ROOT, 'public', 'media', 'places');
const PHOTOS = path.join(ROOT, 'data', 'photos.json');
const SIZES = [
  { tag: 120, w: 120, q: 72 },
  { tag: 320, w: 320, q: 74 },
  { tag: 800, w: 800, q: 78 },
];
const FREE = (l) => /^(cc0|cc[- ]by(-sa)?( \d(\.\d)?)?|public domain|pd\b|dominio p)/i.test(l || '') && !/nc|nd/i.test(l || '');
const BAD = /\b(map|mapa|location|locator|logo|escudo|coat|flag|bandera|diagram|diagrama|plano|icon|svg|selfie|portrait|retrato|chart)\b/i;
const CAT_PRIO = {
  volcanes: 0, parques: 1, museos: 2, iglesias: 3, playas: 4, cataratas: 5, cerros: 6, rios: 7,
  islas: 8, bosques: 9, arqueologia: 10, hitos: 11, deportes: 12, ciudades: 13, surf: 14,
  gastronomia: 90,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

fs.mkdirSync(MEDIA, { recursive: true });

let last = 0;
async function api(host, params, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const wait = 800 - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const r = await fetch(`https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', maxlag: '5', ...params }), {
        headers: { 'User-Agent': UA, 'Api-User-Agent': UA },
        signal: AbortSignal.timeout(60000),
      });
      if (r.status === 429 || r.status >= 500) {
        await sleep(Math.min(60000, 5000 * (i + 1)));
        throw new Error('HTTP ' + r.status);
      }
      const j = await r.json();
      if (j.error?.code === 'maxlag') {
        await sleep(Math.min(60000, 10000 * (i + 1)));
        throw new Error('maxlag');
      }
      return j;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}

function nameMatchesTitle(placeName, title) {
  const a = norm(placeName)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const b = norm(title);
  if (!a.length) return false;
  const hits = a.filter((w) => b.includes(w));
  return hits.length >= Math.min(2, a.length) || (a.length <= 2 && a[0] && b.includes(a[0]));
}

async function commonsFileMeta(file) {
  const d = await api('commons.wikimedia.org', {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '1280',
    iiextmetadatafilter: 'Artist|LicenseShortName',
    titles: 'File:' + file,
  });
  const pg = d.query?.pages?.[0];
  const ii = pg?.imageinfo?.[0];
  const lic = strip(ii?.extmetadata?.LicenseShortName?.value);
  if (!ii || !/jpeg|png|webp/i.test(ii.mime || '') || !FREE(lic) || BAD.test(file)) return null;
  return {
    src: ii.thumburl || ii.url,
    page: ii.descriptionurl,
    artist: strip(ii.extmetadata?.Artist?.value).slice(0, 80) || undefined,
    license: lic,
    file,
  };
}

async function wikiPageImage(lang, title) {
  const d = await api(`${lang}.wikipedia.org`, {
    action: 'query',
    prop: 'pageimages',
    piprop: 'name',
    redirects: '1',
    titles: title,
  });
  const pg = d.query?.pages?.[0];
  if (!pg || pg.missing) return null;
  const file = pg.pageimage?.replace(/_/g, ' ');
  if (!file || BAD.test(file)) return null;
  return commonsFileMeta(file);
}

async function commonsSearch(name) {
  const d = await api('commons.wikimedia.org', {
    action: 'query',
    generator: 'search',
    gsrsearch: `${name} Costa Rica`,
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '1280',
    iiextmetadatafilter: 'Artist|LicenseShortName',
  });
  for (const pg of d.query?.pages || []) {
    const file = (pg.title || '').replace(/^File:/, '');
    const ii = pg.imageinfo?.[0];
    const lic = strip(ii?.extmetadata?.LicenseShortName?.value);
    if (!ii || !FREE(lic) || BAD.test(file) || !nameMatchesTitle(name, file)) continue;
    if (!/jpeg|png|webp/i.test(ii.mime || '')) continue;
    return {
      src: ii.thumburl || ii.url,
      page: ii.descriptionurl,
      artist: strip(ii.extmetadata?.Artist?.value).slice(0, 80) || undefined,
      license: lic,
      file,
    };
  }
  return null;
}

async function optimize(buf, baseId) {
  const meta = await sharp(buf).rotate().metadata();
  let bytes800 = 0;
  for (const { tag, w, q } of SIZES) {
    let pipe = sharp(buf).rotate();
    if ((meta.width || 0) > w) pipe = pipe.resize({ width: w, withoutEnlargement: true });
    const out = path.join(MEDIA, `${baseId}-${tag}.webp`);
    const info = await pipe.webp({ quality: q, effort: 4 }).toFile(out);
    if (tag === 800) bytes800 = info.size;
  }
  return { local: `/media/places/${baseId}-800.webp`, bytes: bytes800 };
}

async function download(src, baseId) {
  const existing = path.join(MEDIA, `${baseId}-800.webp`);
  if (fs.existsSync(existing)) return { local: `/media/places/${baseId}-800.webp`, bytes: fs.statSync(existing).size, cached: true };
  const candidates = [src];
  if (/\/thumb\/.+\/\d+px-/.test(src)) {
    candidates.unshift(src.replace(/\/(\d+)px-/, '/1280px-'));
  }
  let lastErr;
  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*,*/*' }, signal: AbortSignal.timeout(90000) });
      if (!r.ok) {
        lastErr = new Error('HTTP ' + r.status);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 800) {
        lastErr = new Error('tiny');
        continue;
      }
      return optimize(buf, baseId);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('dl fail');
}

const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/atlas.json'), 'utf8'));
const photos = JSON.parse(fs.readFileSync(PHOTOS, 'utf8'));
photos.found ||= {};
photos.checked ||= {};

let todo = atlas.places
  .filter((p) => !p.img?.src && !photos.found[p.id]?.src?.startsWith('/media/') && !SKIP.has(p.cat) && (photos.checked[p.id] || 0) < 4)
  .filter((p) => !ONLY_WIKI || p.wiki?.es || p.wiki?.en)
  .sort((a, b) => (CAT_PRIO[a.cat] ?? 50) - (CAT_PRIO[b.cat] ?? 50) || String(a.id).localeCompare(b.id));
if (Number.isFinite(LIMIT)) todo = todo.slice(0, LIMIT);

console.log(JSON.stringify({ missingQueue: todo.length, skip: [...SKIP], limit: LIMIT, onlyWiki: ONLY_WIKI }, null, 2));

const st = { ok: 0, fail: 0, wiki: 0, commons: 0 };
const save = () => fs.writeFileSync(PHOTOS, JSON.stringify(photos));

for (let i = 0; i < todo.length; i++) {
  const p = todo[i];
  let meta = null;
  let how = '';
  try {
    if (p.wiki?.es) {
      meta = await wikiPageImage('es', p.wiki.es);
      if (meta) how = 'wiki-es';
    }
    if (!meta && p.wiki?.en) {
      meta = await wikiPageImage('en', p.wiki.en);
      if (meta) how = 'wiki-en';
    }
    if (!meta && p.name?.es) {
      meta = await commonsSearch(p.name.es);
      if (meta) how = 'commons-search';
    }
  } catch (e) {
    console.log('api err', p.id, e.message);
  }

  photos.checked[p.id] = (photos.checked[p.id] || 0) + 1;
  if (!meta) {
    st.fail++;
    if ((i + 1) % 20 === 0) {
      save();
      console.log(`progress ${i + 1}/${todo.length} ok=${st.ok} fail=${st.fail}`);
    }
    continue;
  }

  try {
    const baseId = createHash('sha1').update(p.id).digest('hex').slice(0, 10);
    const dl = await download(meta.src, baseId);
    photos.found[p.id] = {
      src: dl.local,
      page: meta.page,
      artist: meta.artist,
      license: meta.license,
      how: 'fase-b-' + how,
      remote: meta.src,
    };
    st.ok++;
    if (how.startsWith('wiki')) st.wiki++;
    else st.commons++;
    console.log('ok', p.id, how, '->', dl.local);
  } catch (e) {
    st.fail++;
    console.log('dl fail', p.id, e.message);
  }

  if (st.ok % 5 === 0 || (i + 1) % 20 === 0) {
    save();
    console.log(`progress ${i + 1}/${todo.length} ok=${st.ok} fail=${st.fail}`);
  }
}

save();
console.log(JSON.stringify({ ...st, foundTotal: Object.keys(photos.found).length }, null, 2));
console.log('Listo. Corré pnpm build-data y pnpm sync-media:upload.');
