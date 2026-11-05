import type { GeoJSONSource } from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import { BASEMAPS } from '../../data/config';
import type { Place } from '../../data/types';
import { pick, translate } from '../../i18n';
import { circlePolygon } from '../../lib/geo';
import { isMobile, visiblePlaces } from '../../lib/selectors';
import { select } from '../../store/actions';
import type { MapController } from './controller';
import { PANEL_W } from './layout';
import { placeLabel as placeLabelEl } from './markers';
import { geomCollection, placeCollection } from './placeData';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function setBase(c: MapController, initial = false) {
  const m = c.map;
  const b = BASEMAPS[c.s.base];
  if (!initial) {
    m.removeLayer('base');
    m.removeSource('base');
    m.addSource('base', {
      type: 'raster',
      tiles: b.tiles,
      tileSize: 256,
      maxzoom: b.max,
      attribution: b.attr,
    });
    m.addLayer(
      { id: 'base', type: 'raster', source: 'base', paint: { 'raster-fade-duration': 150 } },
      'hillshade',
    );
  }
  if (m.getLayer('base-labels')) m.removeLayer('base-labels');
  if (m.getSource('base-labels')) m.removeSource('base-labels');
  if (b.labels) {
    m.addSource('base-labels', { type: 'raster', tiles: [b.labels], tileSize: 256, maxzoom: b.max });
    m.addLayer({ id: 'base-labels', type: 'raster', source: 'base-labels' }, 'geom-fill');
  }
  document.body.classList.toggle('dark', c.s.base === 'dark');
  document.body.classList.toggle('on-sat', !!b.dark);
  document.body.dataset.map = c.s.base;
  syncProvLabels(c);
}

export function syncProvLabels(c: MapController) {
  const show = c.s.ov.prov && c.s.base === 'dark';
  c.provLabels.forEach((mk) => (show ? mk.addTo(c.map) : mk.remove()));
}

export function syncOverlays(c: MapController) {
  const m = c.map;
  const v = (on: boolean) => (on ? 'visible' : 'none');
  ['prov-fill', 'prov-line', 'prov-line-sel'].forEach((l) =>
    m.setLayoutProperty(l, 'visibility', v(c.s.ov.prov)),
  );
  ['eez', 'eez-mma', 'eez-hit'].forEach((l) => m.setLayoutProperty(l, 'visibility', v(c.s.ov.eez)));
  syncProvLabels(c);
}

export function syncProvStyle(c: MapController) {
  const m = c.map;
  const dark = !!BASEMAPS[c.s.base].dark;
  const sel = c.s.prov;
  const isProv = sel !== 'all' && sel !== 'mar';
  const line = dark ? '#ffffff' : '#4b524e';
  m.setPaintProperty('prov-line', 'line-color', line);
  m.setPaintProperty('prov-line', 'line-opacity', sel === 'all' ? (dark ? 0.7 : 0.55) : 0.35);
  m.setPaintProperty('prov-line-sel', 'line-color', dark ? '#ffffff' : '#386641');
  m.setFilter('prov-line-sel', ['==', ['get', 'id'], isProv ? sel : '']);
  m.setPaintProperty('prov-fill', 'fill-color', dark ? '#000' : '#1b1f1d');
  m.setPaintProperty('pin-labels', 'text-color', dark ? '#ffffff' : '#1b1f1d');
  m.setPaintProperty('pin-labels', 'text-halo-color', dark ? 'rgba(24,52,32,.92)' : 'rgba(255,255,255,.95)');
  m.setPaintProperty(
    'prov-fill',
    'fill-opacity',
    sel === 'all'
      ? ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0]
      : ['case', ['==', ['get', 'id'], sel], 0, dark ? 0.32 : 0.12],
  );
}

export function syncPlaces(c: MapController, withGeoms = true) {
  const s = c.s;
  const vis = visiblePlaces(s, c.d.places);
  const favs = new Set(s.favs);
  (c.map.getSource('places') as GeoJSONSource).setData(placeCollection(vis, s.lang, favs));
  if (withGeoms) (c.map.getSource('geoms') as GeoJSONSource).setData(geomCollection(vis, s.lang));
}

export function syncSelected(c: MapController) {
  const sel = c.s.sel;
  const p = sel?.kind === 'place' ? c.d.byId.get(sel.id) : null;
  const notSel: unknown[] = ['!=', ['get', 'id'], p?.id ?? ''];
  const base = ['!', ['has', 'point_count']];
  c.map.setFilter('pins', ['all', base, notSel] as never);
  c.map.setFilter('pin-labels', ['all', base, notSel] as never);
  if (!p) {
    c.selMarker?.remove();
    c.selMarker = null;
    c.selMarkerId = null;
    return;
  }
  const fav = c.s.favs.includes(p.id);
  const key = `${p.id}|${c.s.lang}|${fav ? 1 : 0}`;
  if (c.selMarker && c.selMarkerId === key) return;
  const sameId = c.selMarkerId?.split('|')[0] === p.id;
  c.selMarker?.remove();
  const el = placeLabelEl(p, c.s.lang, {
    fav,
    animate: !sameId,
    onOpen: () => select(p.id, { noFly: true }),
  });
  c.selMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([p.lng, p.lat])
    .addTo(c.map);
  c.selMarkerId = key;
  if (c.extOverlay || c.listPop) el.classList.add('menu-hide');
  placeLabel(c);
  requestAnimationFrame(() => placeLabel(c));
}

/** Coloca el rótulo del seleccionado arriba de la chincheta, o debajo si no cabe. */
export function placeLabel(c: MapController) {
  const mk = c.selMarker;
  if (!mk) return;
  const el = mk.getElement();
  const lb = el.querySelector<HTMLElement>('.sel-label');
  if (!lb) return;
  const pt = c.map.project(mk.getLngLat());
  const W = c.map.getContainer().clientWidth;
  const mob = isMobile();
  let box = c.labelBox;
  if (!box || box.el !== lb) {
    box = c.labelBox = { el: lb, w: lb.offsetWidth, h: lb.offsetHeight };
    c.labelDx = '';
  }
  const top = mob ? 64 : 10;
  const flip = pt.y - 50 - 8 - box.h < top;
  if (el.classList.contains('flip') !== flip) {
    el.classList.toggle('flip', flip);
    box.w = lb.offsetWidth;
    box.h = lb.offsetHeight;
  }
  const left = mob ? 8 : (c.s.panelOpen ? PANEL_W : 0) + 10;
  const right = W - (mob ? 8 : 60);
  const x0 = pt.x - box.w / 2;
  let dx = 0;
  if (x0 < left) dx = left - x0;
  else if (x0 + box.w > right) dx = right - (x0 + box.w);
  const lim = Math.max(0, box.w / 2 - 9);
  dx = Math.max(-lim, Math.min(lim, dx));
  const next = `${Math.round(dx)}px`;
  if (next !== c.labelDx) {
    c.labelDx = next;
    el.style.setProperty('--dx', next);
  }
}

export function syncRoute(c: MapController) {
  const s = c.s;
  const stops = s.route.map((id) => c.d.byId.get(id)).filter(Boolean) as Place[];
  const rd = s.routeData && s.routeData.key === s.route.join(',') ? s.routeData : null;
  (c.map.getSource('route') as GeoJSONSource).setData(
    rd && stops.length >= 2
      ? {
          type: 'FeatureCollection',
          features: [
            { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: rd.line } },
          ],
        }
      : EMPTY,
  );
  c.map.setPaintProperty('route', 'line-dasharray', rd?.mode === 'fallback' ? [1.7, 2] : [1, 0]);
  c.stopMarkers.forEach((m) => m.remove());
  c.stopMarkers = stops.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'stop-pin';
    el.textContent = String(i + 1);
    el.title = pick(s.lang, p.name);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      c.ev.selectPlace(p.id, true);
    });
    return new maplibregl.Marker({ element: el, offset: [0, 0] }).setLngLat([p.lng, p.lat]).addTo(c.map);
  });
}

export function syncMe(c: MapController) {
  const me = c.s.me;
  if (!me) return;
  (c.map.getSource('me') as GeoJSONSource).setData({
    type: 'Feature',
    properties: {},
    geometry: circlePolygon(me, c.s.meAcc || 100),
  });
  if (!c.meMarker) {
    const el = document.createElement('div');
    el.className = 'me-pin';
    el.title = translate(c.s.lang, 'you_are_here');
    c.meMarker = new maplibregl.Marker({ element: el });
  }
  c.meMarker.setLngLat([me[1], me[0]]).addTo(c.map);
}

export function set3d(c: MapController, on: boolean, animate: boolean) {
  const m = c.map;
  if (on) {
    m.setTerrain({ source: 'dem', exaggeration: 1.5 });
    m.setSky({
      'sky-color': '#7fb2d8',
      'horizon-color': '#dfe9ef',
      'fog-color': '#e6ecef',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.6,
      'atmosphere-blend': 0.6,
    });
    m.dragRotate.enable();
    m.touchPitch.enable();
    m.touchZoomRotate.enableRotation();
    m.keyboard.enableRotation?.();
    m.easeTo({ pitch: 60, bearing: -18, zoom: Math.max(m.getZoom(), 8.2), duration: animate ? 900 : 0 });
  } else {
    m.setTerrain(null);
    m.setSky(undefined as never);
    m.dragRotate.disable();
    m.touchPitch.disable();
    m.touchZoomRotate.disableRotation();
    m.easeTo({ pitch: 0, bearing: 0, duration: animate ? 700 : 0 });
  }
}

export function syncMeasure(c: MapController) {
  const src = c.map.getSource('measure') as GeoJSONSource | undefined;
  if (!src) return;
  const pts = c.s.measure ? c.s.measurePts : [];
  const features: GeoJSON.Feature[] = pts.map((coord) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: coord },
  }));
  if (pts.length === 2)
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } });
  src.setData({ type: 'FeatureCollection', features });
  if (c.s.measure) c.map.getCanvas().style.cursor = 'crosshair';
}
