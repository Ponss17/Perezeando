import { getApp, setApp } from './useApp';
import { getData } from '../data/load';
import type { CategoryId, ProvinceFilter, ProvinceId, SheetState, Tab } from '../data/types';
import { CATEGORY_ORDER, CR_BOUNDS, GROUPS } from '../data/config';
import { boundsOf, haversine, ll, positions } from '../lib/geo';
import { withMap } from '../lib/mapBus';
import { inCat, isMobile, visiblePlaces } from '../lib/selectors';
import type { Place } from '../data/types';

export const setSheet = (sheet: SheetState) => setApp({ sheet });

let prevTab: Tab = 'explore';
export function setTab(tab: Tab) {
  prevTab = tab;
  setApp({ tab, detailOpen: false, panelOpen: true });
}

export function select(id: string, opts: { noFly?: boolean; fromMap?: boolean } = {}) {
  const d = getData();
  const p = d?.byId.get(id);
  if (!p) return;
  const s = getApp();
  if (s.tab !== prevTab) prevTab = s.tab;
  setApp({ sel: { kind: 'place', id }, detailOpen: true, panelOpen: true });
  if (isMobile()) setSheet('half');
  if (!opts.noFly)
    requestAnimationFrame(() =>
      setTimeout(() => withMap((m) => m.focusPlace(p, { fromMap: opts.fromMap })), isMobile() ? 380 : 0),
    );
}

export function showProvince(id: ProvinceId) {
  if (!getData()?.provById.has(id)) return;
  setApp({ sel: { kind: 'province', id }, detailOpen: true, panelOpen: true });
  if (isMobile()) setSheet('half');
}

export function deselect() {
  setApp({ sel: null, detailOpen: false, tab: prevTab });
}

export function closeDetail(kind: 'close' | 'back') {
  if (isMobile()) setSheet(kind === 'back' ? 'half' : 'peek');
  deselect();
}

function fitProvince(id: ProvinceFilter) {
  const d = getData();
  if (!d) return;
  if (id === 'all') return withMap((m) => m.fitBounds(CR_BOUNDS));
  if (id === 'mar') {
    const f = d.eez.features.find((x) => x.properties.id === 'pacificEEZ');
    const b = f && boundsOf(positions(f.geometry));
    if (b) withMap((m) => m.fitBounds(b));
    return;
  }
  const f = d.provinces.features.find((x) => x.properties.id === id);
  const b = f && boundsOf(positions(f.geometry));
  if (b) withMap((m) => m.fitBounds(b));
}

export function setProv(id: ProvinceFilter, fit = false) {
  const s = getApp();
  const places = getData()?.places;
  let cat = s.cat;
  if (cat !== 'all' && places && !places.some((p) => (id === 'all' || p.prov === id) && inCat(p, cat))) {
    cat = 'all';
  }
  setApp({ prov: id, cat });
  if (fit) fitProvince(id);
}

export function setCat(cat: CategoryId | 'all') {
  const s = getApp();
  const active = cat !== 'all' && !s.active.includes(cat) ? [...s.active, cat] : s.active;
  setApp({ cat, active });
}

export function toggleCat(c: CategoryId) {
  const s = getApp();
  const active = s.active.includes(c) ? s.active.filter((x) => x !== c) : [...s.active, c];
  setApp({ active, cat: s.cat !== 'all' && !active.includes(s.cat) ? 'all' : s.cat });
}

export function toggleGroup(gid: string) {
  const g = GROUPS.find((x) => x.id === gid);
  if (!g) return;
  const s = getApp();
  const all = g.cats.every((c) => s.active.includes(c));
  const set = new Set(s.active);
  g.cats.forEach((c) => (all ? set.delete(c) : set.add(c)));
  const active = CATEGORY_ORDER.filter((c) => set.has(c));
  setApp({ active, cat: s.cat !== 'all' && !set.has(s.cat) ? 'all' : s.cat });
}

export const layersAll = () => setApp({ active: [...CATEGORY_ORDER] });
export const layersNone = () => setApp({ active: [], cat: 'all' });

export function clearFilters() {
  setApp({ near: false, nearPlace: null, cat: 'all', query: '' });
  setProv('all', true);
}

export function surprise() {
  const d = getData();
  if (!d) return;
  const list = visiblePlaces(getApp(), d.places);
  if (!list.length) return;
  select(list[Math.floor(Math.random() * list.length)].id);
}

export const nearbyOf = (id: string, n = 6, opts: { diversify?: boolean } = {}) => {
  const d = getData();
  const p = d?.byId.get(id);
  if (!d || !p) return [];
  const here = ll(p);
  const pool: { q: Place; km: number }[] = [];
  const want = Math.max(n * 8, 40);
  for (const q of d.places) {
    if (q.id === id) continue;
    const km = haversine(here, ll(q));
    if (pool.length < want) {
      pool.push({ q, km });
      if (pool.length === want) pool.sort((a, b) => a.km - b.km);
    } else if (km < pool[want - 1].km) {
      pool[want - 1] = { q, km };
      pool.sort((a, b) => a.km - b.km);
    }
  }
  pool.sort((a, b) => a.km - b.km);
  if (!opts.diversify) return pool.slice(0, n).map((b) => [b.q, b.km] as const);
  const picked: { q: Place; km: number }[] = [];
  const seen = new Set<string>();
  for (const c of pool) {
    if (picked.length >= n) break;
    if (seen.has(c.q.cat)) continue;
    picked.push(c);
    seen.add(c.q.cat);
  }
  for (const c of pool) {
    if (picked.length >= n) break;
    if (picked.some((x) => x.q.id === c.q.id)) continue;
    picked.push(c);
  }
  return picked.map((b) => [b.q, b.km] as const);
};

export function openNearbyExplore(fromId: string) {
  if (!getData()?.byId.has(fromId)) return;
  setApp({
    nearPlace: fromId,
    near: true,
    query: '',
    tab: 'explore',
    detailOpen: false,
    panelOpen: true,
    cat: 'all',
    prov: 'all',
  });
  if (isMobile()) setSheet('half');
}
