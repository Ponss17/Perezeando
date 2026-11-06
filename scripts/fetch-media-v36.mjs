#!/usr/bin/env node
/**
 * v36: fotos prioritarias de lugares + platos, alojadas en public/media (WebP/JPEG comprimido vía thumbs Wikimedia).
 * No inventa URLs: solo Commons/Wikipedia con licencia libre y coincidencia de nombre.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require(path.join(process.env.TEMP || '/tmp', 'pz-imgopt/node_modules/sharp'));
} catch {
  try { sharp = require('sharp'); } catch { sharp = null; }
}

/** Guarda WebP 120/320/800 y devuelve la ruta canónica -800 (evita PNG/JPEG pesados). */
async function optimizeLocalImage(buf, destDir, baseId) {
  fs.mkdirSync(destDir, { recursive: true });
  if (!sharp) {
    const dest = path.join(destDir, baseId + '-800.jpg');
    fs.writeFileSync(dest, buf);
    return { local: '/media/' + path.relative(MEDIA, dest).split(path.sep).join('/'), bytes: buf.length };
  }
  const meta = await sharp(buf).rotate().metadata();
  const sizes = [
    { tag: 120, w: 120, q: 72 },
    { tag: 320, w: 320, q: 74 },
    { tag: 800, w: 800, q: 78 },
  ];
  let bytes800 = 0;
  for (const { tag, w, q } of sizes) {
    let pipe = sharp(buf).rotate();
    if ((meta.width || 0) > w) pipe = pipe.resize({ width: w, withoutEnlargement: true });
    const out = path.join(destDir, `${baseId}-${tag}.webp`);
    const info = await pipe.webp({ quality: q, effort: 6 }).toFile(out);
    if (tag === 800) bytes800 = info.size;
  }
  const dest = path.join(destDir, `${baseId}-800.webp`);
  return { local: '/media/' + path.relative(MEDIA, dest).split(path.sep).join('/'), bytes: bytes800 };
}


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'PerezeandoContentBot/1.0 (https://perezeando.com; mapa de Costa Rica; build-time fetch)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function api(host, params, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const wait = 750 - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const r = await fetch(`https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params }), {
        headers: { 'User-Agent': UA, 'Api-User-Agent': UA },
        signal: AbortSignal.timeout(60000),
      });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}
const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const FREE = (l) => /^(cc0|cc[- ]by(-sa)?( \d(\.\d)?)?|public domain|pd\b|dominio p)/i.test(l || '') && !/nc|nd/i.test(l || '');
const BAD = /\b(map|mapa|location|locator|logo|escudo|coat|flag|bandera|diagram|diagrama|plano|icon|svg|selfie|portrait|retrato)\b/i;
const dishKey = (s) => norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const MEDIA = path.join(ROOT, 'public', 'media');
const PLACES_DIR = path.join(MEDIA, 'places');
const FOOD_DIR = path.join(MEDIA, 'food');
fs.mkdirSync(PLACES_DIR, { recursive: true });
fs.mkdirSync(FOOD_DIR, { recursive: true });

async function downloadThumb(src, destBase) {
  const clean = String(src).replace(/\?utm_[^#]*$/, '');
  const candidates = [clean];
  if (/\/thumb\/.+\/\d+px-/.test(clean)) {
    candidates.push(clean.replace(/\/(\d+)px-/, '/500px-'));
    candidates.push(clean.replace(/\/(\d+)px-/, '/320px-'));
  }
  let lastErr = null;
  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(90000),
      });
      if (!r.ok) {
        lastErr = new Error('dl ' + r.status);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 800) {
        lastErr = new Error('tiny');
        continue;
      }
      const baseId = path.basename(destBase);
      const destDir = path.dirname(destBase);
      const opt = await optimizeLocalImage(buf, destDir, baseId);
      return { ...opt, src: url };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('dl fail');
}

async function commonsFileMeta(file) {
  const d = await api('commons.wikimedia.org', {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '640',
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
    prop: 'pageimages|pageprops',
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

function nameMatchesTitle(placeName, title) {
  const a = norm(placeName).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
  const b = norm(title);
  const hits = a.filter((w) => b.includes(w));
  return hits.length >= Math.min(2, a.length) || (a[0] && b.includes(a[0]) && a.length <= 2);
}

// ---------- clean bad wiki.es ----------
const wdPath = path.join(ROOT, 'data', 'places-wd.json');
const wd = JSON.parse(fs.readFileSync(wdPath, 'utf8'));
let wikiClean = 0;
for (const p of wd) {
  if (!p.wiki?.es || !p.name?.es) continue;
  if (!nameMatchesTitle(p.name.es, p.wiki.es) && !norm(p.wiki.es).includes(norm(p.name.es).slice(0, 8))) {
    // keep if it's a known alias pattern parque nacional X
    const pn = norm(p.name.es);
    const wt = norm(p.wiki.es);
    if (wt.includes(pn) || pn.includes(wt.replace(/parque nacional |refugio |reserva /g, '').slice(0, 12))) continue;
    delete p.wiki.es;
    wikiClean++;
  }
}
fs.writeFileSync(wdPath, JSON.stringify(wd) + '\n');
console.log('wiki.es cleaned', wikiClean);

// ---------- places priority ----------
const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/atlas.json'), 'utf8'));
const photosPath = path.join(ROOT, 'data', 'photos.json');
const photos = JSON.parse(fs.readFileSync(photosPath, 'utf8'));
photos.found = photos.found || {};
photos.checked = photos.checked || {};

const PRIO = new Set(['parques', 'volcanes', 'museos', 'hitos', 'playas', 'bosques', 'iglesias', 'arqueologia', 'ciudades', 'deportes']);
const missing = atlas.places.filter((p) => !p.img?.src && !photos.found[p.id] && (PRIO.has(p.cat) || String(p.id).startsWith('ext-')));
missing.sort((a, b) => Number(String(b.id).startsWith('ext-')) - Number(String(a.id).startsWith('ext-')) || (a.cat > b.cat ? 1 : -1));
const LIMIT = Number(process.env.PHOTO_LIMIT || 70);
const todo = missing.slice(0, LIMIT);
console.log('place candidates', missing.length, 'processing', todo.length);

let placeOk = 0, placeFail = 0;
for (const p of todo) {
  let meta = null;
  try {
    if (p.wiki?.es) meta = await wikiPageImage('es', p.wiki.es);
    if (!meta && p.wiki?.en) meta = await wikiPageImage('en', p.wiki.en);
    if (!meta && p.name?.es) {
      const d = await api('commons.wikimedia.org', {
        action: 'query',
        generator: 'search',
        gsrsearch: p.name.es + ' Costa Rica',
        gsrnamespace: '6',
        gsrlimit: '8',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|mime',
        iiurlwidth: '640',
        iiextmetadatafilter: 'Artist|LicenseShortName',
      });
      for (const pg of d.query?.pages || []) {
        const file = (pg.title || '').replace(/^File:/, '');
        const ii = pg.imageinfo?.[0];
        const lic = strip(ii?.extmetadata?.LicenseShortName?.value);
        if (!ii || !FREE(lic) || BAD.test(file) || !nameMatchesTitle(p.name.es, file)) continue;
        meta = {
          src: ii.thumburl || ii.url,
          page: ii.descriptionurl,
          artist: strip(ii.extmetadata?.Artist?.value).slice(0, 80) || undefined,
          license: lic,
          file,
        };
        break;
      }
    }
  } catch (e) {
    console.log('err', p.id, e.message);
  }
  photos.checked[p.id] = (photos.checked[p.id] || 0) + 1;
  if (!meta) {
    placeFail++;
    continue;
  }
  try {
    const hash = createHash('sha1').update(p.id).digest('hex').slice(0, 10);
    const dl = await downloadThumb(meta.src, path.join(PLACES_DIR, hash));
    photos.found[p.id] = {
      src: dl.local,
      page: meta.page,
      artist: meta.artist,
      license: meta.license,
      how: 'v36-local',
      remote: meta.src,
    };
    placeOk++;
    console.log('place ok', p.id, '->', dl.local, dl.bytes);
  } catch (e) {
    console.log('dl fail', p.id, e.message);
    placeFail++;
  }
  if (placeOk % 8 === 0) fs.writeFileSync(photosPath, JSON.stringify(photos));
}
fs.writeFileSync(photosPath, JSON.stringify(photos));
console.log({ placeOk, placeFail, foundTotal: Object.keys(photos.found).length });

// ---------- food ----------
const foodPhotosPath = path.join(ROOT, 'scripts/data/food-photos.json');
const foodPhotos = JSON.parse(fs.readFileSync(foodPhotosPath, 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/provinces-content.json'), 'utf8'));

const FOOD_QUERIES = {
  'picadillo de chicasquil': ['Picadillo de chicasquil', 'chicasquil'],
  'cafe de tarrazu': ['Café de Tarrazú', 'Cafe Tarrazu'],
  'caramelos de chiverre': ['Caramelos de chiverre', 'chiverre'],
  prestinos: ['Prestíños', 'Prestinos Costa Rica'],
  pastelillos: ['Pastelillo Costa Rica', 'Pastelillos Alajuela'],
  chorreadas: ['Chorreadas', 'Chorreadas Costa Rica'],
  'picadillo de arracache': ['Picadillo de arracache', 'arracache'],
  pozol: ['Pozol Costa Rica', 'Pozol'],
  torrejas: ['Torrejas Costa Rica', 'Torreja'],
  'picadillo de palmito': ['Picadillo de palmito'],
  'flor de itabo': ['Flor de itabo', 'Itabo'],
  'agua dulce': ['Agua dulce Costa Rica', 'Agua dulce panela'],
  perrerreque: ['Perrerreque'],
  yoltamal: ['Yoltamal'],
  'arroz de maiz': ['Arroz de maíz Costa Rica', 'Arroz de maiz'],
  'tamal guanacasteco': ['Tamal guanacasteco', 'Tamal de Guanacaste'],
  'vino de coyol': ['Vino de coyol', 'Coyol wine'],
  'arroz guacho': ['Arroz guacho'],
  cambute: ['Cambute', 'Strombus galeatus comida'],
  chuchecas: ['Chuchecas'],
  plantinta: ['Plantinta'],
  'rice and beans': ['Rice and beans Caribbean', 'Rice and beans Limón'],
  'pan bon': ['Pan bon Costa Rica'],
  pati: ['Patí Costa Rica', 'Pati limonense'],
};

async function findDishPhoto(name) {
  const k = dishKey(name);
  if (foodPhotos[k]?.src?.startsWith('/media/')) return null; // already local
  const queries = FOOD_QUERIES[k] || [name + ' Costa Rica', name];
  for (const q of queries) {
    const d = await api('commons.wikimedia.org', {
      action: 'query',
      generator: 'search',
      gsrsearch: q,
      gsrnamespace: '6',
      gsrlimit: '10',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime',
      iiurlwidth: '640',
      iiextmetadatafilter: 'Artist|LicenseShortName',
    });
    const words = dishKey(name).split(' ').filter((w) => w.length > 3);
    for (const pg of d.query?.pages || []) {
      const file = (pg.title || '').replace(/^File:/, '');
      const f = dishKey(file);
      const ii = pg.imageinfo?.[0];
      const lic = strip(ii?.extmetadata?.LicenseShortName?.value);
      if (!ii || !FREE(lic) || BAD.test(file)) continue;
      if (words.length && !words.every((w) => f.includes(w) || f.includes(w.replace(/s$/, '')))) continue;
      // prefer CR context when possible but don't require if exact dish words match
      return {
        src: ii.thumburl || ii.url,
        page: ii.descriptionurl,
        artist: strip(ii.extmetadata?.Artist?.value).slice(0, 80) || undefined,
        license: lic,
        file,
        key: k,
      };
    }
  }
  return null;
}

const missingFood = new Map();
const consider = (item) => {
  const name = typeof item.name === 'string' ? item.name : item.name?.es;
  if (!name || item.img?.src) return;
  const k = dishKey(name);
  if (!missingFood.has(k)) missingFood.set(k, name);
};
for (const p of Object.values(content.provinces || {})) for (const i of p.food?.items || []) consider(i);
for (const i of content.national?.food || []) consider(i);
// also re-host existing remote food photos that are shown
const rehost = [];
for (const p of Object.values(content.provinces || {})) {
  for (const i of p.food?.items || []) {
    if (i.img?.src && !String(i.img.src).startsWith('/media/') && /wikimedia\.org/.test(i.img.src)) {
      const name = typeof i.name === 'string' ? i.name : i.name?.es;
      rehost.push({ key: dishKey(name), img: i.img, name });
    }
  }
}
console.log('food missing', missingFood.size, 'rehost', rehost.length);

let foodOk = 0, foodFail = 0, foodHosted = 0;
for (const [k, name] of missingFood) {
  try {
    const meta = await findDishPhoto(name);
    if (!meta) {
      foodFail++;
      console.log('food miss', name);
      continue;
    }
    const dl = await downloadThumb(meta.src, path.join(FOOD_DIR, createHash('sha1').update(k).digest('hex').slice(0, 10)));
    foodPhotos[k] = { src: dl.local, page: meta.page, artist: meta.artist, license: meta.license, remote: meta.src };
    foodOk++;
    console.log('food ok', name, '->', dl.local);
  } catch (e) {
    foodFail++;
    console.log('food err', name, e.message);
  }
}
// rehost up to 40 existing remote food imgs for comida tabs
for (const row of rehost.slice(0, 40)) {
  if (foodPhotos[row.key]?.src?.startsWith('/media/')) continue;
  try {
    const dl = await downloadThumb(row.img.src, path.join(FOOD_DIR, createHash('sha1').update(row.key + '-h').digest('hex').slice(0, 10)));
    foodPhotos[row.key] = { ...row.img, src: dl.local, remote: row.img.src };
    foodHosted++;
    console.log('food host', row.name, dl.local);
  } catch (e) {
    console.log('food host fail', row.name, e.message);
  }
}
fs.writeFileSync(foodPhotosPath, JSON.stringify(foodPhotos, null, 2) + '\n');

// stamp provinces-content
const stamp = (item) => {
  const name = typeof item.name === 'string' ? item.name : item.name?.es;
  if (!name) return;
  const hit = foodPhotos[dishKey(name)];
  if (hit) item.img = { src: hit.src, page: hit.page, artist: hit.artist, license: hit.license };
};
for (const p of Object.values(content.provinces || {})) for (const i of p.food?.items || []) stamp(i);
for (const i of content.national?.food || []) stamp(i);
fs.writeFileSync(path.join(ROOT, 'public/data/provinces-content.json'), JSON.stringify(content));
console.log({ foodOk, foodFail, foodHosted, foodPhotos: Object.keys(foodPhotos).length });
