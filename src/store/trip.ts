import { getApp, setApp } from './useApp';
import { getData } from '../data/load';
import { boundsOf } from '../lib/geo';
import { withMap } from '../lib/mapBus';
import { download } from '../lib/download';
import { buildGpx, optimizeOrder } from '../features/route/routing';
import { L, t, toast } from './labels';
import { setTab } from './selection';

export function toggleFav(id: string) {
  const p = getData()?.byId.get(id);
  if (!p) return;
  const s = getApp();
  const has = s.favs.includes(id);
  setApp({ favs: has ? s.favs.filter((x) => x !== id) : [...s.favs, id] });
  toast(!has ? '★ ' + L(p.name) : L(p.name) + ' ✕');
}

export function setRoute(ids: string[]) {
  const d = getData();
  const route = ids.filter((id, i) => (!d || d.byId.has(id)) && ids.indexOf(id) === i);
  const keep = new Set(route.slice(1));
  setApp({ route, dayStarts: getApp().dayStarts.filter((id) => keep.has(id)) });
}

export function toggleDayStart(id: string) {
  const s = getApp();
  if (s.route[0] === id || !s.route.includes(id)) return;
  setApp({
    dayStarts: s.dayStarts.includes(id) ? s.dayStarts.filter((x) => x !== id) : [...s.dayStarts, id],
  });
}

export function sleepInTown(townId: string, afterId: string) {
  const r = getApp().route.slice();
  const i = r.indexOf(afterId);
  if (i < 0 || r.includes(townId)) return;
  const next = r[i + 1];
  r.splice(i + 1, 0, townId);
  setRoute(r);
  if (next) setApp({ dayStarts: [...new Set([...getApp().dayStarts, next])] });
}

export function toggleRoute(id: string) {
  const p = getData()?.byId.get(id);
  if (!p) return;
  const s = getApp();
  const had = s.route.includes(id);
  setRoute(had ? s.route.filter((x) => x !== id) : [...s.route, id]);
  const n = getApp().route.length;
  toast(had ? `${L(p.name)} ✕ ${t('tab_route')}` : `${L(p.name)} → ${t('tab_route')} (${n})`);
}

export function moveStop(i: number, dir: -1 | 1) {
  const r = getApp().route.slice();
  const j = i + dir;
  if (j < 0 || j >= r.length) return;
  [r[i], r[j]] = [r[j], r[i]];
  setRoute(r);
}

export function optimizeRoute() {
  const d = getData();
  if (!d) return;
  const pts = getApp()
    .route.map((id) => d.byId.get(id)!)
    .filter(Boolean);
  if (pts.length < 3) return;
  setRoute(optimizeOrder(pts).map((p) => p.id));
}

export function fitRoute() {
  const d = getData();
  const s = getApp();
  if (!d) return;
  const pts: number[][] =
    s.routeData?.line ??
    s.route
      .map((id) => d.byId.get(id))
      .filter(Boolean)
      .map((p) => [p!.lng, p!.lat]);
  if (pts.length < 2) return;
  const b = boundsOf(pts);
  if (b) withMap((m) => m.fitBounds(b, { maxZoom: 12 }));
}

export function routeWithFavs() {
  const d = getData();
  if (!d) return;
  setRoute(getApp().favs.filter((id) => d.byId.get(id) && d.byId.get(id)!.prov !== 'mar'));
  setTab('route');
  setTimeout(fitRoute, 60);
}

export function exportGpx() {
  const d = getData();
  const s = getApp();
  if (!d || !s.route.length) return;
  const stops = s.route.map((id) => d.byId.get(id)!).filter(Boolean);
  const data = s.routeData && s.routeData.key === s.route.join(',') ? s.routeData : null;
  download('ruta-costa-rica.gpx', buildGpx(s.lang, stops, data), 'application/gpx+xml');
}
