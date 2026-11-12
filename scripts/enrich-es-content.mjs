#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { clip, get, log, mw } from './wiki.mjs';
import { ES_MARK_RE, fold, isEnglishLooking, ROOT, sleep } from './shared.mjs';

const DRY = process.argv.includes('--dry');
const LIMIT = +(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 0);

const GENERIC = new Set([
  'canton de costa rica',
  'rio en costa rica',
  'montana en costa rica',
  'area protegida en costa rica',
  'area protegida de costa rica',
  'isla en costa rica',
  'reserva natural en costa rica',
  'recinto deportivo',
  'recinto deportivo en costa rica',
  'estadio de futbol en costa rica',
  'estadio de futbol costarricense',
  'infrastructura deportiva',
  'parque nacional en costa rica',
  'volcan de costa rica',
  'volcan extinto en costa rica',
  'estratovolcan localizado costa rica',
  'estratovolcan de costa rica',
  'cerro en la provincia de san jose.',
  'cerro en la provincia de limon.',
  'cerro en la provincia de heredia.',
  'cerro en la provincia de alajuela.',
  'cerro en la provincia de cartago.',
  'cerro en la provincia de guanacaste.',
  'cerro en la provincia de puntarenas.',
]);

const EN_NAME_RE =
  /\b(wildlife refuge|protected zone|forest reserve|biological reserve|national park|mixed wildlife|lacustrine wetland|experimental forest|hanging bridges|nature reserve|conservation area|rainforest preserve)\b/i;

function isThinEs(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (GENERIC.has(fold(t))) return true;
  if (isEnglishLooking(t)) return true;
  if (t.length <= 55) return true;
  if (/^(Estratovolcán|Volcán|Cerro|Parque nacional|Área silvestre|Catarata|Río|Isla|Playa|Museo|Iglesia|Sitio arqueológico|Recinto deportivo|Cantón|Puesto de comida|Spot de surf|Aeropuerto|Puerto|Lugar de interés|Refugio|Reserva|Zona protectora|Humedal|Santuario|Corredor)\b/i.test(t) && t.length < 110) {
    if (/en la provincia de|en el mar territorial|Forma parte de las áreas silvestres/i.test(t)) return true;
  }
  return false;
}

function spanishifyName(name) {
  if (!name) return name;
  let s = name;
  const reps = [
    [/Mixed Wildlife Refuge/gi, 'Refugio de Vida Silvestre Mixto'],
    [/Wildlife Refuge/gi, 'Refugio de Vida Silvestre'],
    [/Wildlife Reserve/gi, 'Reserva de Vida Silvestre'],
    [/Protected Zone/gi, 'Zona Protectora'],
    [/Forest Reserve/gi, 'Reserva Forestal'],
    [/Biological Reserve/gi, 'Reserva Biológica'],
    [/National Park/gi, 'Parque Nacional'],
    [/Lacustrine Wetland/gi, 'Humedal Lacustre'],
    [/Experimental Forest/gi, 'Bosque Experimental'],
    [/Hanging Bridges/gi, 'Puentes Colgantes'],
    [/Nature Reserve/gi, 'Reserva Natural'],
    [/Conservation Area/gi, 'Área de Conservación'],
    [/Rainforest Preserve/gi, 'Reserva de Bosque Húmedo'],
    [/National Wetlands/gi, 'Humedal Nacional'],
  ];
  for (const [re, to] of reps) s = s.replace(re, to);
  return s;
}

async function wikiSummary(lang, title) {
  if (!title) return null;
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  try {
    const d = await get(url, {}, 3);
    if (!d || d.type === 'disambiguation' || d.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return null;
    const extract = String(d.extract || '').replace(/\s+/g, ' ').trim();
    if (!extract || extract.length < 40) return null;
    return { title: d.title || title, extract, lang };
  } catch {
    return null;
  }
}

async function voySummary(lang, title) {
  if (!title) return null;
  try {
    const d = await mw(`${lang}.wikivoyage.org`, {
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      redirects: '1',
      titles: title,
    });
    const p = d.query?.pages?.[0];
    const extract = String(p?.extract || '').replace(/\s+/g, ' ').trim();
    if (!extract || extract.length < 40) return null;
    return { title: p.title || title, extract, lang };
  } catch {
    return null;
  }
}

async function resolveEsTitles(qids) {
  const out = new Map();
  const uniq = [...new Set(qids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 40) {
    const chunk = uniq.slice(i, i + 40);
    const d = await get(
      'https://www.wikidata.org/w/api.php?' +
        new URLSearchParams({
          action: 'wbgetentities',
          format: 'json',
          formatversion: '2',
          origin: '*',
          props: 'sitelinks|labels',
          languages: 'es|en',
          sitefilter: 'eswiki|enwiki|eswikivoyage',
          ids: chunk.join('|'),
        }),
      {},
      3,
    );
    for (const [qid, ent] of Object.entries(d.entities || {})) {
      if (!ent || ent.missing) continue;
      out.set(qid, {
        eswiki: ent.sitelinks?.eswiki?.title,
        enwiki: ent.sitelinks?.enwiki?.title,
        esvoy: ent.sitelinks?.eswikivoyage?.title,
        labelEs: ent.labels?.es?.value,
        labelEn: ent.labels?.en?.value,
      });
    }
    await sleep(200);
  }
  return out;
}

function loadJson(rel, fallback) {
  const p = path.join(ROOT, rel);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

function writeJson(rel, data) {
  const p = path.join(ROOT, rel);
  if (DRY) {
    log('dry: no escribo', rel);
    return;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, rel.endsWith('briefs.json') ? 2 : undefined) + (rel.endsWith('.json') ? '\n' : ''));
  log('escrito', rel);
}

async function main() {
  const wd = loadJson('data/places-wd.json', []);
  const curated = loadJson('data/places.json', []);
  const osmRaw = loadJson('data/places-osm.json', { places: [] });
  const osm = Array.isArray(osmRaw) ? osmRaw : osmRaw.places || [];
  const extra = loadJson('data/places-extra.json', []);
  const briefs = loadJson('scripts/data/briefs.json', {});
  const enrich = loadJson('data/enrich.json', {});

  const all = [...curated, ...wd, ...osm, ...extra];

  const needQ = [];
  for (const p of [...wd, ...extra]) {
    if (!p.q) continue;
    if (!p.wiki?.es) needQ.push(p.q);
  }
  log('resolviendo sitelinks ES:', needQ.length, 'Q-ids');
  const links = await resolveEsTitles(needQ);

  let wikiEsAdded = 0;
  let namesFixed = 0;
  for (const p of wd) {
    const info = p.q ? links.get(p.q) : null;
    if (info?.eswiki && !p.wiki?.es) {
      p.wiki = { ...(p.wiki || {}), es: info.eswiki };
      wikiEsAdded++;
    }
    if (info?.esvoy && enrich[p.id] && !enrich[p.id].voy?.es) {
      enrich[p.id].voy = { ...(enrich[p.id].voy || {}), es: info.esvoy };
    }
    const esName = p.name?.es || '';
    if (EN_NAME_RE.test(esName) || (!ES_MARK_RE.test(esName) && EN_NAME_RE.test(esName))) {
      const fixed = spanishifyName(esName);
      if (fixed !== esName) {
        p.name.es = fixed;
        namesFixed++;
      }
    } else if (info?.labelEs && EN_NAME_RE.test(esName)) {
      p.name.es = info.labelEs;
      namesFixed++;
    }
  }

  for (const p of extra) {
    const info = p.q ? links.get(p.q) : null;
    if (info?.eswiki && !p.wiki?.es) {
      p.wiki = { ...(p.wiki || {}), es: info.eswiki };
      wikiEsAdded++;
    }
  }

  const candidates = [];
  for (const p of all) {
    const es = p.desc?.es || '';
    const hasBrief = !!briefs[p.id]?.es;
    if (hasBrief && !isThinEs(briefs[p.id].es) && !isEnglishLooking(briefs[p.id].es)) continue;
    if (!isThinEs(es) && !isEnglishLooking(es) && !(hasBrief && isThinEs(briefs[p.id].es))) continue;
    const score =
      (p.wiki?.es ? 50 : 0) +
      (p.wiki?.en ? 10 : 0) +
      (p.q ? 20 : 0) +
      (['parques', 'volcanes', 'museos', 'hitos', 'bosques', 'playas', 'ciudades', 'iglesias', 'arqueologia', 'deportes'].includes(p.cat) ? 15 : 0) +
      Math.min(30, Math.floor((80 - (es || '').length) / 2));
    candidates.push({ p, score, es });
  }
  candidates.sort((a, b) => b.score - a.score);
  const todo = LIMIT > 0 ? candidates.slice(0, LIMIT) : candidates;
  log('candidatos a enriquecer:', candidates.length, '· procesando', todo.length);

  let briefsAdded = 0;
  let briefsUpdated = 0;
  let failed = 0;
  const report = { wikiEsAdded, namesFixed, briefsAdded: 0, briefsUpdated: 0, failed: 0, samples: [] };

  for (const { p } of todo) {
    let sum = null;
    if (p.wiki?.es) sum = await wikiSummary('es', p.wiki.es);
    if (!sum && p.q && links.get(p.q)?.eswiki) sum = await wikiSummary('es', links.get(p.q).eswiki);
    if (!sum && enrich[p.id]?.voy?.es) sum = await voySummary('es', enrich[p.id].voy.es);
    if (!sum && p.name?.es && p.wiki?.es) {
      /* already tried */
    } else if (!sum && p.name?.es && /^(Parque|Volcán|Museo|Reserva|Refugio|Basílica|Catedral|Cerro|Isla|Playa|Río)\b/i.test(p.name.es)) {
      sum = await wikiSummary('es', p.name.es);
    }
    await sleep(160);
    if (!sum || isEnglishLooking(sum.extract)) {
      failed++;
      continue;
    }
    let text = clip(sum.extract, 320);
    if (isThinEs(text) && sum.extract.length > text.length) text = clip(sum.extract, 380);
    if (isEnglishLooking(text) || text.length < 40) {
      failed++;
      continue;
    }
    const prev = briefs[p.id];
    briefs[p.id] = {
      es: text,
      en: prev?.en || undefined,
      src: {
        name: sum.lang === 'es' ? 'Wikipedia ES' : 'Wikipedia',
        url: `https://${sum.lang}.wikipedia.org/wiki/${encodeURIComponent(sum.title.replace(/ /g, '_'))}`,
        license: 'CC BY-SA 4.0',
      },
    };
    if (prev?.es) briefsUpdated++;
    else briefsAdded++;
    if (report.samples.length < 12) report.samples.push({ id: p.id, es: text.slice(0, 140) });
  }

  report.briefsAdded = briefsAdded;
  report.briefsUpdated = briefsUpdated;
  report.failed = failed;

  writeJson('data/places-wd.json', wd);
  writeJson('data/places-extra.json', extra);
  writeJson('data/enrich.json', enrich);
  if (!DRY) {
    fs.writeFileSync(path.join(ROOT, 'scripts/data/briefs.json'), JSON.stringify(briefs, null, 2) + '\n');
    log('escrito scripts/data/briefs.json ·', Object.keys(briefs).length, 'entradas');
  }

  const outReport = path.join(ROOT, 'scripts/data/enrich-report.json');
  if (!DRY) fs.writeFileSync(outReport, JSON.stringify({ ...report, briefsTotal: Object.keys(briefs).length, at: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
