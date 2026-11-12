import { norm, sleep } from './shared.mjs';
const UA = 'PerezeandoContentBot/1.0 (https://perezeando.com; mapa de Costa Rica; build-time fetch)';
export { norm };
export const log = (...a) => console.log('·', ...a);

export async function get(url, opt = {}, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...opt, headers: { 'User-Agent': UA, 'Api-User-Agent': UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(90000) });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.slice(0, 120));
      return await r.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000 * (i + 1));
    }
  }
}

let lastSparql = 0;
export async function sparql(q) {
  const wait = 1200 - (Date.now() - lastSparql);
  if (wait > 0) await sleep(wait);
  lastSparql = Date.now();
  const d = await get('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'query=' + encodeURIComponent(q),
  });
  return d.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

export const mw = async (host, params) => {
  await sleep(150);
  return get(`https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params }));
};

export const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
export const qid = (u) => u?.split('/').pop();
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&(\w+);/g, (m, n) => ENT[n] ?? m);
export const stripHtml = (s) => (s ? decode(s.replace(/<[^>]*>/g, '')).replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim() : undefined);
export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
export const pageUrl = (host, t) => `https://${host}/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;
export const wikiTitle = (u) => (u ? decodeURIComponent(u.split('/wiki/').pop()).replace(/_/g, ' ') : undefined);
export const fileFromP18 = (u) => (u ? decodeURIComponent(u.split('/Special:FilePath/').pop()).replace(/_/g, ' ') : null);
export const clip = (s, n = 420) => (s && s.length > n ? s.slice(0, s.lastIndexOf(' ', n)) + '…' : s);

export const fileMeta = new Map();
export async function commonsMeta(files) {
  const todo = [...new Set(files.filter((f) => f && !fileMeta.has(f)))];
  for (const c of chunks(todo, 40)) {
    const d = await mw('commons.wikimedia.org', {
      action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '960',
      iiextmetadatafilter: 'Artist|LicenseShortName', titles: c.map((f) => 'File:' + f).join('|'),
    });
    const norms = new Map((d.query.normalized || []).map((n) => [n.to, n.from]));
    for (const p of d.query.pages || []) {
      const ii = p.imageinfo?.[0];
      const orig = (norms.get(p.title) || p.title).replace(/^File:/, '');
      if (!ii || !/jpeg|png|webp/.test(ii.mime || '')) { fileMeta.set(orig, null); continue; }
      fileMeta.set(orig, {
        src: ii.thumburl || ii.url,
        page: ii.descriptionurl,
        artist: stripHtml(ii.extmetadata?.Artist?.value)?.slice(0, 80),
        license: stripHtml(ii.extmetadata?.LicenseShortName?.value),
      });
    }
  }
}

export async function pageImages(lang, titles) {
  const out = new Map();
  for (const c of chunks([...new Set(titles)], 45)) {
    const d = await mw(`${lang}.wikipedia.org`, { action: 'query', prop: 'pageimages|pageprops', piprop: 'name', ppprop: 'wikibase_item', redirects: '1', titles: c.join('|') });
    const back = new Map();
    for (const n of d.query.normalized || []) back.set(n.to, n.from);
    for (const n of d.query.redirects || []) back.set(n.to, back.get(n.from) || n.from);
    for (const p of d.query.pages || []) {
      const orig = back.get(p.title) || p.title;
      out.set(orig, { file: p.pageimage?.replace(/_/g, ' '), qid: p.pageprops?.wikibase_item, title: p.title });
    }
  }
  return out;
}

export async function sectionsOf(host, page) {
  const d = await mw(host, { action: 'parse', page, prop: 'sections', redirects: '1' });
  return d.parse?.sections || [];
}

export async function sectionContent(host, page, index) {
  const d = await mw(host, { action: 'parse', page, section: String(index), prop: 'text|links', redirects: '1', disablelimitreport: '1', disableeditsection: '1' });
  const html = d.parse?.text || '';
  const body = html.replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, '').replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<table[\s\S]*?<\/table>/g, '').replace(/<figure[\s\S]*?<\/figure>/g, '');
  const paras = [...body.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => stripHtml(m[2]).replace(/\[\d+\]/g, '')).filter((s) => s && s.length > 25);
  const links = [...body.matchAll(/<a [^>]*href="\/wiki\/([^"#:]+)"[^>]*>/g)].map((m) => decodeURIComponent(m[1]).replace(/_/g, ' '));
  return { text: paras.join(' '), links: [...new Set(links)] };
}
