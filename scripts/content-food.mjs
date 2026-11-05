import { LOCAL_DISHES, mergeDishes } from './local-dishes.mjs';
import { stampFoodPhotos } from './food-photos.mjs';
import { chunks, clip, commonsMeta, fileMeta, mw, norm, pageImages, pageUrl, sectionContent, sectionsOf, stripHtml } from './wiki.mjs';

const GASTRO = 'Gastronomía de Costa Rica';
const GASTRO_SECTIONS = {
  Cartago: ['cartago'],
  'San José, Alajuela y Heredia': ['sanjose', 'alajuela', 'heredia'],
  'Guanacaste y la Zona Norte': ['guanacaste', 'alajuela'],
  Puntarenas: ['puntarenas'],
  Limón: ['limon'],
  'Quesos de Guanacaste': ['guanacaste'],
  'Quesos del Valle Central': ['sanjose', 'alajuela', 'cartago', 'heredia'],
};
const FOOD_CATS = ['Gastronomía de Costa Rica', 'Postres y dulces de Costa Rica', 'Bebidas de Costa Rica', 'Bebidas alcohólicas de Costa Rica', 'Aperitivos de Costa Rica', 'Pan de Costa Rica', 'Quesos de Costa Rica', 'Salsas de Costa Rica'];

async function sitelinksEn(qs) {
  const m = new Map();
  for (const c of chunks(qs, 50)) {
    const d = await mw('www.wikidata.org', { action: 'wbgetentities', ids: c.join('|'), props: 'sitelinks|labels', sitefilter: 'enwiki', languages: 'en' });
    for (const [id, e] of Object.entries(d.entities || {})) m.set(id, e.sitelinks?.enwiki?.title || e.labels?.en?.value);
  }
  return m;
}

export async function foodByProvince() {
  const secs = await sectionsOf('es.wikipedia.org', GASTRO);
  const out = {};
  const found = [];
  for (const s of secs) {
    const provs = GASTRO_SECTIONS[s.line];
    if (!provs) continue;
    const c = await sectionContent('es.wikipedia.org', GASTRO, s.index);
    found.push({ s, provs, c });
  }
  const cm = async (c) => (await mw('es.wikipedia.org', { action: 'query', list: 'categorymembers', cmtitle: c, cmlimit: '500', cmnamespace: '0' })).query.categorymembers.map((m) => m.title);
  const NOT_DISH = /^(Gastronomía|Dieta|Chorreador|Big Cola|Cerveza de Costa Rica)/;
  const national = new Set();
  for (const c of FOOD_CATS) (await cm('Categoría:' + c)).filter((t) => !NOT_DISH.test(t)).forEach((t) => national.add(t));
  const limon = (await cm('Categoría:Gastronomía de Limón')).filter((t) => !NOT_DISH.test(t));
  limon.forEach((t) => national.add(t));
  const pi = await pageImages('es', [...national]);
  await commonsMeta([...pi.values()].map((v) => v.file));
  const enT = await sitelinksEn([...new Set([...pi.values()].map((v) => v.qid).filter(Boolean))]);
  const item = (t, scope) => {
    const v = pi.get(t) || { title: t };
    return { qid: v.qid, name: { es: v.title, en: (v.qid && enT.get(v.qid)) || v.title }, scope, img: v.file ? fileMeta.get(v.file) || undefined : undefined, src: { name: 'Wikipedia', url: pageUrl('es.wikipedia.org', v.title), license: 'CC BY-SA 4.0' } };
  };
  const base = (t) => norm(t.replace(/\s*\(.*\)$/, ''));
  for (const { s, provs, c } of found) {
    const txt = norm(c.text);
    for (const p of provs) {
      const o = (out[p] ??= { intro: [], items: [] });
      o.intro.push({ section: stripHtml(s.line), text: clip(c.text), src: { name: 'Wikipedia', url: pageUrl('es.wikipedia.org', GASTRO) + '#' + encodeURIComponent(s.anchor), license: 'CC BY-SA 4.0' } });
      for (const t of national) if (base(t).length > 3 && new RegExp('\\b' + base(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(txt) && !o.items.some((x) => x.src.url === item(t).src.url)) o.items.push(item(t, 'regional'));
    }
  }
  out.limon ??= { intro: [], items: [] };
  for (const t of limon) if (!out.limon.items.some((x) => x.src.url === item(t).src.url)) out.limon.items.push(item(t, 'regional'));
  try {
    const d = await mw('es.wikipedia.org', { action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', titles: 'Gastronomía de la provincia de Limón', redirects: '1' });
    const ex = d.query.pages?.[0]?.extract;
    if (ex) out.limon.intro.unshift({ section: 'Gastronomía de la provincia de Limón', text: clip(ex.replace(/\s+/g, ' ')), src: { name: 'Wikipedia', url: pageUrl('es.wikipedia.org', 'Gastronomía de la provincia de Limón'), license: 'CC BY-SA 4.0' } });
  } catch {}
  out._national = [...national].map((t) => item(t, 'national'));
  for (const [id, items] of Object.entries(LOCAL_DISHES)) {
    const o = (out[id] ??= { intro: [], items: [] });
    o.items = mergeDishes(o.items, items, out._national);
  }
  stampFoodPhotos(out);
  return out;
}
