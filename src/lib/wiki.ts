import type { Lang, Place, ProvinceProps } from '../data/types';

export interface WikiTarget {
  lang: Lang;
  title: string;
}
export interface WikiSummary {
  extract?: string;
  thumbnail?: { source: string };
}

export function wikiTarget(lang: Lang, wiki?: Place['wiki'] | ProvinceProps['wiki']): WikiTarget | null {
  if (!wiki) return null;
  // En español nunca caemos a en.wikipedia: evita extractos en inglés en la ficha.
  if (lang === 'es') return wiki.es ? { lang: 'es', title: wiki.es } : null;
  if (lang === 'en' && wiki.en) return { lang: 'en', title: wiki.en };
  if (wiki.es) return { lang: 'es', title: wiki.es };
  if (wiki.en) return { lang: 'en', title: wiki.en };
  return null;
}

export const wikiUrl = (w: WikiTarget) =>
  `https://${w.lang}.wikipedia.org/wiki/${encodeURIComponent(w.title.replace(/ /g, '_'))}`;

const cache = new Map<string, Promise<WikiSummary>>();
const wikiMem = new Map<string, WikiSummary>();
try {
  const raw = sessionStorage.getItem('pz.wiki');
  if (raw)
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, WikiSummary>)) wikiMem.set(k, v);
} catch {
  /* private mode */
}
function persistWiki() {
  try {
    const o: Record<string, WikiSummary> = {};
    let i = 0;
    for (const [k, v] of wikiMem) {
      if (i++ > 80) break;
      o[k] = v;
    }
    sessionStorage.setItem('pz.wiki', JSON.stringify(o));
  } catch {
    /* quota */
  }
}

/** Resumen de Wikipedia (REST), con caché y timeout de 8 s */
export function fetchWikiSummary(w: WikiTarget): Promise<WikiSummary> {
  const key = w.lang + ':' + w.title;
  const hit = wikiMem.get(key);
  if (hit) return Promise.resolve(hit);
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 8000);
      try {
        const r = await fetch(
          `https://${w.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(w.title.replace(/ /g, '_'))}`,
          { signal: ctl.signal },
        );
        if (!r.ok) throw new Error(String(r.status));
        const data = (await r.json()) as WikiSummary;
        wikiMem.set(key, data);
        persistWiki();
        return data;
      } finally {
        clearTimeout(to);
      }
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export const usableWikiThumb = (src?: string) => !!src && !/map|mapa|flag|svg/i.test(src);
