import * as maplibregl from 'maplibre-gl';
import type { LngLatLike } from 'maplibre-gl';
import type { Place } from '../../data/types';
import { boundsOf, positions, type Bounds } from '../../lib/geo';
import { isMobile } from '../../lib/selectors';
import type { MapController } from './controller';
import { PANEL_W } from './layout';
import { areaZoom, easeInOutCubic, targetZoom } from './placeZoom';

export function panelPadding(c: MapController) {
  if (isMobile()) {
    const peek = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek')) || 150;
    return { top: 56, bottom: peek, left: 0, right: 0 };
  }
  return { top: 0, bottom: 0, left: c.s.panelOpen ? PANEL_W : 0, right: 0 };
}

export function visiblePadding(c: MapController): maplibregl.PaddingOptions {
  const box = c.map.getContainer();
  const h = box.clientHeight;
  if (isMobile()) {
    const sheet = document.querySelector('.panel') as HTMLElement | null;
    const top = sheet?.getBoundingClientRect().top ?? h * 0.5;
    const bottom = Math.min(h * 0.62, Math.max(0, box.getBoundingClientRect().bottom - top)) + 24;
    return { top: 70, bottom, left: 24, right: 24 };
  }
  return { top: 60, bottom: 50, left: (c.s.panelOpen ? PANEL_W : 0) + 50, right: 80 };
}

export function panelToggled(c: MapController) {
  if (isMobile()) return applyPadding(c, true);
  const m = c.map;
  m.stop();
  const pad = panelPadding(c);
  const box = m.getContainer();
  const ax = Math.max(8, box.clientWidth - 24);
  const ay = 24;
  const anchor = m.unproject([ax, ay]);
  const bounds = m.getMaxBounds();
  m.setMaxBounds(null);
  m.setPadding(pad);
  m.jumpTo(
    m.calculateAnchoredCameraOptions({
      anchorLocation: anchor,
      anchorScreenPoint: [ax, ay],
    }),
  );
  if (bounds) m.setMaxBounds(bounds);
}

export function applyPadding(c: MapController, animate: boolean) {
  c.map.easeTo({ padding: panelPadding(c), duration: animate ? 340 : 0 });
}

export function focusPlace(c: MapController, p: Place, opts: { fromMap?: boolean } = {}) {
  const m = c.map;
  m.stop();
  const pad = visiblePadding(c);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cur = m.getZoom();
  const maxZ = m.getMaxZoom();
  if (p.geometry) {
    const b = boundsOf(positions(p.geometry));
    if (b) {
      const cam = m.cameraForBounds(b as maplibregl.LngLatBoundsLike, { padding: pad, maxZoom: 15.5 });
      if (cam?.center) return flyCam(c, cam.center as LngLatLike, cam.zoom ?? cur, pad, reduce, false);
    }
  }
  let z = areaZoom(p) ?? targetZoom(p);
  if (opts.fromMap) z = Math.min(z, Math.max(cur + 4, 14));
  z = Math.min(z, maxZ - 0.5);
  flyCam(c, [p.lng, p.lat], z, pad, reduce, true);
}

export function flyCam(
  c: MapController,
  center: LngLatLike,
  zoom: number,
  padding: maplibregl.PaddingOptions,
  reduce: boolean,
  keepCloser: boolean,
) {
  const m = c.map;
  m.stop();
  const cur = m.getZoom();
  const box = m.getContainer();
  const W = Math.max(1, box.clientWidth - (padding.left ?? 0) - (padding.right ?? 0));
  const to = m.project(center);
  const from = m.project(m.getCenter());
  const px = Math.hypot(to.x - from.x, to.y - from.y);
  const screens = px / W;
  if (keepCloser && cur >= zoom && screens < 0.6) zoom = cur;
  if (reduce) return void m.easeTo({ center, zoom, padding, duration: 250 });
  const dz = Math.abs(zoom - cur);
  if (screens < 1.5 && dz <= 3) {
    const duration = Math.round(Math.min(1100, 700 + screens * 180 + Math.abs(zoom - cur) * 40));
    return void m.easeTo({ center, zoom, padding, duration, easing: easeInOutCubic });
  }
  const a = m.getCenter();
  const b = maplibregl.LngLat.convert(center);
  const both = m.cameraForBounds(
    [
      [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat)],
      [Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)],
    ],
    { padding },
  );
  let minZoom = Math.min(cur, zoom, (both?.zoom ?? cur) - 0.5);
  const k = Math.min(1, (screens - 1.5) / 2.5);
  minZoom = Math.min(cur, zoom) - (Math.min(cur, zoom) - minZoom) * k;
  const km = a.distanceTo(b) / 1000;
  const duration = Math.round(Math.min(3500, Math.max(1400, 1100 + Math.log2(1 + km) * 330, 900 + dz * 160)));
  m.flyTo({
    center,
    zoom,
    padding,
    minZoom,
    curve: 1.42,
    duration,
    easing: easeInOutCubic,
    essential: false,
  });
}

export function fitBounds(c: MapController, b: Bounds, opts: { maxZoom?: number } = {}) {
  const mob = isMobile();
  const pad = mob
    ? { top: 20, left: 20, right: 20, bottom: Math.round(window.innerHeight * 0.45) - 100 }
    : { top: 30, left: 30, right: 70, bottom: 30 };
  c.map.fitBounds(b, { padding: pad, duration: 700, maxZoom: opts.maxZoom ?? 11 });
}
