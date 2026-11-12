import type { LngLat, Map as MLMap } from 'maplibre-gl';
import { MAX_BOUNDS } from '../../data/config';
import type { Lang } from '../../data/types';
import { translate } from '../../i18n';
import { isMobile } from '../../lib/selectors';

export function attachLimitHint(map: MLMap, container: HTMLElement, lang: () => Lang) {
  const el = document.createElement('div');
  el.className = 'limit-hint';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg><span><b></b><small></small></span>`;
  container.appendChild(el);

  let hide = 0;
  let last = 0;
  let check = 0;

  const placeLimit = () => {
    el.style.top = '';
    el.style.bottom = '';
    el.classList.remove('low');
    const busy = [
      ...document.querySelectorAll<HTMLElement>('#map .maplibregl-popup, .sel-mk:not(.menu-hide) .sel-label'),
    ].map((e) => e.getBoundingClientRect());
    if (!busy.length) return;
    const r = el.getBoundingClientRect();
    const hit = (a: DOMRect, y0: number, y1: number) =>
      a.left < r.right && a.right > r.left && a.top < y1 && a.bottom > y0;
    if (!busy.some((b) => hit(b, r.top - 4, r.bottom + 4))) return;
    const m = map.getContainer().getBoundingClientRect();
    let bottom = m.bottom;
    const sheet = isMobile() ? document.querySelector('.panel')?.getBoundingClientRect() : null;
    if (sheet && sheet.top < bottom) bottom = sheet.top;
    el.classList.add('low');
    el.style.top = `${Math.round(bottom - m.top - r.height - 18)}px`;
  };

  const showLimit = (kind: 'zoom' | 'pan') => {
    const now = Date.now();
    if (now - last < 3500) return;
    last = now;
    const L = lang();
    el.querySelector('b')!.textContent = translate(L, kind === 'zoom' ? 'limit_zoom' : 'limit_pan');
    el.querySelector('small')!.textContent = translate(L, 'limit_zoom_d');
    placeLimit();
    el.classList.add('show');
    clearTimeout(hide);
    hide = window.setTimeout(() => el.classList.remove('show'), 2600);
  };

  const atZoomLimit = () => {
    const b = map.getBounds();
    const [[w, so], [e, n]] = MAX_BOUNDS as [[number, number], [number, number]];
    return (
      map.getZoom() <= map.getMinZoom() + 0.02 ||
      b.getEast() - b.getWest() >= (e - w) * 0.985 ||
      b.getNorth() - b.getSouth() >= (n - so) * 0.985
    );
  };

  const zoomOutAttempt = () => {
    if (check) return;
    const z0 = map.getZoom();
    check = window.setTimeout(() => {
      check = 0;
      const z = map.getZoom();
      if (z >= z0 - 0.01 && z <= z0 + 0.01 && atZoomLimit()) showLimit('zoom');
    }, 200);
  };

  const cv = map.getCanvasContainer();
  cv.addEventListener(
    'wheel',
    (e) => {
      if (e.deltaY > 0) zoomOutAttempt();
    },
    { passive: true },
  );
  container.addEventListener(
    'click',
    (e) => {
      if ((e.target as HTMLElement).closest?.('.maplibregl-ctrl-zoom-out')) zoomOutAttempt();
    },
    true,
  );
  let d0 = 0;
  let z0 = 0;
  let fired = false;
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  cv.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        d0 = dist(e.touches);
        z0 = map.getZoom();
        fired = false;
      }
    },
    { passive: true },
  );
  cv.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length !== 2 || fired || !d0) return;
      if (dist(e.touches) < d0 * 0.8 && Math.abs(map.getZoom() - z0) < 0.01 && atZoomLimit()) {
        fired = true;
        showLimit('zoom');
      }
    },
    { passive: true },
  );
  cv.addEventListener(
    'touchend',
    () => {
      d0 = 0;
    },
    { passive: true },
  );
  let p0: { x: number; y: number } | null = null;
  let c0: LngLat | null = null;
  map.on('dragstart', (e) => {
    const oe = e.originalEvent as MouseEvent | TouchEvent | undefined;
    const pt = oe && 'touches' in oe ? oe.touches[0] : (oe as MouseEvent | undefined);
    p0 = pt ? { x: pt.clientX, y: pt.clientY } : null;
    c0 = map.getCenter();
  });
  map.on('dragend', (e) => {
    const oe = e.originalEvent as MouseEvent | TouchEvent | undefined;
    const pt = oe && 'changedTouches' in oe ? oe.changedTouches[0] : (oe as MouseEvent | undefined);
    if (!p0 || !c0 || !pt) return;
    const d = Math.hypot(pt.clientX - p0.x, pt.clientY - p0.y);
    const a = map.project(c0);
    const b = map.project(map.getCenter());
    const moved = Math.hypot(a.x - b.x, a.y - b.y);
    if (d > 80 && moved < d * 0.35) showLimit('pan');
    p0 = c0 = null;
  });
}
