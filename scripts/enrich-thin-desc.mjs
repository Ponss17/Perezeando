#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { get, mw, log } from './wiki.mjs';
import { ROOT, sleep, norm, isEnglishLooking, km } from './shared.mjs';

const DRY = process.argv.includes('--dry');
const LIMIT = +(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 0);
const CACHE_PATH = path.join(ROOT, 'scripts/data/desc-source-cache.json');
const BRIEFS_PATH = path.join(ROOT, 'scripts/data/briefs.json');
const REPORT_PATH = path.join(ROOT, 'scripts/data/thin-desc-report.json');

const PROV_NAME = {
  sanjose: 'San José',
  alajuela: 'Alajuela',
  cartago: 'Cartago',
  heredia: 'Heredia',
  guanacaste: 'Guanacaste',
  puntarenas: 'Puntarenas',
  limon: 'Limón',
};

const GENERIC_START = [
  'Volcán registrado en el mapa de Costa Rica',
  'Cerro o elevación del relieve costarricense',
  'Parque nacional u área protegida del SINAC',
  'Área silvestre protegida de Costa Rica',
  'Catarata o salto de agua en territorio costarricense',
  'Curso de agua que atraviesa territorio costarricense',
  'Isla o islote del territorio costarricense',
  'Playa del litoral costarricense',
  'Museo o espacio cultural abierto al público',
  'Templo o iglesia de interés local',
  'Sitio arqueológico documentado en Costa Rica',
  'Recinto deportivo de uso público o club',
  'Lugar de interés geográfico o cultural',
  'Cantón o centro poblado de Costa Rica',
  'Puesto o mercado de comida local',
  'Spot de surf del litoral costarricense',
  'Aeródromo o aeropuerto de acceso regional',
  'Puerto o terminal marítima de Costa Rica',
  'Relieve del fondo marino en aguas costarricenses',
  'Hito oceánico en el mar territorial',
  'Área marina de importancia para mamíferos (IMMA)',
  'Área marina de relevancia ecológica (ISRA)',
  'Especie de fauna marina presente en aguas costarricenses',
  'Especie de fauna terrestre presente en Costa Rica',
  'Refugio de vida silvestre',
  'Zona protectora',
  'Reserva forestal',
  'Reserva biológica',
  'Reserva de la biosfera',
  'Humedal protegido',
  'Bosque experimental',
  'Corredor biológico',
  'Área de conservación',
  'Santuario de fauna',
  'Catedral o templo principal',
];

const SKIP_P31 = new Set([
  'Q17334923',
  'Q2221906',
  'Q82794',
  'Q618123',
  'Q811264',
  'Q4167410',
  'Q13406463',
  'Q11266439',
  'Q5',
]);

const CAT_TIPO = {
  volcanes: 'volcán',
  cerros: 'cerro',
  parques: 'parque nacional',
  bosques: 'área silvestre protegida',
  cataratas: 'catarata',
  rios: 'río',
  islas: 'isla',
  playas: 'playa',
  museos: 'museo',
  iglesias: 'iglesia',
  arqueologia: 'sitio arqueológico',
  deportes: 'recinto deportivo',
  ciudades: 'cantón',
  aeropuertos: 'aeródromo',
  puertos: 'puerto',
  surf: 'spot de surf',
};

const VAGUE_TIPO =
  /^(montaña|entidad|accidente geográfico|elemento geográfico|lugar|asentamiento|territorio|área protegida|zona natural|sendero|camino|vía)$/i;

function refineTipo(cat, tipo) {
  if (tipo && !VAGUE_TIPO.test(tipo) && tipo.length < 70) return tipo;
  return '';
}

const OFFICIAL_HOST =
  /(^|\.)((sinac|ict|visitcostarica|presidencia|museos|mcj|dse|inec|ucr|tec|una)\.go\.cr|go\.cr|sinac\.go\.cr)$/i;

function isInCR(lat, lng) {
  const la = Number(lat),
    lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return la >= 5.2 && la <= 11.3 && lo >= -87.3 && lo <= -82.4;
}

function loadJson(rel, fb) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (e) {
    if (fb !== undefined) return fb;
    throw e;
  }
}

const FOREIGN =
  /\b(Acapulco|Guerrero|Penco|Comodoro Rivadavia|Chubut|Villahermosa|Tabasco|Tingo Mar[ií]a|Huánuco|Atlántida, además|Honduras|Urkiola|País Vasco|Vizcaya|El Yali|Santo Domingo(?!,)|departamento de)\b/i;
const CR_OK =
  /\b(Costa Rica|costarricense|Alajuela|Cartago|Guanacaste|Puntarenas|Heredia|Limón|Limon|San José|San Jose)\b/i;

function isWrongPlace(es, src, place) {
  const t = String(es || '');
  const url = String(src?.url || '');
  if (FOREIGN.test(t) && !CR_OK.test(t)) return true;
  if (FOREIGN.test(url) && !CR_OK.test(t)) return true;
  if (
    /Tingo_Mar|El_Yali|Urkiola|La_Venta|La_Ceiba(?!_)|Playa_Bajada|Comodoro|Acapulco/i.test(url) &&
    !CR_OK.test(t)
  )
    return true;
  if (/\ben (México|Chile|Argentina|Perú|Honduras|España|Guatemala)\b/i.test(t) && !CR_OK.test(t))
    return true;
  return false;
}

function isGenericDesc(es) {
  const t = String(es || '').trim();
  if (!t || t.length < 50) return true;
  if (/en la provincia de [^.]+\.$/.test(t) && GENERIC_START.some((s) => t.startsWith(s))) return true;
  if (/en el mar territorial de Costa Rica\.$/.test(t) && GENERIC_START.some((s) => t.startsWith(s)))
    return true;
  if (
    /Forma parte de las áreas silvestres protegidas del país\.$/.test(t) &&
    GENERIC_START.some((s) => t.startsWith(s))
  )
    return true;
  if (/parte de las áreas silvestres del país\.$/.test(t)) return true;
  if (/reconocida por su valor ecológico\.$/.test(t) && t.startsWith('Reserva de la biosfera')) return true;
  if (/orientado a investigación y manejo\.$/.test(t)) return true;
  if (/que conecta fragmentos de hábitat\.$/.test(t)) return true;
  if (/con gestión territorial del SINAC\.$/.test(t)) return true;
  if (/orientado a la protección de especies\.$/.test(t)) return true;
  if (/de interés cultural local\.$/.test(t) && t.startsWith('Catedral')) return true;
  return false;
}

function needsEnrich(p, brief) {
  const b = brief?.es ? String(brief.es).trim() : '';
  if (b.length >= 80 && brief?.src?.url) return false;
  const cur = String(p.desc?.es || '').trim();
  if (b && !isGenericDesc(b) && b.length >= 50 && brief?.src?.url) return false;
  return isGenericDesc(cur) || isGenericDesc(b) || !cur || isEnglishLooking(cur);
}

function artFix(tipo) {
  const t = String(tipo || '')
    .trim()
    .replace(/^(un|una|el|la)\s+/i, '');
  if (!t) return t;
  const fem =
    /^(isla|playa|reserva|zona|catarata|iglesia|basílica|catedral|área|ciudad|aldea|loma|colina|cuesta|serranía|cordillera|caldera|bahía|península|cueva|caverna|laguna|cascada|quebrada|finca|hacienda|plaza|ermita|estación|terminal|universidad|escuela|capilla|torre|pirámide|fortaleza|batería|posada|soda|feria|protección|cumbre|formación|depresión|fosa|trinchera|montaña|sierra|cadena|laguna|bahía|ensenada|ría|quebrada|cataratas|ruinas|termas|aguas)/i;
  return (fem.test(t) ? 'una ' : 'un ') + t;
}

function yearOf(v) {
  const m = String(v || '').match(/^(-?\d{3,4})/);
  return m ? m[1] : '';
}

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  if (x >= 100) return String(Math.round(x));
  if (x >= 10) return String(Math.round(x * 10) / 10);
  return String(Math.round(x * 100) / 100);
}

function claimVals(ent, pid) {
  const arr = ent?.claims?.[pid] || [];
  const out = [];
  for (const c of arr) {
    const dv = c.mainsnak?.datavalue;
    if (!dv) continue;
    out.push(dv);
  }
  return out;
}

function qidsOf(ent, pid) {
  return claimVals(ent, pid)
    .filter((v) => v.type === 'wikibase-entityid')
    .map((v) => 'Q' + v.value.id.replace(/^Q/i, ''))
    .filter((id) => !SKIP_P31.has(id));
}

function qtyOf(ent, pid) {
  const v = claimVals(ent, pid).find((x) => x.type === 'quantity');
  if (!v) return null;
  const amt = parseFloat(v.value.amount);
  const unit = String(v.value.unit || '');
  const uqid = unit.split('/').pop();
  return { amt, uqid };
}

function timeOf(ent, pid) {
  const v = claimVals(ent, pid).find((x) => x.type === 'time');
  return v?.value?.time || '';
}

function coordOf(ent) {
  const v = claimVals(ent, 'P625').find((x) => x.type === 'globecoordinate');
  if (!v) return null;
  return { lat: v.value.latitude, lng: v.value.longitude };
}

function officialUrl(ent) {
  const v = claimVals(ent, 'P856').find((x) => typeof x.value === 'string');
  return v ? String(v.value) : '';
}

function overlapWords(a, b, n = 8) {
  const tok = (s) =>
    norm(s)
      .replace(/[^a-z0-9áéíóúüñ ]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const A = tok(a);
  const B = tok(b);
  if (B.length < n) return A.join(' ').includes(B.join(' '));
  const set = new Set();
  for (let i = 0; i + n <= A.length; i++) set.add(A.slice(i, i + n).join(' '));
  for (let i = 0; i + n <= B.length; i++) if (set.has(B.slice(i, i + n).join(' '))) return true;
  return false;
}

function truncateSentences(text, max = 3) {
  const parts = String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, max).join(' ');
}

function rewriteWiki(name, extract) {
  if (!extract) return '';
  const t = extract
    .replace(/\s+/g, ' ')
    .replace(/\[[\d, ]+\]/g, '')
    .trim();
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lead = (t.split(/(?<=\.)\s+/)[0] || t).trim();
  const re = new RegExp(
    '^(?:El|La|Los|Las)\\s+(?:' +
      esc +
      ')\\s+es\\s+(?:un|una)\\s+(.+?)(?:\\s+(?:ubicad[oa]s?|situad[oa]s?|localizad[oa]s?|(?:que )?se (?:encuentra|ubica|alza|abre))\\s+en\\s+(.+?))?\\.$',
    'i',
  );
  const re2 = new RegExp('^' + esc + '\\s+es\\s+(?:un|una)\\s+(.+?)(?:\\s+en\\s+(.+?))?\\.$', 'i');
  const m = lead.match(re) || lead.match(re2);
  const bits = [];
  if (m) {
    const tipo = m[1]
      .replace(/,?\s*costarricense[s]?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const donde = (m[2] || '')
      .replace(/,?\s*(de\s+)?(la\s+)?República de Costa Rica\.?$/i, '')
      .replace(/,?\s*Costa Rica\.?$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (tipo && tipo.length < 90) {
      bits.push(
        donde ? `${name} es ${artFix(tipo)} en ${donde}.` : `${name} es ${artFix(tipo)} de Costa Rica.`,
      );
    }
  }
  const ym =
    t.match(/fue\s+(cread[oa]|establecid[oa]|inaugurad[oa]|declarad[oa])(?:\s+\S+){0,8}?\s+(\d{4})/i) ||
    t.match(
      /(?:cread[oa]|establecid[oa]|inaugurad[oa]|declarad[oa])\s+(?:el\s+)?(?:\d{1,2}\s+de\s+\w+\s+(?:de|del)\s+)?(\d{4})/i,
    );
  let yearN = '';
  if (ym) yearN = ym[2] || ym[1];
  if (/^\d{4}$/.test(yearN) && bits.length) {
    const verb = /inaugur/i.test(t) ? 'Se inauguró' : 'Se estableció';
    bits.push(`${verb} en ${yearN}.`);
  }
  if (!bits.length) return '';
  const out = bits.join(' ');
  if (overlapWords(out, extract, 10)) return '';
  return out;
}

function compose(place, facts, wiki) {
  const name = (place.name?.es || place.name?.en || '').replace(/\s+/g, ' ').trim();
  const bits = [];
  const tipo = refineTipo(place.cat, facts.tipo);
  const donde = facts.donde;
  if (tipo && donde) bits.push(`${name} es ${artFix(tipo)} en ${donde}.`);
  else if (tipo) bits.push(`${name} es ${artFix(tipo)} de Costa Rica.`);
  else if (donde) bits.push(`${name} se encuentra en ${donde}.`);
  if (facts.elev && !(place.cat === 'playas' && facts.elev <= 8))
    bits.push(`Su altitud es de ${fmtNum(facts.elev)} m.`);
  if (facts.area) {
    const a = facts.area;
    bits.push(a >= 1 ? `Cubre unos ${fmtNum(a)} km².` : `Cubre unas ${fmtNum(a * 100)} ha.`);
  }
  if (facts.year) {
    const v = facts.yearVerb || 'Se estableció';
    bits.push(`${v} en ${facts.year}.`);
  }
  if (facts.parteDe && !norm(name).includes(norm(facts.parteDe)) && !norm(facts.parteDe).includes(norm(name)))
    bits.push(`Forma parte de ${facts.parteDe}.`);
  if (facts.pop) bits.push(`Tiene ${fmtNum(facts.pop)} habitantes.`);
  if (facts.largo) bits.push(`Tiene una longitud de unos ${fmtNum(facts.largo)} km.`);
  let text = bits.slice(0, 3).join(' ');
  if ((!text || text.length < 50) && wiki?.extract) {
    const rw = rewriteWiki(name, wiki.extract);
    if (rw && !overlapWords(rw, wiki.extract, 10)) text = text ? truncateSentences(text + ' ' + rw, 3) : rw;
  }
  text = truncateSentences(text, 3).replace(/\s+/g, ' ').trim();
  text = text.replace(/Forma parte de Sistema /g, 'Forma parte del Sistema ');
  text = text.replace(/Forma parte de Parque /g, 'Forma parte del Parque ');
  text = text.replace(/Forma parte de Área /g, 'Forma parte del Área ');
  if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
  if (text.length < 50) return null;
  if (wiki?.extract && overlapWords(text, wiki.extract, 10)) return null;
  if (isEnglishLooking(text)) return null;
  return text;
}

function composeEn(place, facts, esText) {
  const name = (place.name?.en || place.name?.es || '').replace(/\s+/g, ' ').trim();
  const bits = [];
  const tipo = facts.tipoEn || facts.tipo;
  const donde = facts.dondeEn || facts.donde;
  if (tipo && donde) bits.push(`${name} is a ${tipo} in ${donde}.`);
  else if (tipo) bits.push(`${name} is a ${tipo} in Costa Rica.`);
  else if (donde) bits.push(`${name} is in ${donde}.`);
  if (facts.elev) bits.push(`Its elevation is ${fmtNum(facts.elev)} m.`);
  if (facts.year) bits.push(`It was established in ${facts.year}.`);
  if (facts.parteDeEn || facts.parteDe) bits.push(`It is part of ${facts.parteDeEn || facts.parteDe}.`);
  const t = bits.slice(0, 3).join(' ');
  return t.length >= 40 ? t : esText;
}

function tidyPlace(label) {
  const t = String(label || '').trim();
  if (!t) return t;
  if (/^(cantón|canton)\b/i.test(t) && !/^(el|la)\s/i.test(t))
    return 'el ' + t.charAt(0).toLowerCase() + t.slice(1);
  if (/^(provincia)\b/i.test(t) && !/^(el|la)\s/i.test(t))
    return 'la ' + t.charAt(0).toLowerCase() + t.slice(1);
  if (/^(distrito)\b/i.test(t) && !/^(el|la)\s/i.test(t))
    return 'el ' + t.charAt(0).toLowerCase() + t.slice(1);
  return t;
}

function dondeFromLabels(labels, prov) {
  const raw = [...new Set(labels.filter(Boolean))];
  let canton = '',
    provincia = '',
    rest = [];
  for (const l of raw) {
    if (/cant[oó]n/i.test(l)) canton = tidyPlace(l);
    else if (/provincia/i.test(l)) provincia = tidyPlace(l);
    else rest.push(tidyPlace(l));
  }
  if (!provincia && prov && PROV_NAME[prov] && prov !== 'mar')
    provincia = `la provincia de ${PROV_NAME[prov]}`;
  return [canton, ...rest, provincia].filter(Boolean).join(', ');
}

const cache = loadJson('scripts/data/desc-source-cache.json', { wd: {}, wiki: {}, search: {} });
function saveCache() {
  if (DRY) return;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

async function fetchEntities(ids) {
  const need = ids.filter((id) => id && !cache.wd[id]);
  const out = {};
  for (const id of ids) if (cache.wd[id]) out[id] = cache.wd[id];
  for (let i = 0; i < need.length; i += 40) {
    const chunk = need.slice(i, i + 40);
    const d = await get(
      'https://www.wikidata.org/w/api.php?' +
        new URLSearchParams({
          action: 'wbgetentities',
          format: 'json',
          formatversion: '2',
          origin: '*',
          props: 'labels|descriptions|claims|sitelinks',
          languages: 'es|en',
          ids: chunk.join('|'),
        }),
    );
    for (const [qid, ent] of Object.entries(d.entities || {})) {
      if (!ent || ent.missing) {
        cache.wd[qid] = { missing: true };
        continue;
      }
      cache.wd[qid] = ent;
      out[qid] = ent;
    }
    await sleep(200);
  }
  return out;
}

async function wikiSummary(title) {
  if (!title) return null;
  const key = 'es:' + title;
  if (cache.wiki[key] !== undefined) return cache.wiki[key];
  const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  try {
    const d = await get(url, {}, 3);
    if (
      !d ||
      d.type === 'disambiguation' ||
      d.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found'
    ) {
      cache.wiki[key] = null;
      return null;
    }
    const extract = String(d.extract || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!extract || extract.length < 40 || isEnglishLooking(extract)) {
      cache.wiki[key] = null;
      return null;
    }
    const rec = {
      title: d.title || title,
      extract,
      lat: d.coordinates?.[0]?.lat ?? d.lat,
      lng: d.coordinates?.[0]?.lon ?? d.lon,
    };
    cache.wiki[key] = rec;
    return rec;
  } catch {
    cache.wiki[key] = null;
    return null;
  }
}

async function wikiSearch(place) {
  const name = place.name?.es || place.name?.en;
  if (!name) return null;
  const key = norm(name) + '|' + (place.cat || '');
  if (cache.search[key] !== undefined) return cache.search[key];
  try {
    const d = await mw('es.wikipedia.org', {
      action: 'query',
      list: 'search',
      srsearch: `"${name}" Costa Rica`,
      srlimit: '5',
      srprop: 'snippet',
    });
    const hits = d.query?.search || [];
    let best = null;
    for (const h of hits) {
      const title = h.title;
      if (/desambiguación|disambig|lista de|anexo:/i.test(title)) continue;
      const sum = await wikiSummary(title);
      await sleep(120);
      if (!sum) continue;
      const same =
        norm(sum.title) === norm(name) ||
        norm(sum.title).includes(norm(name)) ||
        norm(name).includes(norm(sum.title));
      const inCR = sum.lat != null ? isInCR(sum.lat, sum.lng) : null;
      if (inCR === false) continue;
      let near = false;
      if (sum.lat != null && Number.isFinite(place.lat)) {
        near = km({ lat: place.lat, lng: place.lng }, { lat: sum.lat, lng: sum.lng }) < 12;
      }
      if ((same && inCR !== false) || near) {
        best = sum;
        break;
      }
    }
    cache.search[key] = best;
    return best;
  } catch {
    cache.search[key] = null;
    return null;
  }
}

function factsFromEnt(place, ent, labels) {
  if (!ent || ent.missing) return {};
  const tipoQ = qidsOf(ent, 'P31')[0];
  const locQ = qidsOf(ent, 'P131');
  const partQ = qidsOf(ent, 'P361')[0] || qidsOf(ent, 'P706')[0];
  const tipo = tipoQ && labels[tipoQ]?.es && !isEnglishLooking(labels[tipoQ].es) ? labels[tipoQ].es : '';
  const tipoEn = tipoQ ? labels[tipoQ]?.en || labels[tipoQ]?.es : '';
  const locEs = locQ.map((q) => labels[q]?.es).filter((x) => x && !isEnglishLooking(x));
  const locEn = locQ.map((q) => labels[q]?.en).filter(Boolean);
  const elevQ = qtyOf(ent, 'P2044');
  let elev = elevQ?.amt;
  if (elevQ && (elevQ.uqid === 'Q3710' || /foot|Q3710/.test(elevQ.uqid || ''))) elev = elev * 0.3048;
  const areaQ = qtyOf(ent, 'P2046');
  let area = areaQ?.amt;
  if (areaQ) {
    if (areaQ.uqid === 'Q25343' || /metre|Q25343/.test(areaQ.uqid || '')) area = area / 1e6;
    if (areaQ.uqid === 'Q35852' || /hectare|Q35852/.test(areaQ.uqid || '')) area = area / 100;
  }
  const largoQ = qtyOf(ent, 'P2043');
  let largo = largoQ?.amt;
  if (largoQ && (largoQ.uqid === 'Q11573' || /metre$|Q11573/.test(largoQ.uqid || ''))) largo = largo / 1000;
  const popQ = qtyOf(ent, 'P1082');
  const year = yearOf(timeOf(ent, 'P571') || timeOf(ent, 'P1619') || timeOf(ent, 'P729'));
  const inaug = !!timeOf(ent, 'P1619');
  const parteDe = partQ && labels[partQ]?.es && !isEnglishLooking(labels[partQ].es) ? labels[partQ].es : '';
  const parteDeEn = partQ ? labels[partQ]?.en || labels[partQ]?.es : '';
  const pais = qidsOf(ent, 'P17')[0];
  return {
    tipo: tipo && !/^entidad /i.test(tipo) ? tipo : '',
    tipoEn,
    donde: dondeFromLabels(locEs, place.prov),
    dondeEn: dondeFromLabels(locEn, place.prov),
    elev: Number.isFinite(elev) ? elev : 0,
    area: Number.isFinite(area) && area > 0 ? area : 0,
    largo: Number.isFinite(largo) && largo > 0 ? largo : 0,
    pop: popQ?.amt && popQ.amt > 0 ? popQ.amt : 0,
    year,
    yearVerb: inaug ? 'Se inauguró' : 'Se estableció',
    parteDe,
    parteDeEn,
    pais,
    official: officialUrl(ent),
    coord: coordOf(ent),
    eswiki: ent.sitelinks?.eswiki?.title,
    enwiki: ent.sitelinks?.enwiki?.title,
    descEs: ent.labels?.es?.value ? ent.descriptions?.es?.value : ent.descriptions?.es?.value,
  };
}

function srcWiki(sum) {
  const title = sum.title.replace(/ /g, '_');
  return {
    name: 'Wikipedia ES',
    url: `https://es.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    license: 'CC BY-SA 4.0',
  };
}

function srcWd(q) {
  return { name: 'Wikidata', url: `https://www.wikidata.org/wiki/${q}`, license: 'CC0' };
}

function srcOfficial(url) {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  const name = /sinac/i.test(host) ? 'SINAC' : /ict|visitcostarica/i.test(host) ? 'ICT' : 'Sitio oficial';
  return { name, url };
}

async function officialText(url) {
  if (!url) return null;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (!OFFICIAL_HOST.test(host)) return null;
  const key = 'off:' + url;
  if (cache.wiki[key] !== undefined) return cache.wiki[key];
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'PerezeandoContentBot/1.0 (https://perezeando.com; build-time fetch)' },
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    });
    if (!r.ok) {
      cache.wiki[key] = null;
      return null;
    }
    const html = await r.text();
    const md =
      html.match(
        /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i,
      );
    const t = md?.[1]?.replace(/\s+/g, ' ').trim() || '';
    if (t.length >= 50 && !isEnglishLooking(t) && !/wordpress|woocommerce|cookie/i.test(t)) {
      cache.wiki[key] = t;
      return t;
    }
    cache.wiki[key] = null;
    return null;
  } catch {
    cache.wiki[key] = null;
    return null;
  }
}

function collectPlaces() {
  const curated = loadJson('data/places.json', []);
  const wd = loadJson('data/places-wd.json', []);
  const extra = loadJson('data/places-extra.json', []);
  const fauna = loadJson('data/fauna-extra.json', []);
  const osmRaw = loadJson('data/places-osm.json', { places: [] });
  const osm = Array.isArray(osmRaw) ? osmRaw : osmRaw.places || [];
  const enrich = loadJson('data/enrich.json', {});
  const all = [...curated, ...wd, ...osm, ...extra, ...fauna];
  const by = new Map();
  for (const p of all) if (p?.id && !by.has(p.id)) by.set(p.id, p);
  for (const [id, p] of by) {
    if (enrich[id]) p.x = { ...(p.x || {}), ...enrich[id] };
  }
  return [...by.values()];
}

async function main() {
  const places = collectPlaces();
  const briefs = loadJson('scripts/data/briefs.json', {});
  const atlas = loadJson('public/data/atlas.json', { places: [] });
  const atlasBy = new Map(atlas.places.map((p) => [p.id, p]));
  for (const p of places) {
    const a = atlasBy.get(p.id);
    if (a?.desc) p.desc = a.desc;
  }

  const candidates = places.filter((p) => {
    const es = p.desc?.es || '';
    const br = briefs[p.id];
    return (
      isGenericDesc(es) ||
      isEnglishLooking(es) ||
      isWrongPlace(es, br?.src, p) ||
      isWrongPlace(br?.es || '', br?.src, p)
    );
  });
  const todo = LIMIT > 0 ? candidates.slice(0, LIMIT) : candidates;
  log('candidatos', candidates.length, 'procesando', todo.length);

  const qids = [...new Set(todo.map((p) => p.q || p.x?.qid).filter(Boolean))];
  log('Wikidata', qids.length);
  const ents = await fetchEntities(qids);
  const related = new Set();
  for (const ent of Object.values(ents)) {
    if (!ent || ent.missing) continue;
    for (const pid of ['P31', 'P131', 'P361', 'P706', 'P17'])
      for (const q of qidsOf(ent, pid)) related.add(q);
  }
  const labels = {};
  const relEnts = await fetchEntities([...related]);
  for (const [q, ent] of Object.entries({ ...ents, ...relEnts })) {
    if (!ent || ent.missing) continue;
    const esL = ent.labels?.es;
    const enL = ent.labels?.en;
    labels[q] = {
      es: esL && esL.language === 'es' ? esL.value : '',
      en: enL && (!enL.language || enL.language === 'en') ? enL.value : '',
    };
  }
  saveCache();

  let improved = 0;
  let srcOnly = 0;
  let noSource = 0;
  const samples = [];
  const leftover = [];

  for (const p of todo) {
    const q = p.q || p.x?.qid;
    const ent = q ? cache.wd[q] : null;
    const facts = factsFromEnt(p, ent, labels);
    let wiki = null;
    const title = p.wiki?.es || facts.eswiki;
    if (title) wiki = await wikiSummary(title);
    if (!wiki && p.wiki?.en) {
      const esFromEn = cache.wd[q]?.sitelinks?.eswiki?.title;
      if (esFromEn) wiki = await wikiSummary(esFromEn);
    }
    if (
      !wiki &&
      !q &&
      [
        'parques',
        'volcanes',
        'bosques',
        'islas',
        'playas',
        'cerros',
        'cataratas',
        'rios',
        'museos',
        'iglesias',
        'arqueologia',
        'ciudades',
        'hitos',
        'aeropuertos',
      ].includes(p.cat)
    ) {
      wiki = await wikiSearch(p);
    }
    await sleep(100);

    let official = null;
    const offUrl =
      facts.official ||
      p.x?.sinac ||
      (p.x?.web &&
      OFFICIAL_HOST.test(
        (() => {
          try {
            return new URL(p.x.web).hostname;
          } catch {
            return '';
          }
        })(),
      )
        ? p.x.web
        : '');
    if (offUrl && !wiki && !facts.tipo) {
      official = await officialText(offUrl);
      await sleep(150);
    }

    const esOnlyFacts = compose(p, facts, null);
    const es = esOnlyFacts || compose(p, facts, wiki);
    let usedSrc = null;
    let text = es;
    if (text) {
      if (esOnlyFacts && q) usedSrc = srcWd(q);
      else if (wiki) usedSrc = srcWiki(wiki);
      else if (q) usedSrc = srcWd(q);
    } else if (official && official.length >= 50) {
      const name = p.name?.es || '';
      const rw = `${name} ${official.endsWith('.') ? official : official + '.'}`;
      if (!isEnglishLooking(rw) && rw.length >= 50 && rw.length <= 400) {
        const first = official.replace(/\s+/g, ' ').trim();
        text = first.length > 280 ? first.slice(0, first.lastIndexOf(' ', 280)) + '.' : first;
        if (!/[.!?]$/.test(text)) text += '.';
        if (text.length >= 50) usedSrc = srcOfficial(offUrl);
      }
    }

    const prev = briefs[p.id] || {};
    const prevEs = String(prev.es || '').trim();
    const prevOk =
      prevEs.length >= 50 &&
      !isGenericDesc(prevEs) &&
      !isEnglishLooking(prevEs) &&
      !isWrongPlace(prevEs, prev.src, p);
    if (prevOk) {
      if (!prev.src && q) {
        briefs[p.id] = { ...prev, src: srcWd(q) };
        srcOnly++;
      } else {
        noSource++;
        leftover.push({
          id: p.id,
          cat: p.cat,
          name: p.name?.es,
          q: q || '',
          wiki: p.wiki?.es || '',
          skip: 'had-brief',
        });
      }
    } else if (text && usedSrc) {
      briefs[p.id] = {
        es: text,
        en: composeEn(p, facts, text),
        src: usedSrc,
      };
      if (prev.en && prev.en !== prev.es && !facts.tipoEn) briefs[p.id].en = prev.en;
      improved++;
      if (samples.length < 20)
        samples.push({
          id: p.id,
          es: text,
          src: usedSrc.name,
          replaced: prevOk ? undefined : prevEs.slice(0, 80),
        });
    } else {
      if (prevEs && isWrongPlace(prevEs, prev.src, p)) {
        delete briefs[p.id];
        leftover.push({ id: p.id, cat: p.cat, name: p.name?.es, q: q || '', wiki: 'REMOVED-wrong-place' });
      }
      if (briefs[p.id]?.es && !briefs[p.id].src && q) {
        briefs[p.id] = { ...briefs[p.id], src: srcWd(q) };
        srcOnly++;
      } else {
        noSource++;
        leftover.push({ id: p.id, cat: p.cat, name: p.name?.es, q: q || '', wiki: p.wiki?.es || '' });
      }
    }
    if ((improved + noSource) % 25 === 0) saveCache();
  }

  saveCache();
  const report = {
    at: new Date().toISOString(),
    candidates: candidates.length,
    processed: todo.length,
    improved,
    srcOnly,
    noSource,
    briefsTotal: Object.keys(briefs).length,
    samples,
    leftoverCats: leftover.reduce((m, x) => ((m[x.cat] = (m[x.cat] || 0) + 1), m), {}),
  };
  if (!DRY) {
    fs.writeFileSync(BRIEFS_PATH, JSON.stringify(briefs, null, 2) + '\n');
    fs.writeFileSync(REPORT_PATH, JSON.stringify({ ...report, leftover }, null, 2) + '\n');
    log('escrito briefs.json', Object.keys(briefs).length, 'entradas');
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
