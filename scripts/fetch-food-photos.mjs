import fs from 'node:fs';
import { commonsMeta, fileMeta, mw } from './wiki.mjs';
import { dishKey } from './local-dishes.mjs';

const SKIP = new Set(['salsa lizano', 'crema', 'trucha', 'queso fresco', 'pescado frito', 'prestinos', 'pastelillos', 'chorreadas', 'pozol', 'agua dulce', 'arroz de maiz', 'agua de sapo', 'torrejas']);
const FREE = /cc |cc-|cc0|public domain|gfdl|pdm/i;
const UNFREE = /non-free|all rights reserved|fair use/i;
const REJECT = /mexico|mexicano|tabasco|apollo|nasa|earth|bandera|logo|escudo|mapa |diagrama/;
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'of', 'and', 'the']);

const free = (l) => !!l && !UNFREE.test(l) && FREE.test(l);
const stem = (s) => s.replace(/ de costa rica$/, '').replace(/s$/, '');
const close = (page, name) => {
  const a = dishKey(page);
  const b = dishKey(name);
  if (!a || !b || b.length < 5) return false;
  return a === b || stem(a) === stem(b);
};
const wordsOf = (name) => dishKey(name).split(' ').filter((w) => w.length > 3 && !STOP.has(w));
const fileOk = (file, name) => {
  const f = dishKey(file);
  if (!f || REJECT.test(f)) return false;
  const words = wordsOf(name);
  if (!words.length) return false;
  return words.every((w) => f.includes(w) || f.includes(stem(w)));
};

const content = JSON.parse(fs.readFileSync(new URL('../public/data/provinces-content.json', import.meta.url), 'utf8'));
let previous = {};
try { previous = JSON.parse(fs.readFileSync(new URL('./data/food-photos.json', import.meta.url), 'utf8')); } catch {}
const previousSrc = new Set(Object.values(previous).map((img) => img.src));
const forget = (item) => { if (item?.img && previousSrc.has(item.img.src)) delete item.img; };
for (const p of Object.values(content.provinces)) for (const i of p.food?.items || []) forget(i);
for (const i of content.national?.food || []) forget(i);
const missing = new Map();
const consider = (item) => {
  const name = typeof item.name === 'string' ? item.name : item.name?.es;
  if (!name || item.img) return;
  const k = dishKey(name);
  if (!k || SKIP.has(k) || missing.has(k)) return;
  missing.set(k, { name, qid: item.qid });
};

for (const p of Object.values(content.provinces)) for (const i of p.food?.items || []) consider(i);
for (const i of content.national?.food || []) consider(i);

const byFile = new Map();
const qids = [...missing.values()].map((m) => m.qid).filter(Boolean);
for (let i = 0; i < qids.length; i += 40) {
  const d = await mw('www.wikidata.org', { action: 'wbgetentities', ids: qids.slice(i, i + 40).join('|'), props: 'claims' });
  for (const [id, e] of Object.entries(d.entities || {})) {
    const file = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    const hit = [...missing.entries()].find(([, m]) => m.qid === id);
    if (file && hit) byFile.set(hit[0], { file, via: 'wikidata' });
  }
}

for (const [k, m] of missing) {
  if (byFile.has(k)) continue;
  const d = await mw('es.wikipedia.org', { action: 'query', list: 'search', srsearch: m.name, srlimit: '4', srnamespace: '0' });
  const page = (d.query?.search || []).map((s) => s.title).find((t) => close(t, m.name));
  if (!page) continue;
  const pi = await mw('es.wikipedia.org', { action: 'query', prop: 'pageimages', piprop: 'name', redirects: '1', titles: page });
  const file = pi.query?.pages?.[0]?.pageimage?.replace(/_/g, ' ');
  if (file && fileOk(file, m.name)) byFile.set(k, { file, via: page });
}

for (const [k, m] of missing) {
  if (byFile.has(k)) continue;
  const d = await mw('commons.wikimedia.org', {
    action: 'query', generator: 'search', gsrsearch: m.name, gsrnamespace: '6', gsrlimit: '8',
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '960', iiextmetadatafilter: 'Artist|LicenseShortName',
  });
  const pages = d.query?.pages || [];
  const costa = (t) => /costa|costarric|tico|talamanca|limon|guanacaste|puntarenas|cartago/.test(dishKey(t));
  const hits = pages.filter((p) => /jpeg|png|webp/.test(p.imageinfo?.[0]?.mime || '') && fileOk(p.title, m.name));
  hits.sort((a, b) => Number(costa(b.title)) - Number(costa(a.title)));
  const page = hits[0];
  const ii = page?.imageinfo?.[0];
  const license = ii?.extmetadata?.LicenseShortName?.value?.replace(/<[^>]+>/g, '');
  if (!ii || !free(license)) continue;
  const file = page.title.replace(/^File:/, '');
  fileMeta.set(file, { src: ii.thumburl || ii.url, page: ii.descriptionurl, artist: (ii.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80), license });
  byFile.set(k, { file, via: 'commons:' + file });
}

await commonsMeta([...byFile.values()].map((v) => v.file));
const photos = {};
for (const [k, v] of byFile) {
  const img = fileMeta.get(v.file);
  if (!img || !free(img.license)) {
    console.log('skip', k, v.via, v.file, img?.license || 'sin licencia libre');
    continue;
  }
  photos[k] = img;
  console.log('ok', k, '←', v.via, '·', img.license);
}

const out = new URL('./data/food-photos.json', import.meta.url);
fs.mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
fs.writeFileSync(out, JSON.stringify(photos));
let n = 0;
const stamp = (item) => {
  if (!item || item.img) return;
  const hit = photos[dishKey(typeof item.name === 'string' ? item.name : item.name?.es)];
  if (!hit) return;
  item.img = hit;
  n++;
};
for (const p of Object.values(content.provinces)) for (const i of p.food?.items || []) stamp(i);
for (const i of content.national?.food || []) stamp(i);
fs.writeFileSync(new URL('../public/data/provinces-content.json', import.meta.url), JSON.stringify(content));
console.log(`${Object.keys(photos).length} fotos, ${n} platos actualizados`);
