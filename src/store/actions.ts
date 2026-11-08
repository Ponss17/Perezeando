import { getApp, setApp, type GeoIssue } from './useApp';
import { getData } from '../data/load';
import type {
  BasemapId,
  CategoryId,
  Overlays,
  Place,
  ProvinceFilter,
  ProvinceId,
  SheetState,
  Tab,
} from '../data/types';
import { CATEGORIES, CATEGORY_ORDER, CR_BOUNDS, GROUPS } from '../data/config';
import { pick, translate } from '../i18n';
import { boundsOf, haversine, ll, positions } from '../lib/geo';
import { getMap, withMap } from '../lib/mapBus';
import { inCat, isMobile, visiblePlaces } from '../lib/selectors';
import { download } from '../lib/download';
import { wikiTarget, wikiUrl } from '../lib/wiki';
import { buildGpx, optimizeOrder } from '../features/route/routing';
import { shareUrl } from '../hooks/hash';

const t = (k: Parameters<typeof translate>[1]) => translate(getApp().lang, k);
const L = (o: Parameters<typeof pick>[1]) => pick(getApp().lang, o);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  clearTimeout(toastTimer);
  setApp({ toast: { msg, n: Date.now() } });
  toastTimer = setTimeout(() => setApp({ toast: null }), 2600);
}

export const catName = (c: CategoryId) => L(CATEGORIES[c].name);
export const catOne = (c: CategoryId) => L(CATEGORIES[c].one);
export function provName(id: string) {
  if (id === 'mar') return t('marine');
  return getData()?.provById.get(id as ProvinceId)?.name ?? '';
}

export const setSheet = (sheet: SheetState) => setApp({ sheet });

let prevTab: Tab = 'explore';
export function setTab(tab: Tab) {
  prevTab = tab;
  setApp({ tab, detailOpen: false, panelOpen: true });
}

export function openTab(tab: Tab) {
  setTab(tab);
  if (tab === 'route') fitRoute();
  if (isMobile() && getApp().sheet === 'peek') setSheet('half');
}

export function select(id: string, opts: { noFly?: boolean; fromMap?: boolean } = {}) {
  const d = getData();
  const p = d?.byId.get(id);
  if (!p) return;
  const s = getApp();
  if (s.tab !== prevTab) prevTab = s.tab;
  setApp({ sel: { kind: 'place', id }, detailOpen: true, panelOpen: true });
  if (isMobile()) setSheet('half');
  // primero se pinta la ficha y luego arranca el vuelo del mapa (que ocupa cada cuadro)
  // en móvil se espera a que la hoja termine de subir (su relleno detendría el vuelo)
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

export function fitProvince(id: ProvinceFilter) {
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
  // si la categoría actual no tiene lugares en la nueva provincia, volver a «todas»
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
  setApp({ near: false, cat: 'all' });
  setProv('all', true);
}

export const setBase = (base: BasemapId) => setApp({ base, basemapPop: false });
export const toggleOv = (k: keyof Overlays) => setApp((s) => ({ ov: { ...s.ov, [k]: !s.ov[k] } }));

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function toggle3d(on?: boolean) {
  const s = getApp();
  const next = on ?? !s.is3d;
  if (next && !hasWebGL()) {
    toast(t('no3d'));
    setApp((x) => ({ ov: { ...x.ov, hill: true }, base: 'topo' }));
    return;
  }
  setApp({ is3d: next });
}

let animT = 0;
export function togglePanel(open?: boolean) {
  const app = document.getElementById('app');
  app?.classList.add('panel-anim');
  clearTimeout(animT);
  animT = window.setTimeout(() => app?.classList.remove('panel-anim'), 420);
  setApp((s) => ({ panelOpen: open ?? !s.panelOpen }));
}

/* ---------------- Favoritos ---------------- */
export function toggleFav(id: string) {
  const p = getData()?.byId.get(id);
  if (!p) return;
  const s = getApp();
  const has = s.favs.includes(id);
  setApp({ favs: has ? s.favs.filter((x) => x !== id) : [...s.favs, id] });
  toast(!has ? '★ ' + L(p.name) : L(p.name) + ' ✕');
}

/* ---------------- Ruta ---------------- */
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

/** Mete un pueblo para dormir al cierre del día y arranca el día siguiente en la parada que venía después. */
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

export function exportGeojson() {
  const d = getData();
  const s = getApp();
  if (!d) return;
  const fc = {
    type: 'FeatureCollection',
    features: visiblePlaces(s, d.places).map((p) => {
      const w = wikiTarget(s.lang, p.wiki);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          name: L(p.name),
          category: catName(p.cat),
          province: provName(p.prov),
          description: L(p.desc),
          wikipedia: w ? wikiUrl(w) : null,
          favorite: s.favs.includes(p.id),
        },
      };
    }),
  };
  download('costa-rica-lugares.geojson', JSON.stringify(fc, null, 1), 'application/geo+json');
  toast(`${fc.features.length} ${t('count_places')} → GeoJSON`);
}

/* ---------------- Geolocalización ---------------- */
let lastListNear = false;
export const dismissNotice = () => setApp({ notice: null });
const geoNotice = (code: GeoIssue) =>
  setApp({ locating: false, notice: { kind: 'geo', code, n: Date.now() } });

const getPos = (high: boolean, timeout: number) =>
  new Promise<GeolocationPosition>((res, rej) =>
    navigator.geolocation.getCurrentPosition(res, rej, {
      enableHighAccuracy: high,
      timeout,
      maximumAge: 60000,
    }),
  );

export const retryLocate = () => locate(lastListNear);

export async function locate(listNear: boolean) {
  lastListNear = listNear;
  setApp({ notice: null });
  if (!window.isSecureContext) return geoNotice('insecure');
  if (!('geolocation' in navigator)) return geoNotice('unsupported');
  // si el permiso ya está bloqueado, lo decimos sin esperar
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (st?.state === 'denied') return geoNotice('denied');
  } catch {
    /* algunos navegadores no soportan la consulta */
  }
  setApp({ locating: true });
  let pos: GeolocationPosition;
  try {
    // primero precisión normal (Wi‑Fi/IP: rápido en PC); si falla, un intento con alta precisión
    pos = await getPos(false, 10000);
  } catch (e1) {
    const err1 = e1 as GeolocationPositionError;
    if (err1.code === 1) return geoNotice('denied');
    try {
      pos = await getPos(true, 12000);
    } catch (e2) {
      const code = (e2 as GeolocationPositionError).code;
      return geoNotice(code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable');
    }
  }
  const me: [number, number] = [pos.coords.latitude, pos.coords.longitude];
  setApp({ locating: false, me, meAcc: Math.min(pos.coords.accuracy || 100, 3000) });
  const [[w, sth], [e, n]] = CR_BOUNDS;
  const inside = me[1] >= w && me[1] <= e && me[0] >= sth && me[0] <= n;
  // fuera de CR: no volar (el mapa está limitado); se muestra aviso
  if (inside) withMap((m) => m.flyTo(me[0], me[1], 9));
  if (!inside) geoNotice('outside');
  if (listNear) {
    setApp({ near: true, query: '', tab: 'explore', detailOpen: false, panelOpen: true });
    if (isMobile()) setSheet('half');
  }
}

/* ---------------- Compartir / imprimir ---------------- */
export async function share(id?: string | null) {
  const sel = getApp().sel;
  const pid = id ?? (sel?.kind === 'place' ? sel.id : null);
  const url = shareUrl(pid);
  const p = pid ? getData()?.byId.get(pid) : null;
  const title = p ? L(p.name) + ' · ' + t('title') : t('title');
  if (navigator.share && isMobile()) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t('link_copied'));
  } catch {
    window.prompt(t('copy_link'), url);
  }
}

export async function doPrint() {
  if (getApp().is3d) setApp({ is3d: false });
  const img = await getMap()?.snapshot();
  const el = document.getElementById('printImg') as HTMLImageElement | null;
  if (el && img) el.src = img;
  setTimeout(() => window.print(), 80);
}

export function toggleNight() {
  setApp((s) => ({ night: !s.night }));
}

export function surprise() {
  const d = getData();
  if (!d) return;
  const list = visiblePlaces(getApp(), d.places);
  if (!list.length) return;
  select(list[Math.floor(Math.random() * list.length)].id);
}

export function toggleMeasure() {
  setApp((s) => ({ measure: !s.measure, measurePts: [] }));
}

export function addMeasurePoint(lng: number, lat: number) {
  setApp((s) => {
    const pt: [number, number] = [lng, lat];
    return { measurePts: s.measurePts.length >= 2 ? [pt] : [...s.measurePts, pt] };
  });
}

export const nearbyOf = (id: string, n = 5) => {
  const d = getData();
  const p = d?.byId.get(id);
  if (!d || !p) return [];
  const here = ll(p);
  const best: { q: Place; km: number }[] = [];
  for (const q of d.places) {
    if (q.id === id) continue;
    const km = haversine(here, ll(q));
    if (best.length < n) {
      best.push({ q, km });
      if (best.length === n) best.sort((a, b) => a.km - b.km);
    } else if (km < best[n - 1].km) {
      best[n - 1] = { q, km };
      best.sort((a, b) => a.km - b.km);
    }
  }
  return best.map((b) => [b.q, b.km] as const);
};

// ganchos para pruebas automáticas (?e2e)
if (typeof location !== 'undefined' && location.search.includes('e2e'))
  (window as unknown as { __cract: unknown }).__cract = {
    showProvince,
    select,
    setCat,
    setProv,
    deselect,
    setBase,
  };
