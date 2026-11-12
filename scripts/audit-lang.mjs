#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { isEnglishLooking, ROOT } from './shared.mjs';

const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/atlas.json'), 'utf8'));

const ES_MARK_AUDIT_RE =
  /[áéíóúñ¿¡]|\b(el|la|los|las|un|una|del|al|es|son|está|fue|para|con|desde|que|ubicad|conocid|parque|playa|río|volcán|provincia|municipio|refugio|reserva|área|silvestre|también|durante|entre|cerca|norte|sur|costarricense|nacional|proteg|cantón|distrito|en|de|sobre|junto|casa|estadio|museo|iglesia|playa|cerro|isla)\b/i;

const bad = [];
let onlyEnWiki = 0;
let thin = 0;
for (const p of atlas.places) {
  const es = p.desc?.es || '';
  if (isEnglishLooking(es, ES_MARK_AUDIT_RE)) bad.push({ id: p.id, es: es.slice(0, 200) });
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
