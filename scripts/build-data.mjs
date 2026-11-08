// Genera public/data/atlas.json: un solo archivo compacto con lugares (curados + Wikidata + enriquecimiento),
// provincias y ZEE, más public/data/geoms.json con los trazados (diferido). Coordenadas a 5 decimales (~1 m) y geometrías simplificadas (Douglas-Peucker).
// Lee data/ (no se publica) y se ejecuta antes de `pnpm run dev` y `pnpm run build` (predev / prebuild).
import fs from 'node:fs';
import { fillDesc } from './fill-desc.mjs';
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

const curated = rd('places.json'), wd = rd('places-wd.json', []), extra = rd('enrich.json', {});
const addedRaw = rd('places-extra.json', []);
const faunaRaw = rd('fauna-extra.json', []);
const faunaMeta = rd('fauna-meta.json', {});
const visitorInfo = rd('visitor-info.json', {});
const geoms = {};
// OpenStreetMap (opcional: `npm run fetch-osm`). Sin el archivo, todo sigue igual.
const osmRaw = rd('places-osm.json', { places: [] });
// fotos libres encontradas por `npm run fetch-photos` (solo para lugares sin foto)
const NICK = JSON.parse(fs.readFileSync(new URL('./data/nicknames.json', import.meta.url), 'utf8'));
const photos = rd('photos.json', { found: {} }).found || {};
const hand = rd('photos-hand.json', {});
const norm = (x) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const nameKey = (x) => norm(x).replace(/\b(soda|restaurante|restaurant|mercado|municipal|catarata|cataratas|salto|waterfall|playa|beach|mirador|sitio|arqueologico|monumento|nacional|de|del|la|el|los|las|y)\b/g, '').replace(/[^a-z0-9]/g, '');
const km = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const CAPS = { surf: 70, gastronomia: 140, cataratas: 90, arqueologia: 40, cerros: 30 }; // tope por categoría (OSM)
function mergeOsm(base, list) {
  const out = [], n = {}, skipped = { dup: 0, cap: 0, bad: 0 };
  const pool = base.map((p) => ({ lat: p.lat, lng: p.lng, k: nameKey(p.name?.es || p.name?.en), cat: p.cat, q: p.q, ref: p }));
  const merged = [];
  const qids = new Set(base.map((p) => p.q).filter(Boolean));
  for (const p of list) {
    if (!p?.name?.es || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !CAPS[p.cat]) { skipped.bad++; continue; }
    const k = nameKey(p.name.es);
    // spot de surf sobre una playa del mapa (mismo nombre a < 1,5 km, o cualquier playa a < 300 m):
    // un solo marcador, la playa, que además sale en el filtro Surf
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
    // un spot de surf convive con la playa homónima (otra categoría y otro filtro): solo se compara con otros spots
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

/** Lugares curados extra (data/places-extra.json): se suman si no duplican id/qid/nombre cercano */
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
      // fauna puede compartir pin con un parque ancla; no tratarlo como dup de edificio
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
  // photos-hand siempre gana (correcciones curadas, p.ej. P18 de Wikidata mal asignada)
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
  if (filled) q.desc = filled;
  if (q.geometry) { geoms[q.id] = geom(q.geometry, 0.0003, 5); delete q.geometry; } // ~30 m, va aparte
  return q;
});
const fc = (f, tol) => { const g = rd(f); g.features = g.features.map((ft) => ({ ...ft, geometry: geom(ft.geometry, tol, 4) })); return g; };
const provFc = fc('provinces.geojson', 0.0012);
provFc.features.forEach((ft) => { const n = NICK.provinces[ft.properties.id]; if (n) ft.properties.nick = n; });
const atlas = { v: 1, places, provinces: provFc, eez: fc('eez.geojson', 0.001) };
const out = JSON.stringify(atlas);
fs.writeFileSync(new URL('atlas.json', OUT), out);
// trazados de rutas y áreas: archivo aparte que se pide cuando el mapa ya está listo
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
