import fs from 'node:fs';
import { chunks, fileFromP18, log, mw, pageUrl, qid, sparql, stripHtml, wikiTitle } from './wiki.mjs';

export async function clubs() {
  const rows = await sparql(`SELECT ?c ?cLabel ?img ?logo ?venue ?venueLabel ?coord ?lc ?eswiki ?league ?leagueLabel WHERE {
    ?c wdt:P31/wdt:P279* wd:Q476028; wdt:P17 wd:Q800.
    OPTIONAL { ?c wdt:P118 ?league }
    OPTIONAL { ?c wdt:P115 ?venue. ?venue wdt:P625 ?coord }
    OPTIONAL { ?c (wdt:P159|wdt:P131) ?loc. ?loc wdt:P625 ?lc }
    OPTIONAL { ?c wdt:P18 ?img } OPTIONAL { ?c wdt:P154 ?logo }
    ?eswiki schema:about ?c; schema:isPartOf <https://es.wikipedia.org/>.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } }`);
  const by = new Map();
  for (const r of rows) {
    const q = qid(r.c);
    const pt = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(r.coord || r.lc || '');
    if (!pt) continue;
    const cur = by.get(q) || { qid: q, name: r.cLabel, venue: r.venueLabel, logo: fileFromP18(r.logo), img: fileFromP18(r.img), lng: +pt[1], lat: +pt[2], wiki: wikiTitle(r.eswiki), leagues: new Set() };
    if (r.leagueLabel) cur.leagues.add(r.leagueLabel);
    by.set(q, cur);
  }
  return [...by.values()].filter((c) => c.leagues.size || c.venue);
}

const ORG_TITLES = ['Federación Costarricense de Fútbol', 'Unión de Clubes de Fútbol de la Primera División', 'Liga Nacional de Fútbol Aficionado', 'Instituto Costarricense del Deporte y la Recreación', 'Comité Olímpico de Costa Rica', 'Federación de Surf de Costa Rica', 'Federación Costarricense de Baloncesto', 'Federación Costarricense de Voleibol'];
async function wdEntities(ids) {
  const out = {};
  for (const c of chunks([...new Set(ids)], 50)) {
    const d = await mw('www.wikidata.org', { action: 'wbgetentities', ids: c.join('|'), props: 'claims|sitelinks|labels', languages: 'es|en', sitefilter: 'eswiki' });
    Object.assign(out, d.entities || {});
  }
  return out;
}
const claimVal = (e, p) => (e?.claims?.[p] || []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
async function commonsThumbs(files, w = 120) {
  const m = new Map();
  for (const c of chunks([...new Set(files)], 40)) {
    const d = await mw('commons.wikimedia.org', { action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(w), iiextmetadatafilter: 'Artist|LicenseShortName', titles: c.map((f) => 'File:' + f).join('|') });
    const norms = new Map((d.query.normalized || []).map((n) => [n.to, n.from]));
    for (const p of d.query.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl) continue;
      m.set((norms.get(p.title) || p.title).replace(/^File:/, ''), { src: ii.thumburl.split('?')[0], page: ii.descriptionurl, artist: stripHtml(ii.extmetadata?.Artist?.value)?.slice(0, 60), license: stripHtml(ii.extmetadata?.LicenseShortName?.value), from: 'commons' });
    }
  }
  return m;
}
const CREST_RE = /(escudo|logo|crest|badge|emblema|shield|insignia)/i;
const NOT_CREST = /(flag|bandera|commons-logo|wiki|edit|icon|question|soccer_ball|balon|football_pictogram|disambig|kit[ _]|[ _]kit|stadium|estadio|map|mapa|location)/i;
async function wikiThumbs(titles, w = 120) {
  const m = new Map();
  for (const c of chunks([...new Set(titles)], 20)) {
    const d = await mw('es.wikipedia.org', { action: 'query', prop: 'images|pageimages|pageprops', piprop: 'name', ppprop: 'wikibase_item', imlimit: 'max', redirects: '1', titles: c.join('|') });
    const back = new Map();
    for (const n of d.query.normalized || []) back.set(n.to, n.from);
    for (const n of d.query.redirects || []) back.set(n.to, back.get(n.from) || n.from);
    const pick = new Map();
    for (const p of d.query.pages || []) {
      if (p.missing) continue;
      const orig = back.get(p.title) || p.title;
      const pi = p.pageimage && CREST_RE.test(p.pageimage) ? 'Archivo:' + p.pageimage : null;
      m.set(orig, { title: p.title, qid: p.pageprops?.wikibase_item, crest: null });
      const GENERIC = /^(club|sport|deportivo|deportiva|asociación|asociacion|fútbol|futbol|municipal|unión|union|sociedad)$/i;
      const toks = p.title.split(/[\s-]+/).filter((w) => w.length > 4 && !GENERIC.test(w)).map((w) => w.toLowerCase());
      const byName = (p.images || []).map((i) => i.title).find((t) => /\.(svg|png)$/i.test(t) && !NOT_CREST.test(t) && !/^Archivo:(Flag|Bandera)/i.test(t) && toks.some((w) => t.toLowerCase().includes(w)));
      const files = (p.images || []).map((i) => i.title).filter((t) => CREST_RE.test(t) && !NOT_CREST.test(t));
      const own = files.find((t) => toks.some((w) => t.toLowerCase().includes(w))) || (files.length === 1 ? files[0] : null);
      const f = pi || own || byName;
      if (f) pick.set(f.replace(/^(File|Archivo):/, 'Archivo:'), orig);
    }
    if (!pick.size) continue;
    const ii = await mw('es.wikipedia.org', { action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(w), titles: [...pick.keys()].join('|') });
    const norms = new Map((ii.query.normalized || []).map((n) => [n.to, n.from]));
    for (const p of ii.query.pages || []) {
      const x = p.imageinfo?.[0];
      const orig = pick.get(norms.get(p.title) || p.title);
      if (!x?.thumburl || !orig) continue;
      m.get(orig).crest = { src: x.thumburl.split('?')[0], page: x.descriptionurl || pageUrl('es.wikipedia.org', p.title), from: 'wikipedia' };
    }
  }
  return m;
}
const PRIMERA = /^Primera División de Costa Rica$/i;
const nameText = (n) => (typeof n === 'string' ? n : n?.es || n?.en || '');

export async function crestsOnly(file) {
  const pc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const clubs = Object.values(pc.provinces).flatMap((p) => p.sports.clubs);
  log('escudos:', clubs.length, 'clubes');
  const ents = await wdEntities(clubs.map((c) => c.qid).filter(Boolean));
  const logoFile = (q) => { const v = claimVal(ents[q], 'P154')[0]; return typeof v === 'string' ? v : null; };
  const thumbs = await commonsThumbs(clubs.map((c) => logoFile(c.qid)).filter(Boolean));
  const titleOf = (c) => ents[c.qid]?.sitelinks?.eswiki?.title || wikiTitle(c.src?.url);
  const need = clubs.filter((c) => !thumbs.get(logoFile(c.qid)) && titleOf(c));
  const wt = await wikiThumbs(need.map(titleOf));
  const leagueIds = [...new Set(clubs.flatMap((c) => claimVal(ents[c.qid], 'P118').map((v) => v.id)))];
  const lents = leagueIds.length ? await wdEntities(leagueIds) : {};
  for (const c of clubs) {
    const lf = logoFile(c.qid);
    c.crest = (lf && thumbs.get(lf)) || wt.get(titleOf(c))?.crest || undefined;
    if (!c.leagues?.length) c.leagues = claimVal(ents[c.qid], 'P118').map((v) => lents[v.id]?.labels?.es?.value).filter(Boolean);
    c.tier = c.leagues?.some((l) => PRIMERA.test(l)) ? 1 : c.leagues?.some((l) => /Segunda División de Costa Rica/i.test(l)) ? 2 : 3;
  }
  const words = (x) => new Set(nameText(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\W+/).filter((w) => w.length > 3 && !/^(club|futbol|football|sport|deportiv[oa]|asociacion|municipal|union|sociedad)$/.test(w)));
  for (const c of clubs) {
    const t = titleOf(c)?.replace(/\s*\(.*\)$/, '');
    if (t && ![...words(c.name)].some((w) => words(t).has(w))) { log('nombre corregido:', nameText(c.name), '→', t); c.name = t; }
  }
  for (const p of Object.values(pc.provinces)) {
    const seen = new Map();
    for (const c of [...p.sports.clubs].sort((a, b) => a.tier - b.tier)) { const k = nameText(c.name).toLowerCase(); const tt = titleOf(c); if (seen.has(k) || (tt && seen.has(tt))) continue; seen.set(k, c); if (tt) seen.set(tt, c); }
    p.sports.clubs = [...new Set(seen.values())];
  }
  for (const p of Object.values(pc.provinces)) p.sports.clubs.sort((a, b) => a.tier - b.tier || nameText(a.name).localeCompare(nameText(b.name), 'es'));
  const ot = await wikiThumbs(ORG_TITLES);
  const oents = await wdEntities([...ot.values()].map((o) => o.qid).filter(Boolean));
  const ofiles = [...ot.values()].map((o) => { const v = claimVal(oents[o.qid], 'P154')[0]; return typeof v === 'string' ? v : null; });
  const othumbs = await commonsThumbs(ofiles.filter(Boolean));
  pc.national = pc.national || {};
  pc.national.orgs = ORG_TITLES.filter((t) => ot.has(t)).map((t) => {
    const o = ot.get(t);
    const lf = (() => { const v = claimVal(oents[o.qid], 'P154')[0]; return typeof v === 'string' ? v : null; })();
    return { qid: o.qid, name: oents[o.qid]?.labels?.es?.value || o.title, crest: (lf && othumbs.get(lf)) || o.crest || undefined, src: { name: 'Wikipedia', url: pageUrl('es.wikipedia.org', o.title), license: 'CC BY-SA 4.0' } };
  });
  fs.writeFileSync(file, JSON.stringify(pc));
  console.log('\nCobertura de escudos');
  const rows = Object.entries(pc.provinces).map(([id, p]) => {
    const cl = p.sports.clubs;
    return { provincia: id, clubes: cl.length, primera: cl.filter((c) => c.tier === 1).length, commons: cl.filter((c) => c.crest?.from === 'commons').length, wikipedia: cl.filter((c) => c.crest?.from === 'wikipedia').length, monograma: cl.filter((c) => !c.crest).length };
  });
  console.table(rows);
  console.log('Federaciones/asociaciones:', pc.national.orgs.map((o) => `${o.name} [${o.crest?.from || 'monograma'}]`).join(' · '));
  return rows;
}
