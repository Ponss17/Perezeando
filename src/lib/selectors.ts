import type { AppState } from '../store/useApp';
import type { Place } from '../data/types';

type F = Pick<AppState, 'active' | 'prov' | 'cat'>;

/** ¿el lugar pertenece a la categoría (principal o adicional)? */
export const inCat = (p: Place, c: string) => p.cat === c || !!p.also?.includes(c as never);

export const visiblePlaces = (s: F, places: Place[]) => {
  const on = new Set(s.active);
  const cat = s.cat;
  const prov = s.prov;
  return places.filter((p) => {
    const ok = cat === 'all' ? on.has(p.cat) || !!p.also?.some((c) => on.has(c)) : inCat(p, cat) && on.has(cat as never);
    return ok && (prov === 'all' || p.prov === prov);
  });
};

export const isMobile = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
