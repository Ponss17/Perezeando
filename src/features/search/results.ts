import { create } from 'zustand';
import type { AppState } from '../../store/useApp';
import type { AtlasData } from '../../data/load';
import type { Place } from '../../data/types';
import { CATEGORY_ORDER } from '../../data/config';
import { INTENTION_IDS } from '../../data/discover';
import { inCat, visiblePlaces } from '../../lib/selectors';
import { haversine, ll } from '../../lib/geo';
import { pick } from '../../i18n';
import { searchPlaces } from './searchIndex';

export interface Results {
  list: Place[];
  dists: Map<string, number> | null;
  grouped: boolean;
  q: string;
}

type S = Pick<
  AppState,
  'query' | 'prov' | 'cat' | 'active' | 'near' | 'nearPlace' | 'me' | 'lang' | 'intention'
>;

const ORDER = new Map<string, number>(CATEGORY_ORDER.map((c, i) => [c, i]));
// un Intl.Collator reutilizado es mucho más barato que localeCompare(…, lang) en cada comparación
const collators = new Map<string, Intl.Collator>();
const collator = (lang: string) => {
  let c = collators.get(lang);
  if (!c) collators.set(lang, (c = new Intl.Collator(lang)));
  return c;
};

/** Lista de resultados de la pestaña Explorar (búsqueda, cercanía o agrupada por categoría) */
export function computeResults(s: S, d: AtlasData): Results {
  const q = s.query.trim();
  let list =
    q.length >= 2
      ? searchPlaces(d, q).filter(
          (p) => (s.prov === 'all' || p.prov === s.prov) && (s.cat === 'all' || inCat(p, s.cat)),
        )
      : visiblePlaces(s, d.places);
  if (s.intention) {
    const allow = new Set(INTENTION_IDS[s.intention]);
    list = list.filter((p) => allow.has(p.id) || (p.tags?.includes(s.intention!) ?? false));
  }
  let dists: Map<string, number> | null = null;
  const nearOrigin = s.nearPlace ? d.byId.get(s.nearPlace) : null;
  const origin = nearOrigin ? ll(nearOrigin) : s.near && s.me ? s.me : null;
  const grouped = !origin && q.length < 2 && !s.intention;
  if (origin) {
    const from = origin;
    list = nearOrigin ? list.filter((p) => p.id !== nearOrigin.id) : list;
    dists = new Map(list.map((p) => [p.id, haversine(from, ll(p))]));
    const dd = dists;
    list = list.slice().sort((a, b) => dd.get(a.id)! - dd.get(b.id)!);
  } else if (grouped) {
    const col = collator(s.lang);
    const pinCities = s.prov !== 'all' && s.prov !== 'mar';
    const rank = (p: Place) => (pinCities && p.cat === 'ciudades' ? -1 : ORDER.get(p.cat)!);
    list = list
      .slice()
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          Number(!!b.facts?.capital) - Number(!!a.facts?.capital) ||
          col.compare(pick(s.lang, a.name), pick(s.lang, b.name)),
      );
  }
  return { list, dists, grouped, q };
}

/** Índice de navegación por teclado en la lista de resultados */
export const useKb = create<{ i: number }>(() => ({ i: -1 }));
