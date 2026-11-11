import { getApp, setApp, type GeoIssue } from './useApp';
import { getData } from '../data/load';
import type { BasemapId, Overlays } from '../data/types';
import { CR_BOUNDS } from '../data/config';
import { getMap, withMap } from '../lib/mapBus';
import { isMobile } from '../lib/selectors';
import { shareUrl } from '../hooks/hash';
import { L, t, toast } from './labels';
import { setSheet } from './selection';

export const setBase = (base: BasemapId) => setApp({ base, basemapPop: false });
export const toggleOv = (k: keyof Overlays) => setApp((s) => ({ ov: { ...s.ov, [k]: !s.ov[k] } }));

function hasWebGL() {
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
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (st?.state === 'denied') return geoNotice('denied');
  } catch {
    /* ignore */
  }
  setApp({ locating: true });
  let pos: GeolocationPosition;
  try {
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
  if (inside) withMap((m) => m.flyTo(me[0], me[1], 9));
  if (!inside) geoNotice('outside');
  if (listNear) {
    setApp({
      near: true,
      nearPlace: null,
      query: '',
      tab: 'explore',
      detailOpen: false,
      panelOpen: true,
    });
    if (isMobile()) setSheet('half');
  }
}

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
  const was3d = getApp().is3d;
  if (was3d) setApp({ is3d: false });
  toast(t('print_preparing'));
  if (was3d) await new Promise((r) => setTimeout(r, 420));
  const img = await getMap()?.snapshot();
  const el = document.getElementById('printImg') as HTMLImageElement | null;
  if (el && img) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      el.onload = done;
      el.onerror = done;
      el.src = img;
      if (el.complete) done();
    });
  }
  setApp({ toast: null });
  window.setTimeout(() => window.print(), 60);
}

export function toggleNight() {
  setApp((s) => ({ night: !s.night }));
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
