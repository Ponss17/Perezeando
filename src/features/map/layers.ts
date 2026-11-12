import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap } from 'maplibre-gl';
import type { AtlasData } from '../../data/load';
import type { ProvinceId } from '../../data/types';
import { ENDPOINTS, PROVINCE_LABELS } from '../../data/config';
import { clusterImageExpr, clusterProperties } from './images';

type FC = GeoJSON.FeatureCollection;
const EMPTY: FC = { type: 'FeatureCollection', features: [] };

export const CLUSTER = { clusterMaxZoom: 9, clusterRadius: 48 } as const;

export function addContentLayers(map: MLMap, d: AtlasData, cluster: boolean): maplibregl.Marker[] {
  map.addSource('dem', {
    type: 'raster-dem',
    tiles: [ENDPOINTS.terrain],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 14,
    attribution: 'Relieve · Mapzen (AWS Open Data)',
  });
  map.addSource('prov', { type: 'geojson', data: d.provinces as FC, promoteId: 'id' });
  map.addSource('eez', { type: 'geojson', data: d.eez as FC, promoteId: 'id' });
  map.addSource('geoms', { type: 'geojson', data: EMPTY, promoteId: 'id' });
  map.addSource('route', { type: 'geojson', data: EMPTY });
  map.addSource('measure', { type: 'geojson', data: EMPTY });
  map.addSource('me', { type: 'geojson', data: EMPTY });
  map.addSource('places', {
    type: 'geojson',
    data: EMPTY,
    cluster,
    clusterMaxZoom: CLUSTER.clusterMaxZoom,
    clusterRadius: CLUSTER.clusterRadius,
    clusterProperties: clusterProperties as never,
  });

  map.addLayer({
    id: 'prov-fill',
    type: 'fill',
    source: 'prov',
    paint: { 'fill-color': '#000', 'fill-opacity': 0 },
  });
  map.addLayer({
    id: 'prov-line',
    type: 'line',
    source: 'prov',
    paint: { 'line-color': '#4b524e', 'line-width': 1.1, 'line-dasharray': [5, 3, 1, 3] },
  });
  map.addLayer({
    id: 'prov-line-sel',
    type: 'line',
    source: 'prov',
    filter: ['==', ['get', 'id'], ''],
    paint: { 'line-color': '#386641', 'line-width': 2.5 },
  });
  map.addLayer({
    id: 'eez-mma',
    type: 'line',
    source: 'eez',
    filter: ['==', ['get', 'kind'], 'mma'],
    paint: { 'line-color': '#b9b2d9', 'line-width': 1.25, 'line-opacity': 0.8, 'line-dasharray': [2, 4] },
  });
  map.addLayer({
    id: 'eez',
    type: 'line',
    source: 'eez',
    filter: ['==', ['get', 'kind'], 'eez'],
    paint: {
      'line-color': '#9cc4de',
      'line-width': 1.25,
      'line-opacity': 0.8,
      'line-dasharray': [8, 4, 2, 4],
    },
  });
  map.addLayer({
    id: 'eez-hit',
    type: 'line',
    source: 'eez',
    paint: { 'line-color': '#000', 'line-width': 10, 'line-opacity': 0 },
  });
  map.addLayer({
    id: 'geom-fill',
    type: 'fill',
    source: 'geoms',
    filter: ['==', ['get', 'poly'], 1],
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        ['*', ['get', 'op'], 1.8],
        ['get', 'op'],
      ],
    },
  });
  map.addLayer({
    id: 'geom-outline-dash',
    type: 'line',
    source: 'geoms',
    filter: ['==', ['get', 'marine'], 1],
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.25, 'line-dasharray': [4, 4] },
  });
  map.addLayer({
    id: 'geom-lines',
    type: 'line',
    source: 'geoms',
    filter: ['all', ['==', ['get', 'marine'], 0], ['==', ['get', 'dashed'], 0]],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['get', 'lcolor'],
      'line-width': ['+', ['get', 'w'], ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0]],
    },
  });
  map.addLayer({
    id: 'geom-dashed',
    type: 'line',
    source: 'geoms',
    filter: ['==', ['get', 'dashed'], 1],
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['+', 1.75, ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0]],
      'line-dasharray': [3, 3],
    },
  });
  map.addLayer({
    id: 'route-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#0f2e1f', 'line-width': 7, 'line-opacity': 0.6 },
  });
  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round' },
    paint: { 'line-color': '#f2b33d', 'line-width': 3.5 },
  });
  map.addLayer({
    id: 'measure-line',
    type: 'line',
    source: 'measure',
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#f4f7ef', 'line-width': 3, 'line-dasharray': [1.1, 1.1] },
  });
  map.addLayer({
    id: 'measure-pts',
    type: 'circle',
    source: 'measure',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 6,
      'circle-color': '#143024',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'me-acc',
    type: 'fill',
    source: 'me',
    paint: { 'fill-color': '#386641', 'fill-opacity': 0.12, 'fill-outline-color': '#386641' },
  });
  map.addLayer({
    id: 'clusters',
    type: 'symbol',
    source: 'places',
    filter: ['has', 'point_count'],
    layout: {
      'icon-image': clusterImageExpr as never,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['to-string', ['get', 'point_count']],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['case', ['>=', ['get', 'point_count'], 100], 12.5, 13],
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'pins',
    type: 'symbol',
    source: 'places',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['concat', 'pin-', ['get', 'cat'], ['case', ['get', 'fav'], '-fav', '']],
      'icon-allow-overlap': true,
      'icon-ignore-placement': false,
      'symbol-sort-key': ['get', 'order'],
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
    },
  });
  map.addLayer({
    id: 'pins-hover',
    type: 'symbol',
    source: 'places',
    filter: ['==', ['get', 'id'], ''],
    layout: {
      'icon-image': ['concat', 'pin-', ['get', 'cat'], ['case', ['get', 'fav'], '-fav', '']],
      'icon-size': 1.2,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
    },
  });
  map.addLayer({
    id: 'pin-labels',
    type: 'symbol',
    source: 'places',
    minzoom: 9.6,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11.5, 14, 13],
      'text-max-width': 9,
      'text-line-height': 1.15,
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 2.1,
      'text-justify': 'auto',
      'text-padding': 3,
      'symbol-sort-key': ['-', 0, ['get', 'order']],
      'text-optional': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(24,52,32,.92)',
      'text-halo-width': 1.6,
      'text-halo-blur': 0.4,
    },
  });
  map.moveLayer('pin-labels', 'pins');
  return Object.entries(PROVINCE_LABELS).map(([id, c]) => {
    const el = document.createElement('div');
    el.className = 'prov-label';
    el.textContent = d.provById.get(id as ProvinceId)?.name ?? '';
    return new maplibregl.Marker({ element: el }).setLngLat([c[1], c[0]]);
  });
}
