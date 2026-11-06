#!/usr/bin/env node
/**
 * Fotos libres para lugares sin foto → data/photos.json  (npm run fetch-photos)
 *
 * Orden, solo con resultados reales consultados:
 *  1. Wikidata P18 del lugar (qid propio, o etiqueta OSM wikidata=…)
 *  2. Wikidata por nombre + distancia (P625): < 500 m puntos, < 2 km cataratas/miradores/naturales
 *  3. Wikimedia Commons por coordenadas (list=geosearch, ns 6) cuyo título o descripción
 *     nombra el lugar (o, en cataratas, dice catarata/waterfall a < 300 m)
 * Siempre licencia libre (CC0, CC BY, CC BY-SA, dominio público) con autor y licencia.
 * Restaurantes y sodas: solo foto si es del propio lugar; si no, la app muestra un
 * marcador ilustrado de categoría (nunca una foto ajena como si fuera del lugar).
 *
 * Reejecutable: guarda lo encontrado y lo ya revisado; --refresh vuelve a buscar todo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public/data');
const SRC = path.join(ROOT, 'data');
const OUT = path.join(SRC, 'photos.json');
const UA = 'PerezeandoContentBot/1.0 (https://perezeando.com; mapa de Costa Rica; build-time fetch)';
const REFRESH = process.argv.includes('--refresh');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0) || Infinity;
const SKIP_CATS = new Set(
  (process.argv.find((a) => a.startsWith('--skip-cat=')) || '')
    .split('=')[1]
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || [],
);
/** Prioridad Fase B: primero hitos con foto libre probable; gastronomía al final. */
const CAT_PRIO = {
  volcanes: 0, parques: 1, museos: 2, iglesias: 3, playas: 4, cataratas: 5, cerros: 6, rios: 7,
  islas: 8, bosques: 9, arqueologia: 10, hitos: 11, deportes: 12, ciudades: 13, surf: 14,
  submarinas: 15, hitosOceanicos: 16, isras: 17, immas: 18, aeropuertos: 19, puertos: 20,
  datos: 21, gastronomia: 90,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[fotos]', ...a);

let last = 0;
async function api(host, params, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const wait = 700 - (Date.now() - last); // ~1,4 consultas/s como máximo
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const r = await fetch(`https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params }), { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.status === 429 || r.status >= 500) {
        const ra = +(r.headers.get('retry-after') || 0);
        await sleep(Math.min(120, Math.max(ra, 15 * (i + 1))) * 1000);
        throw new Error('HTTP ' + r.status);
      }
      const j = await r.json();
      if (j.error?.code === 'maxlag') {
        await sleep(Math.min(90000, 8000 * (i + 1)));
        throw new Error('maxlag');
      }
      return j;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(e.message === 'maxlag' ? 5000 * (i + 1) : 2500 * (i + 1));
    }
  }
}
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const km = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const FREE = (l) => /^(cc0|cc[- ]by(-sa)?( \d(\.\d)?)?|public domain|pd\b|dominio p)/i.test(l || '') && !/nc|nd/i.test(l || '');
const BAD = /\b(map|mapa|location|locator|logo|escudo|coat|flag|bandera|diagram|diagrama|plano|chart|grafico|portrait|retrato|selfie|signature|firma|icon|svg|sello|stamp|poster|afiche|document|screenshot)\b/i;
// radio de la búsqueda por coordenadas y distancia máxima de Wikidata (km) por tipo
const NATURAL = new Set(['cataratas', 'cerros', 'volcanes', 'bosques', 'rios', 'islas', 'playas', 'parques', 'surf', 'submarinas', 'hitosOceanicos', 'isras', 'immas', 'arqueologia']);
const RADIUS = (c) => (c === 'gastronomia' ? 100 : c === 'cataratas' || c === 'cerros' ? 400 : NATURAL.has(c) ? 500 : 250);
const WD_KM = (c) => (NATURAL.has(c) ? 2 : 0.5);
const CAT_WORDS = { cataratas: /catarata|waterfall|salto|cascada/, cerros: /mirador|view|vista|cerro|mountain|montana/, surf: /playa|beach|surf|wave|ola/, playas: /playa|beach/, rios: /rio|river/, volcanes: /volcan|volcano|crater/, arqueologia: /arqueolog|archaeolog|petroglif|esfera|sphere/, iglesias: /iglesia|church|templo|parroquia|catedral/ };
const GENERIC = new Set(['soda', 'restaurante', 'restaurant', 'mercado', 'municipal', 'catarata', 'cataratas', 'salto', 'waterfall', 'playa', 'beach', 'mirador', 'cerro', 'sitio', 'arqueologico', 'monumento', 'nacional', 'costa', 'rica', 'parque', 'refugio', 'vida', 'silvestre', 'reserva', 'biologica', 'forestal', 'zona', 'protectora', 'humedal', 'canton', 'distrito', 'provincia', 'centro', 'iglesia', 'surf', 'point', 'del', 'los', 'las', 'san', 'santa', 'santo', 'rio', 'isla']);
const tokens = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !GENERIC.has(w));

// ------------------------------------------------------------------ datos de partida
const rd = (dir, f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return d; } };
const atlas = rd(PUB, 'atlas.json');
if (!atlas) { console.error('Falta public/data/atlas.json: corre primero npm run build-data'); process.exit(1); }
const prev = REFRESH ? {} : rd(SRC, 'photos.json', {});
const found = { ...(prev.found || {}) }, checked = { ...(prev.checked || {}) };
let todo = atlas.places
  .filter((p) => !p.img?.src && !found[p.id] && (checked[p.id] || 0) < 3 && !SKIP_CATS.has(p.cat))
  .sort((a, b) => (CAT_PRIO[a.cat] ?? 50) - (CAT_PRIO[b.cat] ?? 50) || String(a.id).localeCompare(String(b.id)));
if (Number.isFinite(LIMIT)) todo = todo.slice(0, LIMIT);
const save = () => fs.writeFileSync(OUT, JSON.stringify({ v: 1, found, checked }));
const total = atlas.places.length, before = atlas.places.filter((p) => p.img?.src).length;
log(`${total} lugares; con foto ${before}; en photos.json ${Object.keys(found).length}; por revisar ${todo.length}${SKIP_CATS.size ? ` (skip ${[...SKIP_CATS]})` : ''}`);

// ---------------------------------------------------------------- metadatos de Commons
const meta = new Map();
async function commonsMeta(files) {
  for (const c of chunks([...new Set(files)].filter((f) => !meta.has(f)), 40)) {
    const d = await api('commons.wikimedia.org', { action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '960', iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription|ObjectName', titles: c.map((f) => 'File:' + f).join('|') });
    const back = new Map((d.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const pg of d.query?.pages || []) {
      const orig = (back.get(pg.title) || pg.title).replace(/^File:/, '');
      const ii = pg.imageinfo?.[0], em = ii?.extmetadata || {};
      const lic = strip(em.LicenseShortName?.value);
      if (!ii || !/jpeg|png|webp/.test(ii.mime || '') || !FREE(lic)) { meta.set(orig, null); continue; }
      meta.set(orig, { src: ii.thumburl || ii.url, page: ii.descriptionurl, artist: strip(em.Artist?.value).slice(0, 80) || undefined, license: lic, _desc: strip(em.ImageDescription?.value + ' ' + (em.ObjectName?.value || '')).slice(0, 400) });
    }
  }
}
async function p18(qids) {
  const out = {};
  for (const c of chunks([...new Set(qids)], 50)) {
    const d = await api('www.wikidata.org', { action: 'wbgetentities', ids: c.join('|'), props: 'claims|labels', languages: 'es|en' });
    for (const [id, e] of Object.entries(d.entities || {})) {
      const f = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      const co = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      out[id] = { file: f, lat: co?.latitude, lng: co?.longitude, label: e.labels?.es?.value || e.labels?.en?.value };
    }
  }
  return out;
}
const set = (p, file, how) => { const m = meta.get(file); if (!m) return false; const { _desc, ...img } = m; found[p.id] = { ...img, how }; return true; };

// --------------------------------------------------------------- 1. P18 del propio qid
const st = { p18: 0, wdname: 0, geo: 0, none: 0 };
const withQ = todo.filter((p) => p.q);
try {
  const ents = withQ.length ? await p18(withQ.map((p) => p.q)) : {};
  await commonsMeta(Object.values(ents).map((e) => e.file).filter(Boolean));
  for (const p of withQ) if (ents[p.q]?.file && set(p, ents[p.q].file, 'wikidata')) st.p18++;
} catch (err) {
  log('1) P18 interrumpido:', err.message, '— se sigue con nombre/geo');
  save();
}
log(`1) P18 por qid: ${st.p18}`);

// ------------------------------------------- 2. Wikidata por nombre + distancia
let i = 0;
for (const p of todo.filter((p) => !found[p.id] && (checked[p.id] || 0) < 2)) {
  if (++i % 25 === 0) { log(`2) ${i}…`); save(); }
  const name = p.name?.es || p.name?.en;
  checked[p.id] = 2;
  if (!tokens(name).length) continue;
  const ids = new Set();
  for (const lang of p.name?.en && p.name.en !== p.name.es ? ['es', 'en'] : ['es']) {
    const d = await api('www.wikidata.org', { action: 'wbsearchentities', search: name, language: lang, uselang: lang, type: 'item', limit: '7' }).catch(() => null);
    for (const s of d?.search || []) ids.add(s.id);
  }
  if (!ids.size) continue;
  let e;
  try { e = await p18([...ids]); } catch (err) { log('Wikidata:', err.message, '(se reintenta en la próxima corrida)'); delete checked[p.id]; save(); continue; }
  const tk = tokens(name);
  const hit = Object.entries(e)
    .filter(([, x]) => x.file && x.lat != null && km(p, x) < WD_KM(p.cat) && tk.some((w) => tokens(x.label).includes(w)))
    .sort((a, b) => km(p, a[1]) - km(p, b[1]))[0];
  if (!hit) continue;
  await commonsMeta([hit[1].file]);
  if (set(p, hit[1].file, 'wikidata-nombre')) { found[p.id].q = hit[0]; st.wdname++; }
}
log(`2) Wikidata por nombre: ${st.wdname}`);

// ------------------------------------------- 3. Commons por coordenadas
i = 0;
for (const p of todo.filter((p) => !found[p.id] && (checked[p.id] || 0) < 3)) {
  if (++i % 25 === 0) { log(`3) ${i}…`); save(); }
  const d = await api('commons.wikimedia.org', { action: 'query', list: 'geosearch', gscoord: `${p.lat}|${p.lng}`, gsradius: String(RADIUS(p.cat)), gsnamespace: '6', gslimit: '40' }).catch(() => null);
  const near = (d?.query?.geosearch || []).filter((g) => /\.(jpe?g|png|webp)$/i.test(g.title) && !BAD.test(norm(g.title).replace(/[_.-]/g, ' ')));
  if (!d) continue;
  if (!near.length) { checked[p.id] = 3; continue; }
  await commonsMeta(near.map((g) => g.title.replace(/^File:/, '')));
  const tk = tokens(p.name?.es || p.name?.en).concat(tokens(p.name?.en || '')).filter((w, k, a) => a.indexOf(w) === k);
  const cw = CAT_WORDS[p.cat];
  let best = null;
  for (const g of near) {
    const f = g.title.replace(/^File:/, ''), m = meta.get(f);
    if (!m) continue;
    const txt = norm(f + ' ' + m._desc);
    if (BAD.test(txt.replace(/[_.-]/g, ' '))) continue;
    // el nombre del lugar tiene que estar en el TÍTULO del archivo (la descripción da falsos positivos)
    const tt = norm(f).replace(/[_.-]/g, ' ');
    const nameHits = tk.filter((w) => new RegExp('\\b' + w + '\\b').test(tt)).length;
    const catHit = cw ? cw.test(tt) : false;
    const full = norm(p.name?.es || '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const ok = nameHits > 0 && nameHits >= Math.min(2, tk.length) && (cw ? catHit || nameHits >= 2 : tt.includes(full));
    void txt;
    if (!ok) continue;
    const s = nameHits * 3 + (catHit ? 2 : 0) - g.dist / 200;
    if (!best || s > best.s) best = { f, s };
  }
  if (best && set(p, best.f, 'commons-geo')) st.geo++;
  else checked[p.id] = 3;
}
log(`3) Commons por coordenadas: ${st.geo}`);

save();
const after = before + atlas.places.filter((p) => found[p.id]).length;
log(`fotos nuevas en este paso: ${st.p18 + st.wdname + st.geo}; total con foto ${after}/${total} (${((after / total) * 100).toFixed(1)}%, antes ${((before / total) * 100).toFixed(1)}%)`);
log('corre npm run build-data para aplicarlas');
