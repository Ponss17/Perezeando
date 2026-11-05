/* Convierte los datos de la versión estática (window.CR_*) a JSON/GeoJSON tipado.
   Uso: node scripts/convert-legacy-data.cjs <ruta-a-cr-mapa>  */
const fs = require('fs');
const path = require('path');
const src = process.argv[2] || path.resolve(__dirname, '../../cr-mapa');
global.window = {};
require(path.join(src, 'data/places.js'));
require(path.join(src, 'data/provinces.js'));
require(path.join(src, 'js/icons.js'));
const ll = ([lat, lng]) => [lng, lat];
const places = window.CR_PLACES.map((p) => {
  const o = { id: p.id, cat: p.cat, prov: p.prov, lat: p.lat, lng: p.lng, name: p.name, desc: p.desc };
  if (p.wiki) o.wiki = p.wiki;
  if (p.facts && Object.keys(p.facts).length) o.facts = p.facts;
  if (p.img) o.img = p.img;
  if (p.link) o.link = p.link;
  if (p.geom) {
    const c = p.geom.coords;
    if (p.geom.type === 'line') o.geometry = { type: 'LineString', coordinates: c.map(ll) };
    else {
      const ring = Array.isArray(c[0][0]) ? c[0] : c;
      const r = ring.map(ll);
      const a = r[0], b = r[r.length - 1];
      if (a[0] !== b[0] || a[1] !== b[1]) r.push(a);
      o.geometry = { type: 'Polygon', coordinates: [r] };
    }
  }
  return o;
});
const out = path.resolve(__dirname, '../public/data');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'places.json'), JSON.stringify(places));
fs.writeFileSync(path.join(out, 'provinces.geojson'), JSON.stringify(window.CR_PROVINCES));
const E = window.CR_EEZ;
const lines = (v) => (Array.isArray(v[0][0]) ? v : [v]).map((l) => l.map(ll));
const eez = {
  type: 'FeatureCollection',
  features: [
    ['pacificEEZ', { es: 'ZEE Pacífico', en: 'Pacific EEZ' }],
    ['caribbeanEEZ', { es: 'ZEE Caribe', en: 'Caribbean EEZ' }],
    ['cocoMarine', { es: 'Área Marina Montes Submarinos', en: 'Seamounts Marine Management Area' }],
  ].map(([id, name]) => ({ type: 'Feature', id, properties: { id, kind: id === 'cocoMarine' ? 'mma' : 'eez', name_es: name.es, name_en: name.en }, geometry: { type: 'MultiLineString', coordinates: lines(E[id]) } })),
};
fs.writeFileSync(path.join(out, 'eez.geojson'), JSON.stringify(eez));
const icons = window.ICONS;
fs.writeFileSync(
  path.resolve(__dirname, '../src/lib/icons-data.ts'),
  '// Generado desde Lucide (ISC). Contenido interno de cada <svg viewBox="0 0 24 24">.\n/* eslint-disable */\nexport const ICONS = ' + JSON.stringify(icons, null, 1) + ' as const;\n'
);
console.log('places', places.length, 'icons', Object.keys(icons).length);
