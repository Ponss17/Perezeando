/**
 * Realinea lat/lng de fauna TERRESTRE cuyo pin cae fuera del polígono de su `prov`.
 * Ancla al lugar natural más cercano YA en el atlas (misma provincia) — no inventa puntos.
 *
 * Fauna marina (`cat === 'fauna'`): NO se mueve. Sus pines suelen estar en el mar
 * (p. ej. Isla del Coco); anclarlos a islas/playas los deja encima de tierra.
 *
 * Uso: node scripts/snap-fauna-prov.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry-run');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1],
      xj = ring[j][0],
      yj = ring[j][1];
    const inter = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (inter) inside = !inside;
  }
  return inside;
}
function inPoly(lng, lat, geom) {
  if (!geom) return false;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    if (!pointInRing(lng, lat, poly[0])) continue;
    let hole = false;
    for (let h = 1; h < poly.length; h++) if (pointInRing(lng, lat, poly[h])) hole = true;
    if (!hole) return true;
  }
  return false;
}
const km = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180,
    dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/atlas.json'), 'utf8'));
const byProv = Object.fromEntries(atlas.provinces.features.map((f) => [f.properties.id, f]));

const PREF_LAND = new Set(['parques', 'bosques', 'volcanes', 'cerros']);

/** Entre anclas preferidas de la misma provincia, la más cercana al pin original. */
function anchorFor(fauna, pool) {
  const ok = pool.filter((x) => x.id !== fauna.id && Number.isFinite(x.lat) && Number.isFinite(x.lng));
  const pref = ok.filter((x) => PREF_LAND.has(x.cat));
  const use = pref.length ? pref : ok;
  use.sort((a, b) => km(fauna, a) - km(fauna, b));
  return use[0] ?? null;
}

const sources = [
  { file: 'places.json', list: rd('places.json') },
  { file: 'fauna-extra.json', list: rd('fauna-extra.json') },
];

const report = [];
for (const src of sources) {
  let n = 0;
  for (const p of src.list) {
    // marina: dejar en agua (no anclar a islas/playas en tierra)
    if (p.cat === 'fauna') continue;
    if (p.cat !== 'faunaTerrestre') continue;
    if (!p.prov || p.prov === 'mar' || p.prov === 'all') continue;
    const feat = byProv[p.prov];
    if (!feat) continue;
    if (inPoly(p.lng, p.lat, feat.geometry)) continue;
    const inside = atlas.places.filter(
      (x) => x.prov === p.prov && inPoly(x.lng, x.lat, feat.geometry),
    );
    const hit = anchorFor(p, inside);
    if (!hit) {
      report.push({ file: src.file, id: p.id, skipped: 'no-anchor' });
      continue;
    }
    report.push({
      file: src.file,
      id: p.id,
      name: p.name?.es,
      prov: p.prov,
      from: [p.lat, p.lng],
      to: [hit.lat, hit.lng],
      via: hit.id,
      viaName: hit.name?.es,
      viaCat: hit.cat,
    });
    p.lat = hit.lat;
    p.lng = hit.lng;
    n++;
  }
  if (!dry && n) {
    fs.writeFileSync(path.join(ROOT, 'data', src.file), JSON.stringify(src.list) + '\n');
  }
  console.log(`${src.file}: ${n} ajustados${dry ? ' (dry)' : ''}`);
}

console.log(JSON.stringify({ dry, moved: report.filter((r) => !r.skipped).length, report }, null, 2));
