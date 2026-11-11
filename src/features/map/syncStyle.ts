import { BASEMAPS } from '../../data/config';
import type { MapController } from './controller';

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
    const showLabels = c.s.ov.prov && c.s.prov === 'all';
    m.addLayer(
      {
        id: 'base-labels',
        type: 'raster',
        source: 'base-labels',
        layout: { visibility: showLabels ? 'visible' : 'none' },
      },
      'geom-fill',
    );
  }
  document.body.classList.toggle('dark', c.s.base === 'dark');
  document.body.classList.toggle('on-sat', !!b.dark);
  document.body.dataset.map = c.s.base;
  syncProvLabels(c);
}

function syncProvLabels(c: MapController) {
  const show = c.s.ov.prov && c.s.base === 'dark';
  c.provLabels.forEach((mk) => (show ? mk.addTo(c.map) : mk.remove()));
}

export function syncOverlays(c: MapController) {
  const m = c.map;
  const v = (on: boolean) => (on ? 'visible' : 'none');
  ['prov-fill', 'prov-line', 'prov-line-sel'].forEach((l) =>
    m.setLayoutProperty(l, 'visibility', v(c.s.ov.prov)),
  );
  const showBaseLabels = c.s.ov.prov && c.s.prov === 'all' && c.s.sel?.kind !== 'place';
  if (m.getLayer('base-labels')) m.setLayoutProperty('base-labels', 'visibility', v(showBaseLabels));
  ['eez', 'eez-mma', 'eez-hit'].forEach((l) => m.setLayoutProperty(l, 'visibility', v(c.s.ov.eez)));
  syncProvLabels(c);
}

export function syncProvStyle(c: MapController) {
  const m = c.map;
  const dark = !!BASEMAPS[c.s.base].dark;
  const sel = c.s.prov;
  const isProv = sel !== 'all' && sel !== 'mar';
  const line = dark ? '#ffffff' : '#4b524e';

  if (isProv) {
    m.setFilter('prov-line', ['==', ['get', 'id'], sel]);
    m.setPaintProperty('prov-line', 'line-color', '#0c1810');
    m.setPaintProperty('prov-line', 'line-opacity', 0.9);
    m.setPaintProperty('prov-line', 'line-width', 6);
    m.setPaintProperty('prov-line', 'line-dasharray', [1, 0]);
    m.setFilter('prov-line-sel', ['==', ['get', 'id'], sel]);
    m.setPaintProperty('prov-line-sel', 'line-color', '#d4ec8a');
    m.setPaintProperty('prov-line-sel', 'line-opacity', 1);
    m.setPaintProperty('prov-line-sel', 'line-width', 3);
  } else if (sel === 'mar') {
    m.setFilter('prov-line', ['==', ['get', 'id'], '']);
    m.setFilter('prov-line-sel', ['==', ['get', 'id'], '']);
  } else {
    m.setFilter('prov-line', null);
    m.setPaintProperty('prov-line', 'line-color', line);
    m.setPaintProperty('prov-line', 'line-opacity', dark ? 0.7 : 0.55);
    m.setPaintProperty('prov-line', 'line-width', 1.1);
    m.setPaintProperty('prov-line', 'line-dasharray', [5, 3, 1, 3]);
    m.setFilter('prov-line-sel', ['==', ['get', 'id'], '']);
    m.setPaintProperty('prov-line-sel', 'line-color', dark ? '#ffffff' : '#386641');
    m.setPaintProperty('prov-line-sel', 'line-opacity', 1);
    m.setPaintProperty('prov-line-sel', 'line-width', 2.5);
  }

  if (m.getLayer('base-labels')) {
    const showBaseLabels = c.s.ov.prov && sel === 'all' && c.s.sel?.kind !== 'place';
    m.setLayoutProperty('base-labels', 'visibility', showBaseLabels ? 'visible' : 'none');
  }

  m.setPaintProperty('prov-fill', 'fill-color', dark ? '#000' : '#1b1f1d');
  m.setPaintProperty('pin-labels', 'text-color', dark ? '#ffffff' : '#1b1f1d');
  m.setPaintProperty('pin-labels', 'text-halo-color', dark ? 'rgba(24,52,32,.92)' : 'rgba(255,255,255,.95)');
  m.setPaintProperty(
    'prov-fill',
    'fill-opacity',
    sel === 'all'
      ? ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0]
      : sel === 'mar'
        ? dark
          ? 0.34
          : 0.14
        : ['case', ['==', ['get', 'id'], sel], 0, dark ? 0.42 : 0.18],
  );
}
