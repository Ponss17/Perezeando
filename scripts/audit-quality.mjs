import fs from 'node:fs';
import path from 'node:path';
import { km } from './shared.mjs';
const BASE = process.cwd();
const atlas = JSON.parse(fs.readFileSync(path.join(BASE, 'public', 'data', 'atlas.json'), 'utf8'));
const places = atlas.places;
const issues = [];
const ids = new Map();
for (const p of places) {
  if (ids.has(p.id)) issues.push({ t: 'dup-id', id: p.id });
  ids.set(p.id, true);
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || p.lat < 4 || p.lat > 12 || p.lng > -82 || p.lng < -90) {
    if (p.prov !== 'mar') issues.push({ t: 'coords', id: p.id, lat: p.lat, lng: p.lng });
  }
  const es = p.desc?.es || '';
  if (!es.trim()) issues.push({ t: 'no-desc-es', id: p.id });
  if (p.img?.src?.startsWith('/media/')) {
    const rel = p.img.src.replace(/^\//, '');
    const abs = path.join(BASE, 'public', rel);
    if (!fs.existsSync(abs)) issues.push({ t: 'missing-media', id: p.id, src: p.img.src });
    else {
      const p320 = abs.replace(/-800\.webp$/i, '-320.webp');
      const p120 = abs.replace(/-800\.webp$/i, '-120.webp');
      if (!fs.existsSync(p320)) issues.push({ t: 'missing-320', id: p.id });
      if (!fs.existsSync(p120)) issues.push({ t: 'missing-120', id: p.id });
    }
  }
}
for (let i = 0; i < places.length; i++) {
  for (let j = i + 1; j < places.length; j++) {
    const a = places[i], b = places[j];
    if (a.cat !== b.cat) continue;
    if (km(a, b) < 0.025 && a.name?.es && b.name?.es && a.name.es === b.name.es) {
      issues.push({ t: 'near-dup', a: a.id, b: b.id });
    }
  }
}
const css = fs.readFileSync(path.join(BASE, 'src', 'styles', 'app.css'), 'utf8');
for (const w of [360, 412, 768, 1024]) {
  if (!css.includes(String(w)) && !css.includes('pointer:coarse') && w === 412) {
    // soft check — we mainly ensure coarse/dvh exist
  }
}
const responsiveOk = /pointer:\s*coarse|dvh|safe-area/.test(css);
const summary = {
  places: places.length,
  fauna: places.filter((p) => p.cat === 'fauna' || p.cat === 'faunaTerrestre').length,
  issues: issues.length,
  byType: issues.reduce((m, x) => ((m[x.t] = (m[x.t] || 0) + 1), m), {}),
  responsiveTokens: responsiveOk,
  sample: issues.slice(0, 30),
};
fs.mkdirSync(path.join(BASE, 'perf'), { recursive: true });
fs.writeFileSync(path.join(BASE, 'perf', 'audit-quality.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (issues.some((i) => i.t === 'dup-id')) process.exitCode = 1;
