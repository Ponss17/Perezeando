import { create } from 'zustand';
import type { AppState } from '../../store/useApp';
import type { AtlasData } from '../../data/load';
import type { Place } from '../../data/types';
import { CATEGORY_ORDER } from '../../data/config';
import { inCat, visiblePlaces } from '../../lib/selectors';
import { haversine, ll } from '../../lib/geo';
import { pick } from '../../i18n';
import { limitNearby } from '../../lib/nearby';
import { searchPlaces } from './searchIndex';

interface Results {
  list: Place[];
  dists: Map<string, number> | null;
  grouped: boolean;
  q: string;
}

type S = Pick<AppState, 'query' | 'prov' | 'cat' | 'active' | 'near' | 'me' | 'lang'>;

const ORDER = new Map<string, number>(CATEGORY_ORDER.map((c, i) => [c, i]));
const collators = new Map<string, Intl.Collator>();
const collator = (lang: string) => {
  let c = collators.get(lang);
  if (!c) collators.set(lang, (c = new Intl.Collator(lang)));
  return c;
};

export function computeResults(s: S, d: AtlasData): Results {
  const q = s.query.trim();
  let list =
    q.length >= 2
      ? searchPlaces(d, q).filter(
          (p) => (s.prov === 'all' || p.prov === s.prov) && (s.cat === 'all' || inCat(p, s.cat)),
        )
      : visiblePlaces(s, d.places);
  let dists: Map<string, number> | null = null;
  const origin = s.near && s.me ? s.me : null;
  const grouped = !origin && q.length < 2;
  if (origin) {
    dists = new Map(list.map((p) => [p.id, haversine(origin, ll(p))]));
    list = limitNearby(list, dists);
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

export const useKb = create<{ i: number }>(() => ({ i: -1 }));
