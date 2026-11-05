import type { AppState } from '../store/useApp';
import type { Place } from '../data/types';
import { MOBILE_QUERY } from '../data/config';

type F = Pick<AppState, 'active' | 'prov' | 'cat'>;

/** ¿el lugar pertenece a la categoría (principal o adicional)? */
export const inCat = (p: Place, c: string) => p.cat === c || !!p.also?.includes(c as never);

export const visiblePlaces = (s: F, places: Place[]) => {
  const on = new Set(s.active);
  const cat = s.cat;
  const prov = s.prov;
  return places.filter((p) => {
    const ok =
      cat === 'all'
        ? on.has(p.cat) || !!p.also?.some((c) => on.has(c))
        : inCat(p, cat) && on.has(cat as never);
    return ok && (prov === 'all' || p.prov === prov);
  });
};

let mobileMql: MediaQueryList | null = null;

export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  mobileMql ??= window.matchMedia(MOBILE_QUERY);
  return mobileMql.matches;
};
