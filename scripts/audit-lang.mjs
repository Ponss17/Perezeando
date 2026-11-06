#!/usr/bin/env node
/** Auditoría determinista: cero descripciones ES que parezcan inglés (sin falsos positivos por nombres propios). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/atlas.json'), 'utf8'));

const EN_DESC_RE =
  /\b(the|and|with|from|which|located|situated|known as|is a|was a|are a|national park|protected area|wildlife refuge|nature reserve|founded in|population of|square kilometres|pacific ocean|caribbean)\b/i;
const ES_MARK_RE =
  /[áéíóúñ¿¡]|\b(el|la|los|las|un|una|del|al|es|son|está|fue|para|con|desde|que|ubicad|conocid|parque|playa|río|volcán|provincia|municipio|refugio|reserva|área|silvestre|también|durante|entre|cerca|norte|sur|costarricense|nacional|proteg|cantón|distrito|en|de|sobre|junto|casa|estadio|museo|iglesia|playa|cerro|isla)\b/i;

function isEnglishLooking(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 12) return false;
  if (ES_MARK_RE.test(t)) return false;
  const hits = t.match(EN_DESC_RE) || [];
  return hits.length >= 2 || (hits.length >= 1 && t.length > 50);
}

const bad = [];
let onlyEnWiki = 0;
let thin = 0;
for (const p of atlas.places) {
  const es = p.desc?.es || '';
  if (isEnglishLooking(es)) bad.push({ id: p.id, es: es.slice(0, 200) });
  if (es.trim().length < 50) thin++;
  if (p.wiki?.en && !p.wiki?.es) onlyEnWiki++;
}

const report = {
  total: atlas.places.length,
  englishOnlyDescEs: bad.length,
  thinUnder50: thin,
  wikiEnWithoutEs: onlyEnWiki,
  samples: bad.slice(0, 20),
};

fs.writeFileSync(path.join(ROOT, 'scripts/data/lang-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (bad.length) {
  console.error(`FAIL: ${bad.length} descripciones ES parecen inglés`);
  process.exit(1);
}
console.log('OK: 0 descripciones ES en inglés detectadas');
