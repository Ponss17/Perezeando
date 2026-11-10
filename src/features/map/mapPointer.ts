import type { MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';
import type { ProvinceId } from '../../data/types';
import { prefetchDetails } from '../../lib/prefetch';
import { addMeasurePoint } from '../../store/actions';
import { expandCluster as openCluster } from './clusters';
import { clusterBreakdown } from './images';
import type { MapController } from './controller';
import { clusterSummary, placeTip, plainTip } from './markers';

const INTERACTIVE = [
  'pins',
  'pin-labels',
  'clusters',
  'geom-dashed',
  'geom-lines',
  'geom-fill',
  'eez',
  'prov-fill',
];

let listHot: string | null = null;
function markListHover(id: string) {
  if (listHot === id) return;
  if (listHot) document.querySelector(`.item[data-id="${CSS.escape(listHot)}"]`)?.classList.remove('map-hot');
  listHot = id || null;
  if (!listHot) return;
  const el = document.querySelector(`.item[data-id="${CSS.escape(listHot)}"]`);
  el?.classList.add('map-hot');
}

export function hitFeature(c: MapController, e: MapMouseEvent): MapGeoJSONFeature | null {
  const layers = (c.hitLayers ??= INTERACTIVE.filter((l) => l !== 'eez')
    .concat(['eez-hit'])
    .filter((l) => c.map.getLayer(l)));
  const fs = c.map.queryRenderedFeatures(e.point, { layers });
  if (!fs.length) return null;
  const rank = (f: MapGeoJSONFeature) => {
    const i = [
      'pins',
      'pin-labels',
      'clusters',
      'geom-lines',
      'geom-dashed',
      'geom-fill',
      'eez-hit',
      'prov-fill',
    ].indexOf(f.layer.id);
    return i < 0 ? 99 : i;
  };
  return fs.sort((a, b) => rank(a) - rank(b))[0];
}

export function onClick(c: MapController, e: MapMouseEvent) {
  if (!c.ready) return;
  if (c.s.measure) {
    addMeasurePoint(e.lngLat.lng, e.lngLat.lat);
    return;
  }
  const f = hitFeature(c, e);
  const id = f?.layer.id;
  c.listPop?.remove();
  if (f && (id === 'pins' || id === 'pin-labels')) return c.ev.selectPlace(String(f.properties.id), true);
  if (f && id === 'clusters') return openCluster(c.clusterHost(), f);
  if (f && (id === 'geom-fill' || id === 'geom-lines' || id === 'geom-dashed'))
    return c.ev.selectPlace(String(f.properties.id), false);
  if (f && id === 'prov-fill' && c.s.ov.prov) {
    c.ev.provinceClick(f.properties.id as ProvinceId, [e.lngLat.lng, e.lngLat.lat]);
    return;
  }
  c.ev.emptyClick();
}

export function onMove(c: MapController, e: MapMouseEvent) {
  if (!c.ready) return;
  if (c.s.measure) {
    c.map.getCanvas().style.cursor = 'crosshair';
    return;
  }
  if ((e.originalEvent.target as HTMLElement | null)?.closest?.('.sel-mk')) {
    c.tip.remove();
    return;
  }
  const f = hitFeature(c, e);
  const id = f?.layer.id;
  if (f?.properties?.id && id !== 'clusters' && id !== 'prov-fill' && id !== 'eez-hit') prefetchDetails();
  const canvas = c.map.getCanvas();
  const gid =
    f && (id === 'geom-fill' || id === 'geom-lines' || id === 'geom-dashed') ? (f.id as string) : null;
  if (gid !== c.hoverGeom) {
    if (c.hoverGeom != null) c.map.setFeatureState({ source: 'geoms', id: c.hoverGeom }, { hover: false });
    if (gid != null) c.map.setFeatureState({ source: 'geoms', id: gid }, { hover: true });
    c.hoverGeom = gid;
  }
  const hid = f && id === 'pins' ? String(f.properties?.id ?? '') : '';
  if (hid !== c.hoverPin) {
    c.hoverPin = hid;
    c.map.setFilter('pins-hover', [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'id'], hid],
    ] as never);
    markListHover(hid);
  }
  const pid = f && id === 'prov-fill' && c.s.prov === 'all' ? (f.id as string) : null;
  if (pid !== c.hoverProv) {
    if (c.hoverProv != null) c.map.setFeatureState({ source: 'prov', id: c.hoverProv }, { hover: false });
    if (pid != null) c.map.setFeatureState({ source: 'prov', id: pid }, { hover: true });
    c.hoverProv = pid;
  }
  if (c.listPop || c.extOverlay) {
    c.hoverTip = '';
    c.tip.remove();
    return;
  }
  const tipKey =
    !f || id === 'prov-fill' ? '' : `${id}:${f.properties?.cluster_id ?? f.properties?.id ?? ''}`;
  const follows = id === 'geom-fill' || id === 'geom-lines' || id === 'geom-dashed' || id === 'eez-hit';
  if (tipKey === c.hoverTip) {
    if (!tipKey) return;
    canvas.style.cursor = 'pointer';
    if (follows) c.tip.setLngLat(e.lngLat);
    return;
  }
  c.hoverTip = tipKey;
  if (!f || id === 'prov-fill') {
    canvas.style.cursor = f ? 'pointer' : '';
    c.tip.remove();
    return;
  }
  canvas.style.cursor = 'pointer';
  let el = document.createElement('div');
  if (id === 'clusters') {
    el = clusterSummary(clusterBreakdown(f.properties), c.s.lang);
    const r = 17 + (Number(f.properties.point_count) >= 10 ? 1 : 0);
    c.tip.setOffset(r + 6).setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]);
  } else if (id === 'eez-hit') {
    el.textContent = String(f.properties[c.s.lang === 'en' ? 'name_en' : 'name_es']);
    c.tip.setOffset(8).setLngLat(e.lngLat);
  } else if (id === 'pins' || id === 'pin-labels') {
    const p = c.d.byId.get(String(f.properties.id));
    if (!p) return;
    if (c.selMarker && c.selMarkerId?.split('|')[0] === p.id) {
      c.tip.remove();
      return;
    }
    el = placeTip(p, c.s.lang);
    c.tip.setOffset(17).setLngLat([p.lng, p.lat]);
  } else {
    const p = c.d.byId.get(String(f.properties.id));
    el = p ? placeTip(p, c.s.lang) : plainTip(String(f.properties.catLabel), String(f.properties.name));
    c.tip.setOffset(10).setLngLat(e.lngLat);
  }
  c.tip.setDOMContent(el).addTo(c.map);
}

export function clearHover(c: MapController) {
  c.hoverTip = '';
  c.tip.remove();
  if (c.hoverPin) {
    c.hoverPin = '';
    c.map.setFilter('pins-hover', ['==', ['get', 'id'], ''] as never);
  }
  markListHover('');
  if (c.hoverGeom != null) c.map.setFeatureState({ source: 'geoms', id: c.hoverGeom }, { hover: false });
  if (c.hoverProv != null) c.map.setFeatureState({ source: 'prov', id: c.hoverProv }, { hover: false });
  c.hoverGeom = c.hoverProv = null;
}
