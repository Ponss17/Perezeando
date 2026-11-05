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
  if (lang === 'en' && wiki.en) return { lang: 'en', title: wiki.en };
  if (wiki.es) return { lang: 'es', title: wiki.es };
  if (wiki.en) return { lang: 'en', title: wiki.en };
  return null;
}

export const wikiUrl = (w: WikiTarget) =>
  `https://${w.lang}.wikipedia.org/wiki/${encodeURIComponent(w.title.replace(/ /g, '_'))}`;

const cache = new Map<string, Promise<WikiSummary>>();

/** Resumen de Wikipedia (REST), con caché y timeout de 8 s */
export function fetchWikiSummary(w: WikiTarget): Promise<WikiSummary> {
  const key = w.lang + ':' + w.title;
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
        return (await r.json()) as WikiSummary;
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
