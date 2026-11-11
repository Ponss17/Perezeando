import type { GeoJSONSource } from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import type { Place } from '../../data/types';
import { pick, translate } from '../../i18n';
import { circlePolygon, haversine } from '../../lib/geo';
import type { MapController } from './controller';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

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

  if (pts.length === 2) {
    const mid: [number, number] = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
    const km = haversine([pts[0][1], pts[0][0]], [pts[1][1], pts[1][0]]);
    const text = km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(km < 10 ? 1 : 0) + ' km';
    if (!c.measureLabel) {
      const el = document.createElement('div');
      el.className = 'measure-label';
      el.setAttribute('role', 'status');
      c.measureLabel = new maplibregl.Marker({
        element: el,
        offset: [0, -16],
        pitchAlignment: 'viewport',
        rotationAlignment: 'viewport',
      })
        .setLngLat(mid)
        .addTo(c.map);
    } else {
      c.measureLabel.setLngLat(mid);
    }
    c.measureLabel.getElement().textContent = text;
  } else if (c.measureLabel) {
    c.measureLabel.remove();
    c.measureLabel = null;
  }
}
