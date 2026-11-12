#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clubs, crestsOnly } from './content-clubs.mjs';
import { foodByProvince } from './content-food.mjs';
import {
  chunks, clip, commonsMeta, fileFromP18, fileMeta, get, log, mw, norm, pageImages, pageUrl,
  qid, sectionContent, sectionsOf, slug, sparql, stripHtml, wikiTitle,
} from './wiki.mjs';
import { km } from './shared.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // también en Windows
const SRC = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'public/data');
const UA = 'PerezeandoContentBot/1.0 (https://perezeando.com; mapa de Costa Rica; build-time fetch)';
const SKIP_OSM = process.argv.includes('--skip-osm');
const CONTENT_ONLY = process.argv.includes('--content-only'); // reusa places-wd.json / enrich.json ya generados
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const OSM_ONLY = process.argv.includes('--osm-only');
const provinces = JSON.parse(fs.readFileSync(path.join(SRC, 'provinces.geojson'), 'utf8'));
const MAXB = [[-91.5, 2.8], [-80.5, 12.6]];
function inRing(x, y, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function provOf(lng, lat) {
  for (const f of provinces.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) if (inRing(lng, lat, p[0]) && !p.slice(1).some((h) => inRing(lng, lat, h))) return f.properties.id;
  }
  return null;
}
function nearestProv(lng, lat) {
  let best = null, bd = 0.23;
  for (const f of provinces.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) for (const [x, y] of p[0]) {
      const d = Math.hypot(x - lng, y - lat);
      if (d < bd) { bd = d; best = f.properties.id; }
    }
  }
  return best;
}
const inBounds = (lng, lat) => lng > MAXB[0][0] && lng < MAXB[1][0] && lat > MAXB[0][1] && lat < MAXB[1][1];

const existing = JSON.parse(fs.readFileSync(path.join(SRC, 'places.json'), 'utf8'));
const CLASSES = [
  ['volcanes', 'Q8072'], ['cerros', 'Q8502'], ['parques', 'Q46169'], ['bosques', 'Q473972'],
  ['cataratas', 'Q34038'], ['rios', 'Q4022'], ['islas', 'Q23442'], ['playas', 'Q40080'],
  ['ciudades', 'Q953822'], ['museos', 'Q33506'], ['iglesias', 'Q16970'], ['arqueologia', 'Q839954'],
  ['deportes', 'Q483110'], ['gastronomia', 'Q330284'], ['hitos', 'HERITAGE'],
];
const PRIO = Object.fromEntries(CLASSES.map(([c], i) => [c, i]));
const SINAC_CATS = new Set(['parques', 'bosques', 'volcanes']);

async function fetchClass(cat, cls) {
  const typ = cls === 'HERITAGE' ? '?item wdt:P1435 ?her.' : `?item wdt:P31/wdt:P279* wd:${cls}.`;
  const q = `SELECT ?item ?coord ?es ?en ?des ?den ?img ?eswiki ?enwiki ?esvoy ?envoy ?her ?herLabel WHERE {
    ?item wdt:P17 wd:Q800. ${typ}
    ?item wdt:P625 ?coord.
    OPTIONAL { ?item rdfs:label ?es FILTER(lang(?es)='es') }
    OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en)='en') }
    OPTIONAL { ?item schema:description ?des FILTER(lang(?des)='es') }
    OPTIONAL { ?item schema:description ?den FILTER(lang(?den)='en') }
    OPTIONAL { ?item wdt:P18 ?img }
    OPTIONAL { ?item wdt:P1435 ?her. ?her rdfs:label ?herLabel FILTER(lang(?herLabel)='es') }
    OPTIONAL { ?eswiki schema:about ?item; schema:isPartOf <https://es.wikipedia.org/> }
    OPTIONAL { ?enwiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
    OPTIONAL { ?esvoy schema:about ?item; schema:isPartOf <https://es.wikivoyage.org/> }
    OPTIONAL { ?envoy schema:about ?item; schema:isPartOf <https://en.wikivoyage.org/> }
  }`;
  try { return await sparql(q); } catch (e) { log('WDQS falló', cat, e.message); return []; }
}

async function buildPlaces() {
  const byQ = new Map();
  for (const [cat, cls] of CLASSES) {
    const rows = await fetchClass(cat, cls);
    let n = 0;
    for (const r of rows) {
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(r.coord);
      if (!m) continue;
      const lng = +m[1], lat = +m[2];
      if (!inBounds(lng, lat)) continue;
      const q = qid(r.item);
      const cur = byQ.get(q);
      if (cur) {
        if (PRIO[cat] < PRIO[cur.cat] && cat !== 'hitos') cur.cat = cat;
        if (r.herLabel) cur.her = r.herLabel;
        continue;
      }
      n++;
      byQ.set(q, { q, cat, lng, lat, es: r.es, en: r.en, des: r.des, den: r.den, img: fileFromP18(r.img), eswiki: wikiTitle(r.eswiki), enwiki: wikiTitle(r.enwiki), esvoy: wikiTitle(r.esvoy), envoy: wikiTitle(r.envoy), her: r.herLabel });
    }
    log(cat, rows.length, 'filas →', n, 'nuevos ítems');
  }
  return [...byQ.values()];
}

async function wdFacts(qids) {
  const out = new Map();
  for (const c of chunks(qids, 50)) {
    const d = await mw('www.wikidata.org', { action: 'wbgetentities', ids: c.join('|'), props: 'claims|sitelinks', sitefilter: 'eswiki|enwiki|eswikivoyage|enwikivoyage' });
    for (const [id, e] of Object.entries(d.entities || {})) {
      const cl = e.claims || {};
      const val = (p) => cl[p]?.find((s) => s.rank !== 'deprecated')?.mainsnak?.datavalue?.value;
      const qty = (p) => { const v = val(p); return v ? Math.round(parseFloat(v.amount)) : undefined; };
      const time = (p) => { const v = val(p); return v?.time ? v.time.slice(1, 5).replace(/^0+/, '') : undefined; };
      out.set(id, {
        elev: qty('P2044'), area: val('P2046') ? +parseFloat(val('P2046').amount).toFixed(1) : undefined,
        areaUnit: val('P2046')?.unit?.split('/').pop(), inception: time('P571'), web: val('P856'),
        pop: qty('P1082'), img: val('P18'), her: val('P1435')?.id,
        eswiki: e.sitelinks?.eswiki?.title, enwiki: e.sitelinks?.enwiki?.title,
        esvoy: e.sitelinks?.eswikivoyage?.title, envoy: e.sitelinks?.enwikivoyage?.title,
      });
    }
  }
  return out;
}
async function labels(qids) {
  const out = new Map();
  for (const c of chunks([...new Set(qids)].filter(Boolean), 50)) {
    const d = await mw('www.wikidata.org', { action: 'wbgetentities', ids: c.join('|'), props: 'labels', languages: 'es|en' });
    for (const [id, e] of Object.entries(d.entities || {})) out.set(id, { es: e.labels?.es?.value || e.labels?.en?.value, en: e.labels?.en?.value || e.labels?.es?.value });
  }
  return out;
}

const PROV_WIKI = { sanjose: 'Provincia de San José', alajuela: 'Provincia de Alajuela', cartago: 'Provincia de Cartago', heredia: 'Provincia de Heredia', guanacaste: 'Provincia de Guanacaste', puntarenas: 'Provincia de Puntarenas', limon: 'Provincia de Limón' };
async function voyage(host, page, want) {
  try {
    const secs = await sectionsOf(host, page);
    const res = {};
    for (const [key, names] of Object.entries(want)) {
      const s = secs.find((x) => names.includes(stripHtml(x.line)));
      if (!s) continue;
      const c = await sectionContent(host, page, s.index);
      if (c.text) res[key] = { text: clip(c.text, 360), src: { name: 'Wikivoyage', url: pageUrl(host, page) + '#' + encodeURIComponent(s.anchor), license: 'CC BY-SA 4.0' } };
    }
    return res;
  } catch (e) { log('wikivoyage', host, page, e.message); return {}; }
}

async function overpassSurf() {
  if (SKIP_OSM) return [];
  const q = `[out:json][timeout:60];area["ISO3166-1"="CR"][admin_level=2]->.cr;(node["sport"="surfing"]["name"](area.cr);way["sport"="surfing"]["name"](area.cr);node["natural"="beach"]["surfing"]["name"](area.cr););out center tags;`;
  try {
    const d = await get(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
    return d.elements.map((e) => ({ id: e.type + '/' + e.id, name: e.tags.name, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon })).filter((e) => e.lat);
  } catch (e) { log('Overpass falló', e.message); return []; }
}

async function provinceFacts() {
  const V = Object.values(PROV_WIKI).map((t) => `"${t}"@es`).join(' ');
  const rows = await sparql(`SELECT ?p ?t ?pop ?popDate ?area ?cap ?capLabel ?envoy ?esvoy WHERE {
    VALUES ?t {${V}} ?a schema:about ?p; schema:isPartOf <https://es.wikipedia.org/>; schema:name ?t.
    OPTIONAL { ?p p:P1082 ?ps. ?ps ps:P1082 ?pop. OPTIONAL { ?ps pq:P585 ?popDate } }
    OPTIONAL { ?p wdt:P2046 ?area } OPTIONAL { ?p wdt:P36 ?cap }
    OPTIONAL { ?envoy schema:about ?p; schema:isPartOf <https://en.wikivoyage.org/> }
    OPTIONAL { ?esvoy schema:about ?p; schema:isPartOf <https://es.wikivoyage.org/> }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es". } }`);
  const out = {};
  for (const [id, t] of Object.entries(PROV_WIKI)) {
    const rs = rows.filter((r) => r.t === t);
    if (!rs.length) continue;
    const best = rs.filter((r) => r.pop).sort((a, b) => (b.popDate || '').localeCompare(a.popDate || ''))[0];
    out[id] = { qid: qid(rs[0].p), pop: best ? Math.round(+best.pop) : undefined, popYear: best?.popDate?.slice(0, 4), area: rs[0].area ? Math.round(+rs[0].area) : undefined, capital: rs[0].capLabel, envoy: wikiTitle(rs[0].envoy), esvoy: wikiTitle(rs[0].esvoy) };
  }
  return out;
}

async function cultureSection(page) {
  try {
    const secs = await sectionsOf('es.wikipedia.org', page);
    const s = secs.find((x) => /^(Cultura|Tradiciones|Folclore|Patrimonio|Fiestas)/i.test(stripHtml(x.line)));
    if (!s) return null;
    const c = await sectionContent('es.wikipedia.org', page, s.index);
    return c.text ? { section: stripHtml(s.line), text: clip(c.text), src: { name: 'Wikipedia', url: pageUrl('es.wikipedia.org', page) + '#' + encodeURIComponent(s.anchor), license: 'CC BY-SA 4.0' } } : null;
  } catch { return null; }
}

// Fuente: extracto de Costa Rica de Geofabrik (.osm.pbf, ~40 MB, se actualiza a diario). Se descarga una vez
// a .cache/osm/ (se reusa 7 días; --refresh fuerza) y se lee aquí mismo en Node, sin Overpass ni osmium.
const PBF_URL = process.env.OSM_PBF_URL || 'https://download.geofabrik.de/central-america/costa-rica-latest.osm.pbf';
const PBF_FILE = process.env.OSM_PBF || path.join(ROOT, '.cache', 'osm', 'costa-rica-latest.osm.pbf');
const isFood = (t) => /^(restaurant|cafe|fast_food)$/.test(t.amenity || '');
const isSoda = (t) => /^soda(\s|$)/i.test(t.name);
const SURF_BREAKS = [
  ['Playa Tamarindo', 'guanacaste'], ['Playa Grande', 'guanacaste'], ['Playa Avellanas', 'guanacaste'], ['Playa Negra', 'guanacaste'],
  ['Playa Langosta', 'guanacaste'], ['Playa Junquillal', 'guanacaste'], ['Playa Guiones', 'guanacaste'], ['Playa Ostional', 'guanacaste'],
  ['Playa Camaronal', 'guanacaste'], ['Playa Marbella', 'guanacaste'], ['Playa San Miguel', 'guanacaste'], ['Playa Naranjo', 'guanacaste', "Witch's Rock (Playa Naranjo)"],
  ['Playa Potrero Grande', 'guanacaste', "Ollie's Point (Potrero Grande)"], ['Playa Santa Teresa', 'puntarenas'], ['Playa Carmen', 'puntarenas'],
  ['Playa Hermosa', 'puntarenas'], ['Playa Jacó', 'puntarenas'], ['Playa Escondida', 'puntarenas'], ['Playa Esterillos Oeste', 'puntarenas'],
  ['Playa Bejuco', 'puntarenas'], ['Playa Dominical', 'puntarenas'], ['Playa Pavones', 'puntarenas', 'Pavones'], ['Playa Matapalo', 'puntarenas'],
  ['Playa Boca Barranca', 'puntarenas', 'Boca Barranca'], ['Playa Coyote', 'guanacaste'], ['Playa Manzanillo', 'guanacaste'],
  ['Salsa Brava', 'limon'], ['Playa Cocles', 'limon'], ['Playa Bonita', 'limon'], ['Isla Uvita', 'limon'], ['Playa Negra', 'limon'],
];
const SURF_HINT = { 'playagrande|guanacaste': [10.333, -85.856], 'playajunquillal|guanacaste': [10.153, -85.788], 'playatamarindo|guanacaste': [10.2993, -85.842] };
const breakKey = (s) => norm(s).replace(/[^a-z0-9]/g, '');
const BREAK_NAMES = new Set(SURF_BREAKS.map((b) => breakKey(b[0])));
const OSM_CATS = [
  {
    key: 'surf', cat: 'surf', cap: 70, perProv: 30,
    match: (t) => (t.natural === 'beach' || !(t.shop || t.amenity || t.craft || t.office || t.tourism || t.club || t.building || /school|escuela|shop|store|tienda|rental|alquiler|camp|lessons|clases|hostel|hotel/i.test(t.name))) && (t.sport === 'surfing' || t.leisure === 'surf_spot' || t.leisure === 'surf' || (t.natural === 'beach' && (t.surfing || BREAK_NAMES.has(breakKey(t.name)))) || (t.natural === 'reef' && t.surfing)),
    keep: () => true,
    score: (t) => (t.sport === 'surfing' || t.leisure ? 3 : 0) + (t.wikidata ? 2 : 0) + (t.surfing ? 1 : 0) + (t.website ? 1 : 0),
  },
  {
    key: 'gastronomia', cat: 'gastronomia', cap: 140, perProv: 28,
    match: (t) => t.amenity === 'marketplace' || (isFood(t) && (isSoda(t) || t.wikidata || /costa_rican|regional/i.test(t.cuisine || '') || ((t.website || t['contact:website']) && /local|latin_american|seafood/i.test(t.cuisine || '')))),
    keep: (t) => !/^(soda|restaurante|restaurant|cafe|café|mercado|feria)$/i.test(t.name.trim()) && !t.brand && !t['brand:wikidata'] && t.amenity !== 'fast_food' || isSoda(t),
    score: (t) => (t.wikidata ? 4 : 0) + (t.amenity === 'marketplace' ? 3 : 0) + (/costa_rican|regional/i.test(t.cuisine || '') ? 2 : 0) + (isSoda(t) ? 1 : 0) + (t.website || t['contact:website'] ? 1 : 0) + (t.opening_hours ? 0.5 : 0) + (t.wikimedia_commons || t.image ? 0.5 : 0),
  },
  {
    key: 'cataratas', cat: 'cataratas', cap: 90, perProv: 25,
    match: (t) => t.waterway === 'waterfall' || t.natural === 'waterfall',
    keep: () => true,
    score: (t) => (t.wikidata ? 3 : 0) + (t.wikipedia ? 1 : 0) + (t.ele || t.height ? 1 : 0) + (t.tourism ? 1 : 0) + (t.wikimedia_commons || t.image ? 0.5 : 0),
  },
  {
    key: 'arqueologia', cat: 'arqueologia', cap: 40, perProv: 12,
    match: (t) => t.historic === 'archaeological_site',
    keep: () => true,
    score: (t) => (t.wikidata ? 3 : 0) + (t.wikipedia ? 2 : 0) + (t.tourism ? 1 : 0),
  },
  {
    key: 'miradores', cat: 'cerros', cap: 30, perProv: 8,
    match: (t) => t.tourism === 'viewpoint',
    keep: (t) => (t.wikidata || t.wikipedia || /^(mirador|cerro|alto)\b/i.test(t.name.trim())) && !/^(mirador|viewpoint|vista)$/i.test(t.name.trim()) && !/catarata|waterfall|hotel|lodge|restaurante/i.test(t.name),
    score: (t) => (t.wikidata ? 3 : 0) + (t.wikipedia ? 2 : 0) + (t.ele ? 1 : 0) + (t.wikimedia_commons || t.image ? 1 : 0) + (t.website ? 0.5 : 0),
  },
];
const CUISINE = { costa_rican: ['cocina costarricense', 'Costa Rican food'], regional: ['cocina regional', 'regional food'], local: ['cocina local', 'local food'], seafood: ['mariscos', 'seafood'], coffee_shop: ['café', 'coffee'], latin_american: ['cocina latinoamericana', 'Latin American food'] };
const PROV_NAME = { sanjose: 'San José', alajuela: 'Alajuela', cartago: 'Cartago', heredia: 'Heredia', guanacaste: 'Guanacaste', puntarenas: 'Puntarenas', limon: 'Limón', mar: 'Costa Rica' };

async function downloadPbf() {
  const fresh = fs.existsSync(PBF_FILE) && Date.now() - fs.statSync(PBF_FILE).mtimeMs < 7 * 864e5;
  if (fresh && !process.argv.includes('--refresh')) { log(`usando ${path.relative(ROOT, PBF_FILE)} (${(fs.statSync(PBF_FILE).size / 1e6).toFixed(0)} MB, menos de 7 días; --refresh para bajarlo de nuevo)`); return; }
  fs.mkdirSync(path.dirname(PBF_FILE), { recursive: true });
  log('descargando', PBF_URL);
  const r = await fetch(PBF_URL, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`Geofabrik HTTP ${r.status}`);
  const tmp = PBF_FILE + '.part';
  const { Readable } = await import('node:stream');
  const { pipeline } = await import('node:stream/promises');
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(tmp));
  fs.renameSync(tmp, PBF_FILE);
  log(`listo: ${(fs.statSync(PBF_FILE).size / 1e6).toFixed(0)} MB (${new URL(r.url).pathname.split('/').pop()})`);
}

function osmPlace(c, e) {
  const t = e.tags || {};
  const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
  if (lat == null || !inBounds(lng, lat)) return null;
  const prov = provOf(lng, lat) || nearestProv(lng, lat) || (lat < 6 ? 'puntarenas' : null);
  if (!prov) return null;
  const brk = c.key === 'surf' && t.natural === 'beach' ? SURF_BREAKS.find((b) => breakKey(b[0]) === breakKey(t.name) && b[1] === prov) : null;
  if (c.key === 'surf' && t.natural === 'beach' && !t.surfing && !brk) return null; // playa homónima en otra provincia
  const nameEs = (brk?.[2] || t['name:es'] || t.name).trim(), nameEn = (brk?.[2] || t['name:en'] || t.name).trim();
  const pn = PROV_NAME[prov];
  const cu = (t.cuisine || '').split(';').map((x) => CUISINE[x.trim()]).find(Boolean);
  let desc;
  switch (c.key) {
    case 'surf': desc = [`Spot de surf en ${pn}.`, `Surf spot in ${pn}.`]; break;
    case 'gastronomia':
      desc = t.amenity === 'marketplace' ? [`Mercado en ${pn}.`, `Market in ${pn}.`]
        : isSoda(t) ? [`Soda (comida típica costarricense) en ${pn}.`, `Soda (traditional Costa Rican eatery) in ${pn}.`]
        : cu ? [`Restaurante de ${cu[0]} en ${pn}.`, `Restaurant serving ${cu[1]} in ${pn}.`]
        : [`Restaurante en ${pn}.`, `Restaurant in ${pn}.`];
      break;
    case 'cataratas': desc = [`Catarata en ${pn}.`, `Waterfall in ${pn}.`]; break;
    case 'arqueologia': desc = [`Sitio arqueológico en ${pn}.`, `Archaeological site in ${pn}.`]; break;
    default: desc = [`Mirador en ${pn}.`, `Viewpoint in ${pn}.`];
  }
  const web = t.website || t['contact:website'];
  const ele = t.ele && /^\d+(\.\d+)?$/.test(t.ele) ? `${Math.round(+t.ele)} m` : undefined;
  const p = {
    id: `osm-${slug(nameEs)}-${e.type[0]}${e.id}`,
    cat: c.cat, prov, lat: +lat.toFixed(5), lng: +lng.toFixed(5),
    name: { es: nameEs, en: nameEn }, desc: { es: desc[0], en: desc[1] },
    src: 'osm', osm: `${e.type}/${e.id}`,
  };
  if (brk) p._beach = brk[0];
  if (t.wikidata && /^Q\d+$/.test(t.wikidata)) p.q = t.wikidata;
  if (web && /^https?:\/\//.test(web)) p.link = web;
  if (ele) p.facts = { alt: ele };
  if (t.wikipedia) { const [l, ...rest] = t.wikipedia.split(':'); if ((l === 'es' || l === 'en') && rest.length) p.wiki = { [l]: rest.join(':') }; }
  const f = (t.wikimedia_commons || '').match(/^File:(.+)/i)?.[1] || (t.image || '').match(/commons\.wikimedia\.org\/wiki\/File:([^?#]+)/i)?.[1];
  if (f) p._file = decodeURIComponent(f).replace(/_/g, ' ');
  p._score = c.score(t) + (brk ? 2 : 0);
  return p;
}

async function osmPhotos(all) {
  const qs = all.filter((p) => !p._file && p.q).map((p) => p.q);
  const ents = qs.length ? await wdEntities(qs) : {};
  for (const p of all) if (!p._file && p.q) { const f = claimVal(ents[p.q], 'P18')[0]; if (f) p._file = f; }
  const files = all.map((p) => p._file).filter(Boolean);
  if (files.length) await commonsMeta(files);
  let n = 0;
  for (const p of all) { const m = p._file && fileMeta.get(p._file); if (m) { p.img = m; n++; } delete p._file; }
  return n;
}

let OSM_PBF;
function snapSurf(list) {
  if (!list.length) return;
  const M = 111320;
  for (const p of list) {
    const h = SURF_HINT[breakKey(p._beach || p.name.es) + '|' + p.prov];
    p._from = [p.lat, p.lng];
    if (h && Math.hypot((h[0] - p.lat) * M, (h[1] - p.lng) * M * Math.cos((p.lat * Math.PI) / 180)) > 3000) { p.lat = h[0]; p.lng = h[1]; p._hint = 1; }
  }
  const { waysWithCoords } = OSM_PBF;
  const coast = waysWithCoords(PBF_FILE, (t) => t.natural === 'coastline');
  for (const p of list) {
    const k = Math.cos((p.lat * Math.PI) / 180);
    let best = null;
    for (const w of coast) for (let i = 1; i < w.coords.length; i++) {
      const [a, b] = [w.coords[i - 1], w.coords[i]];
      const ax = (a[1] - p.lng) * M * k, ay = (a[0] - p.lat) * M, bx = (b[1] - p.lng) * M * k, by = (b[0] - p.lat) * M;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      if (!L2) continue;
      const u = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2));
      const x = ax + u * dx, y = ay + u * dy, d = Math.hypot(x, y);
      if (!best || d < best.d) best = { d, x, y, nx: dy / Math.sqrt(L2), ny: -dx / Math.sqrt(L2) };
    }
    if (best && best.d < (p._hint ? 6000 : 1500)) {
      const x = best.x + best.nx * 70, y = best.y + best.ny * 70; // 70 m mar adentro (derecha del trazo)
      p.lat = +(p.lat + y / M).toFixed(5); p.lng = +(p.lng + x / (M * k)).toFixed(5);
      p._snap = Math.round(best.d);
    }
  }
  console.log('\nSpots de surf (ajuste a la costa)');
  console.table(list.map((p) => ({ spot: p.name.es, de: p._from.join(', '), a: `${p.lat}, ${p.lng}`, movido_m: Math.round(Math.hypot((p.lat - p._from[0]) * M, (p.lng - p._from[1]) * M * Math.cos((p.lat * Math.PI) / 180))), costa_m: p._snap ?? '—', pista: p._hint ? 'sí' : '' })));
  for (const p of list) { p.beach = p._beach; delete p._from; delete p._snap; delete p._hint; delete p._beach; }
}

async function osmOnly() {
  const t0 = Date.now();
  try { await downloadPbf(); } catch (e) {
    if (!fs.existsSync(PBF_FILE)) { console.error('\nNo se pudo bajar el extracto de Geofabrik:', e.message, '\nno se toca places-osm.json.'); process.exitCode = 1; return; }
    log('descarga falló (' + e.message + '); se usa el archivo anterior');
  }
  OSM_PBF = await import('./osm-pbf.mjs');
  const { extract } = OSM_PBF;
  const els = extract(PBF_FILE, (t) => !!t.name && OSM_CATS.some((c) => c.match(t)));
  log(`${els.length} elementos con nombre en las categorías (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const all = [], summary = [], used = new Set();
  for (const c of OSM_CATS) {
    const found = els.filter((e) => !used.has(e.type + e.id) && c.match(e.tags) && c.keep(e.tags));
    const seen = new Set();
    let ps = found.map((e) => osmPlace(c, e)).filter(Boolean)
      .filter((p) => { const k = slug(p.name.es) + '|' + p.prov; if (seen.has(k)) return false; seen.add(k); return true; });
    ps.sort((a, b) => b._score - a._score || a.name.es.localeCompare(b.name.es));
    const per = {};
    ps = ps.filter((p) => (per[p.prov] = (per[p.prov] || 0) + 1) <= c.perProv).slice(0, c.cap);
    ps.forEach((p) => used.add(p.osm.replace('/', '')));
    all.push(...ps);
    summary.push({ categoria: c.key, en_osm: found.length, guardados: ps.length });
  }
  snapSurf(all.filter((p) => p.cat === 'surf'));
  log('fotos (Wikidata P18 / wikimedia_commons / image)…');
  let photos = 0;
  try { photos = await osmPhotos(all); } catch (e) { log('fotos fallaron:', e.message, '(se guarda sin fotos)'); all.forEach((p) => delete p._file); }
  for (const p of all) delete p._score;
  if (!all.length) { console.error('\nEl extracto no dio lugares: no se toca places-osm.json.'); process.exitCode = 1; return; }
  const file = path.join(SRC, 'places-osm.json');
  fs.writeFileSync(file, JSON.stringify({ generated: new Date().toISOString(), source: '© OpenStreetMap contributors (ODbL 1.0), extracto Geofabrik', places: all }));
  console.log('\nResumen OpenStreetMap');
  console.table(summary);
  const byProv = {};
  for (const p of all) (byProv[p.prov] ||= {})[p.cat] = (byProv[p.prov][p.cat] || 0) + 1;
  console.table(byProv);
  console.log(`Total ${all.length} lugares, ${photos} con foto → ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB) en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log('Siguiente paso: npm run build-data   (fusiona y descarta duplicados)');
}

const nameKey = (s) => norm(s).replace(/\b(volcan|parque nacional|playa|isla|rio|catarata|cerro|refugio|reserva|de|del|la|el|los|las)\b/g, '').replace(/[^a-z0-9]/g, '');

async function main() {
  fs.mkdirSync(SRC, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  if (OSM_ONLY) return osmOnly();
  if (process.argv.includes('--crests')) return crestsOnly(path.join(OUT, 'provinces-content.json'));
  if (CONTENT_ONLY) {
    const places = JSON.parse(fs.readFileSync(path.join(SRC, 'places-wd.json'), 'utf8'));
    const enrich = JSON.parse(fs.readFileSync(path.join(SRC, 'enrich.json'), 'utf8'));
    return writeContent(places, enrich);
  }
  log('1/4 lugares desde Wikidata');
  const items = await buildPlaces();
  let cand = items.filter((it) => (it.es || it.en) && !/^Q\d+$/.test(it.es || it.en) && (it.eswiki || it.enwiki || it.esvoy || it.envoy || it.img || it.her));
  log('candidatos con notabilidad', cand.length, 'de', items.length);

  const exEs = existing.filter((p) => p.wiki?.es).map((p) => p.wiki.es);
  const exEn = existing.filter((p) => !p.wiki?.es && p.wiki?.en).map((p) => p.wiki.en);
  const piEs = await pageImages('es', exEs);
  const piEn = await pageImages('en', exEn);
  const exQ = new Map();
  for (const p of existing) {
    const v = p.wiki?.es ? piEs.get(p.wiki.es) : p.wiki?.en ? piEn.get(p.wiki.en) : null;
    if (v?.qid) exQ.set(p.id, { qid: v.qid, file: v.file });
  }
  const usedQ = new Set([...exQ.values()].map((v) => v.qid));
  cand = cand.filter((it) => {
    if (usedQ.has(it.q)) return false;
    const k = nameKey(it.es || it.en);
    return !existing.some((p) => km(p, it) < 3 && k && (nameKey(p.name.es) === k || nameKey(p.name.en) === k));
  });
  log('tras deduplicar', cand.length);

  const PROVQ = { Q502181: 'cartago', Q642644: 'limon', Q502170: 'puntarenas', Q502188: 'alajuela', Q502192: 'heredia', Q690026: 'guanacaste', Q647808: 'sanjose' };
  const cantonProv = new Map((await sparql('SELECT ?c ?p WHERE { ?c wdt:P31 wd:Q953822; wdt:P131 ?p. }')).map((r) => [qid(r.c), PROVQ[qid(r.p)]]));
  const places = [];
  const ids = new Set(existing.map((p) => p.id));
  for (const it of cand) {
    let prov = cantonProv.get(it.q) || provOf(it.lng, it.lat);
    if (!prov && (it.cat === 'islas' || it.cat === 'playas')) prov = nearestProv(it.lng, it.lat);
    if (!prov) { if (it.cat === 'islas' || it.cat === 'parques' || it.cat === 'bosques') prov = 'mar'; else continue; }
    const nm = { es: it.es || it.en, en: it.en || it.es };
    let id = 'wd-' + slug(nm.es);
    if (ids.has(id)) id += '-' + it.q.toLowerCase();
    ids.add(id);
    places.push({ id, q: it.q, cat: it.cat, prov, lat: +it.lat.toFixed(5), lng: +it.lng.toFixed(5), name: nm, desc: { es: it.des ? it.des[0].toUpperCase() + it.des.slice(1) : '', en: it.den ? it.den[0].toUpperCase() + it.den.slice(1) : '' }, wiki: (it.eswiki || it.enwiki) ? { ...(it.eswiki ? { es: it.eswiki } : {}), ...(it.enwiki ? { en: it.enwiki } : {}) } : undefined, _img: it.img, _her: it.her, src: 'wikidata' });
  }

  log('2/4 fotos y hechos');
  const allQ = [...places.map((p) => p.q), ...[...exQ.values()].map((v) => v.qid)];
  const facts = await wdFacts([...new Set(allQ)]);
  const needPi = places.filter((p) => !p._img && p.wiki?.es).map((p) => p.wiki.es);
  const piNew = await pageImages('es', needPi);
  const needPiEn = places.filter((p) => !p._img && !p.wiki?.es && p.wiki?.en).map((p) => p.wiki.en);
  const piNewEn = await pageImages('en', needPiEn);
  for (const p of places) p._file = p._img || (p.wiki?.es && piNew.get(p.wiki.es)?.file) || (p.wiki?.en && piNewEn.get(p.wiki.en)?.file);
  const exFiles = existing.filter((p) => !p.img).map((p) => { const q = exQ.get(p.id); return (q && facts.get(q.qid)?.img) || q?.file; });
  await commonsMeta([...places.map((p) => p._file), ...exFiles]);
  const herQ = [...facts.values()].map((f) => f.her).filter(Boolean);
  const herL = await labels(herQ);

  const enrich = {};
  const mk = (q, cat) => {
    const f = facts.get(q);
    if (!f) return null;
    const e = { qid: q };
    if (f.elev && f.elev > 0 && f.elev < 4000) e.elev = f.elev;
    if (f.inception && +f.inception > 1000 && +f.inception <= 2026) e.inception = f.inception;
    if (f.area && f.areaUnit === 'Q712226') e.area = f.area; // km²
    if (f.web && /^https?:\/\//.test(f.web)) e.web = f.web;
    if (f.her) e.her = herL.get(f.her);
    if (f.esvoy) e.voy = { ...(e.voy || {}), es: f.esvoy };
    if (f.envoy) e.voy = { ...(e.voy || {}), en: f.envoy };
    if (SINAC_CATS.has(cat) && e.web && /sinac\.go\.cr/.test(e.web)) e.sinac = e.web;
    return e;
  };
  for (const p of existing) {
    const q = exQ.get(p.id);
    if (!q) continue;
    const e = mk(q.qid, p.cat);
    if (!p.img) { const file = facts.get(q.qid)?.img || q.file; const m = file && fileMeta.get(file); if (m) e.img = m; }
    enrich[p.id] = e;
  }
  for (const p of places) {
    const e = mk(p.q, p.cat);
    if (e) enrich[p.id] = e;
    const m = p._file && fileMeta.get(p._file);
    if (m) p.img = m;
    if (p.cat === 'ciudades' && facts.get(p.q)?.pop) enrich[p.id] = { ...(enrich[p.id] || { qid: p.q }), pop: facts.get(p.q).pop };
    delete p._img; delete p._file; delete p._her;
  }

  fs.writeFileSync(path.join(SRC, 'places-wd.json'), JSON.stringify(places));
  fs.writeFileSync(path.join(SRC, 'enrich.json'), JSON.stringify(enrich));
  await writeContent(places, enrich);
  log('listo:', places.length, 'lugares nuevos ·', Object.keys(enrich).length, 'fichas enriquecidas');
}

async function writeContent(places, enrich) {
  log('3/4 contenido por provincia');
  const pf = await provinceFacts();
  const food = await foodByProvince();
  const cl = await clubs();
  const clubFiles = cl.map((c) => c.img || c.logo);
  await commonsMeta(clubFiles);
  const surf = await overpassSurf();
  const allPlaces = [...existing, ...places];
  const content = {};
  for (const id of Object.keys(PROV_WIKI)) {
    const f = pf[id] || {};
    if (!f.envoy && ['sanjose', 'alajuela', 'heredia', 'cartago'].includes(id)) f.envoy = 'Central Valley (Costa Rica)';
    const voyEn = f.envoy ? await voyage('en.wikivoyage.org', f.envoy, { eat: ['Eat'], drink: ['Drink'], see: ['See'], do: ['Do'] }) : {};
    const voyEs = f.esvoy ? await voyage('es.wikivoyage.org', f.esvoy, { eat: ['Comer'], drink: ['Beber'], see: ['Ver'], do: ['Hacer'] }) : {};
    const cult = await cultureSection(PROV_WIKI[id]);
    const here = allPlaces.filter((p) => p.prov === id);
    const pick = (pr) => here.filter(pr).map((p) => ({ id: p.id, name: p.name, img: p.img || enrich[p.id]?.img, her: enrich[p.id]?.her }));
    content[id] = {
      facts: { ...f, src: f.qid ? { name: 'Wikidata', url: 'https://www.wikidata.org/wiki/' + f.qid, license: 'CC0' } : undefined },
      food: { ...(food[id] || { intro: [], items: [] }), voy: { es: voyEs.eat, en: voyEn.eat }, drink: { es: voyEs.drink, en: voyEn.drink } },
      culture: {
        wiki: cult,
        heritage: pick((p) => enrich[p.id]?.her),
        museums: pick((p) => p.cat === 'museos'),
        churches: pick((p) => p.cat === 'iglesias'),
        archaeology: pick((p) => p.cat === 'arqueologia'),
        voy: { es: voyEs.see, en: voyEn.see },
      },
      sports: {
        clubs: cl.filter((c) => provOf(c.lng, c.lat) === id).map((c) => ({ qid: c.qid, name: c.name, venue: c.venue, leagues: [...c.leagues], img: fileMeta.get(c.img) || fileMeta.get(c.logo) || undefined, src: { name: 'Wikipedia', url: pageUrl('es.wikipedia.org', c.wiki) } })),
        stadiums: pick((p) => p.cat === 'deportes'),
        surf: surf.filter((s) => (provOf(s.lng, s.lat) || nearestProv(s.lng, s.lat)) === id).map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, src: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/' + s.id, license: 'ODbL' } })),
        voy: { es: voyEs.do, en: voyEn.do },
      },
    };
  }

  log('4/4 escribiendo');
  fs.writeFileSync(path.join(OUT, 'provinces-content.json'), JSON.stringify({ generated: new Date().toISOString(), national: { food: food._national || [] }, provinces: content }));
  try { await crestsOnly(path.join(OUT, 'provinces-content.json')); } catch (e) { log('escudos: omitidos (' + e.message + ')'); }
}
main().catch((e) => { console.error(e); process.exit(1); });
