import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillDesc } from './fill-desc.mjs';
import { km, norm } from './shared.mjs';
const SRC = new URL('../data/', import.meta.url);
const OUT = new URL('../public/data/', import.meta.url);
const rd = (f, opt) => { try { return JSON.parse(fs.readFileSync(new URL(f, SRC), 'utf8')); } catch (e) { if (opt) return opt; throw e; } };
const r = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

function dp(pts, tol) { // Douglas-Peucker (en grados)
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy; let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i]; let t = L ? ((x - x1) * dx + (y - y1) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const ex = x1 + t * dx - x, ey = y1 + t * dy - y, d = ex * ex + ey * ey;
      if (d > md) { md = d; mi = i; }
    }
    if (mi > 0 && md > tol * tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const line = (c, tol, d, ring) => {
  let o = dp(c, tol).map(([x, y]) => [r(x, d), r(y, d)]);
  if (ring && o.length < 4) o = c.map(([x, y]) => [r(x, d), r(y, d)]); // no romper anillos pequeños
  return o;
};
function geom(g, tol, d) {
  if (!g) return g;
  switch (g.type) {
    case 'Point': return { type: g.type, coordinates: g.coordinates.map((v) => r(v, d)) };
    case 'LineString': return { type: g.type, coordinates: line(g.coordinates, tol, d) };
    case 'MultiLineString': case 'Polygon': return { type: g.type, coordinates: g.coordinates.map((c) => line(c, tol, d, g.type === 'Polygon')) };
    case 'MultiPolygon': return { type: g.type, coordinates: g.coordinates.map((p) => p.map((c) => line(c, tol, d, true))) };
    default: return g;
  }
}
const cleanUrl = (u) => (typeof u === 'string' ? u.replace(/\?utm_[^#]*$/, '') : u);

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STAMP = new URL('./.data-stamp', import.meta.url);
const INPUTS = [
  'scripts/build-data.mjs',
  'scripts/fill-desc.mjs',
  'scripts/shared.mjs',
  'scripts/data/briefs.json',
  'scripts/data/nicknames.json',
  'data/places.json',
  'data/places-wd.json',
  'data/enrich.json',
  'data/places-extra.json',
  'data/fauna-extra.json',
  'data/fauna-meta.json',
  'data/visitor-info.json',
  'data/places-osm.json',
  'data/photos.json',
  'data/photos-hand.json',
  'data/provinces.geojson',
  'data/eez.geojson',
];
function inputStamp() {
  const h = crypto.createHash('sha256');
  for (const f of INPUTS) {
    h.update(f);
    h.update('\0');
    try { h.update(fs.readFileSync(path.join(ROOT, f))); }
    catch { h.update('missing'); }
  }
  return h.digest('hex');
}
const stamp = inputStamp();
if (process.env.FORCE_BUILD_DATA !== '1') {
  try {
    const prev = fs.readFileSync(STAMP, 'utf8').trim();
    const outs = ['atlas.json', 'geoms.json', 'share.json'].every((f) => fs.existsSync(new URL(f, OUT)));
    if (prev === stamp && outs) {
      console.log(`atlas al día (${stamp.slice(0, 12)}), se omite build-data`);
      process.exit(0);
    }
  } catch {}
}

const curated = rd('places.json'), wd = rd('places-wd.json', []), extra = rd('enrich.json', {});
const addedRaw = rd('places-extra.json', []);
const faunaRaw = rd('fauna-extra.json', []);
const faunaMeta = rd('fauna-meta.json', {});
const visitorInfo = rd('visitor-info.json', {});
const geoms = {};
const osmRaw = rd('places-osm.json', { places: [] });
const NICK = JSON.parse(fs.readFileSync(new URL('./data/nicknames.json', import.meta.url), 'utf8'));
const photos = rd('photos.json', { found: {} }).found || {};
const hand = rd('photos-hand.json', {});
const nameKey = (x) => norm(x).replace(/\b(soda|restaurante|restaurant|mercado|municipal|catarata|cataratas|salto|waterfall|playa|beach|mirador|sitio|arqueologico|monumento|nacional|de|del|la|el|los|las|y)\b/g, '').replace(/[^a-z0-9]/g, '');
const CAPS = { surf: 70, gastronomia: 140, cataratas: 90, arqueologia: 40, cerros: 30 }; // tope por categoría (OSM)
function mergeOsm(base, list) {
  const out = [], n = {}, skipped = { dup: 0, cap: 0, bad: 0 };
  const pool = base.map((p) => ({ lat: p.lat, lng: p.lng, k: nameKey(p.name?.es || p.name?.en), cat: p.cat, q: p.q, ref: p }));
  const merged = [];
  const qids = new Set(base.map((p) => p.q).filter(Boolean));
  for (const p of list) {
    if (!p?.name?.es || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !CAPS[p.cat]) { skipped.bad++; continue; }
    const k = nameKey(p.name.es);
    if (p.cat === 'surf') {
      const bk = nameKey(p.beach || p.name.es);
      const beach = pool.filter((o) => o.cat === 'playas' && o.ref).map((o) => ({ o, d: km(o, p) }))
        .filter(({ o, d }) => d < 0.3 || (o.k && o.k === bk && d < 1.5)).sort((a, b) => a.d - b.d)[0];
      if (beach) {
        const b = beach.o.ref;
        b.also = [...new Set([...(b.also || []), 'surf'])];
        b.surf = { ...(p.name.es !== (b.name?.es || '') && !nameKey(b.name?.es).includes(nameKey(p.name.es)) ? { name: p.name.es } : {}), osm: p.osm };
        merged.push(`${p.name.es} → ${b.name?.es} (${Math.round(beach.d * 1000)} m)`);
        continue;
      }
    }
    const dup = (p.q && qids.has(p.q) && p.cat !== 'surf') || pool.some((o) => {
      if (p.cat === 'surf' && o.cat !== 'surf') return false;
      const d = km(o, p);
      if (d < 0.08) return true; // mismo punto
      if (!k || !o.k) return false;
      const same = o.k === k || (k.length > 4 && o.k.length > 4 && (o.k.includes(k) || k.includes(o.k)));
      return same && d < (p.cat === 'gastronomia' ? 0.4 : 3);
    });
    if (dup) { skipped.dup++; continue; }
    if ((n[p.cat] = (n[p.cat] || 0) + 1) > CAPS[p.cat]) { skipped.cap++; continue; }
    pool.push({ lat: p.lat, lng: p.lng, k, cat: p.cat });
    if (p.q) qids.add(p.q);
    out.push({ ...p, src: 'osm' });
  }
  if (merged.length) console.log(`surf: ${merged.length} spots fusionados con su playa:\n  ` + merged.join('\n  '));
  if (list.length) console.log(`places-osm.json: ${out.length} nuevos de ${list.length} (duplicados ${skipped.dup}, sobre el tope ${skipped.cap}, inválidos ${skipped.bad})`);
  return out;
}
const osm = mergeOsm([...curated, ...wd], Array.isArray(osmRaw) ? osmRaw : osmRaw.places || []);

function mergeAdded(base, list) {
  const out = [];
  const ids = new Set(base.map((p) => p.id));
  const qids = new Set(base.map((p) => p.q).filter(Boolean));
  const pool = base.map((p) => ({ lat: p.lat, lng: p.lng, k: nameKey(p.name?.es || p.name?.en), cat: p.cat }));
  let skipped = 0;
  for (const p of list || []) {
    if (!p?.id || !p?.name?.es || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) { skipped++; continue; }
    if (ids.has(p.id) || (p.q && qids.has(p.q))) { skipped++; continue; }
    const k = nameKey(p.name.es);
    const faunaish = (c) => c === 'fauna' || c === 'faunaTerrestre';
    const dup = pool.some((o) => {
      const d = km(o, p);
      if (d < 0.025 && !faunaish(p.cat) && !faunaish(o.cat)) return true;
      if (!k || !o.k) return false;
      const same = o.k === k || (k.length > 4 && o.k.length > 4 && (o.k.includes(k) || k.includes(o.k)));
      return same && d < 2.5;
    });
    if (dup) { skipped++; continue; }
    ids.add(p.id);
    if (p.q) qids.add(p.q);
    pool.push({ lat: p.lat, lng: p.lng, k, cat: p.cat });
    out.push(p);
  }
  if ((list || []).length) console.log(`places-extra.json: ${out.length} nuevos de ${(list || []).length} (omitidos ${skipped})`);
  return out;
}
const added = mergeAdded([...curated, ...wd, ...osm], Array.isArray(addedRaw) ? addedRaw : []);
const faunaAdded = mergeAdded([...curated, ...wd, ...osm, ...added], Array.isArray(faunaRaw) ? faunaRaw : []);
if (faunaAdded.length) console.log(`fauna-extra.json: ${faunaAdded.length} especies nuevas`);

const places = [...curated, ...wd, ...osm, ...added, ...faunaAdded].map((p) => {
  const q = { ...p, lat: r(p.lat, 5), lng: r(p.lng, 5) };
  const x = extra[p.id];
  if (x) { q.x = { ...x }; if (x.img) q.x.img = { ...x.img, src: cleanUrl(x.img.src) }; if (!q.img && x.img) q.img = q.x.img; }
  if (hand[p.id]) q.img = { ...hand[p.id] };
  else if (!q.img && photos[p.id]) q.img = { ...photos[p.id] };
  if (q.img) q.img = { ...q.img, src: cleanUrl(q.img.src) };
  if (NICK.places[p.id]) q.nick = NICK.places[p.id]; // apodo y gentilicio con fuente
  const fm = faunaMeta[p.id];
  if (fm) {
    if (fm.related?.length) q.related = fm.related.filter(Boolean);
    if (fm.tips) q.tips = fm.tips;
    if (fm.group) q.group = fm.group;
  }
  if (visitorInfo[p.id]) q.visit = visitorInfo[p.id];
  const filled = fillDesc(q);
  if (filled) {
    const { src, ...desc } = filled;
    q.desc = desc;
    if (src?.url) q.descSrc = src;
  }
  if (q.geometry) { geoms[q.id] = geom(q.geometry, 0.0003, 5); delete q.geometry; } // ~30 m, va aparte
  return q;
});
const fc = (f, tol) => { const g = rd(f); g.features = g.features.map((ft) => ({ ...ft, geometry: geom(ft.geometry, tol, 4) })); return g; };
const provFc = fc('provinces.geojson', 0.0012);
provFc.features.forEach((ft) => { const n = NICK.provinces[ft.properties.id]; if (n) ft.properties.nick = n; });
const atlas = { v: 1, places, provinces: provFc, eez: fc('eez.geojson', 0.001) };
const out = JSON.stringify(atlas);
fs.writeFileSync(new URL('atlas.json', OUT), out);
const g = JSON.stringify(geoms);
fs.writeFileSync(new URL('geoms.json', OUT), g);
console.log(`geoms.json: ${Object.keys(geoms).length} trazados, ${(g.length / 1024).toFixed(0)} KB`);
console.log(`atlas.json: ${places.length} lugares, ${(out.length / 1024).toFixed(0)} KB`);
const count = new Map();
const ids = new Set(places.map((p) => p.id));
const strip = (id) => { const i = id.indexOf('-'); return i > 0 ? id.slice(i + 1) : id; };
places.forEach((p) => count.set(strip(p.id), (count.get(strip(p.id)) || 0) + 1));
const share = {};
for (const p of places) {
  const s = strip(p.id);
  const slug = count.get(s) === 1 && !ids.has(s) ? s : p.id;
  share[slug] = { t: p.name.es, d: String(p.desc?.es || '').replace(/\s+/g, ' ').slice(0, 180), i: p.img?.src || '' };
}
fs.writeFileSync(new URL('share.json', OUT), JSON.stringify(share));
console.log(`share.json: ${Object.keys(share).length} fichas`);
fs.writeFileSync(STAMP, stamp + '\n');
