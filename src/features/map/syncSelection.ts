import type { GeoJSONSource } from 'maplibre-gl';
import * as maplibregl from 'maplibre-gl';
import { isMobile, visiblePlaces } from '../../lib/selectors';
import { select } from '../../store/selection';
import type { MapController } from './controller';
import { PANEL_W } from './layout';
import { buildPlaceLabel } from './markers';
import { geomCollection, placeCollection } from './placeData';

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
  const el = buildPlaceLabel(p, c.s.lang, {
    fav,
    animate: !sameId,
    onOpen: () => select(p.id, { noFly: true }),
  });
  c.selMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([p.lng, p.lat])
    .addTo(c.map);
  c.selMarkerId = key;
  if (c.extOverlay || c.listPop) el.classList.add('menu-hide');
  repositionPlaceLabel(c);
  requestAnimationFrame(() => repositionPlaceLabel(c));
}

export function repositionPlaceLabel(c: MapController) {
  const mk = c.selMarker;
  if (!mk) return;
  const el = mk.getElement();
  const lb = el.querySelector<HTMLElement>('.sel-label');
  if (!lb) return;
  lb.classList.remove('slide', 'slide-x');
  lb.style.removeProperty('--shift');
  lb.style.removeProperty('--dur');
  lb.style.removeProperty('text-indent');
  const pt = c.map.project(mk.getLngLat());
  const W = c.map.getContainer().clientWidth;
  const mob = isMobile();
  let box = c.labelBox;
  if (!box || box.el !== lb) {
    box = c.labelBox = { el: lb, w: 0, h: 0 };
    c.labelDx = '';
  }
  box.w = lb.offsetWidth;
  box.h = lb.offsetHeight;
  el.style.setProperty('--lw', `${box.w}px`);
  const top = mob ? 64 : 10;
  const flip = pt.y - 50 - 8 - box.h < top;
  if (el.classList.contains('flip') !== flip) {
    el.classList.toggle('flip', flip);
    box.w = lb.offsetWidth;
    box.h = lb.offsetHeight;
    el.style.setProperty('--lw', `${box.w}px`);
  }
  const left = mob ? 8 : (c.s.panelOpen ? PANEL_W : 0) + 10;
  const right = W - (mob ? 8 : 60);
  const x0 = pt.x - box.w / 2;
  let dx = 0;
  if (x0 < left) dx = left - x0;
  else if (x0 + box.w > right) dx = right - (x0 + box.w);
  const lim = Math.max(0, box.w / 4);
  dx = Math.max(-lim, Math.min(lim, dx));
  const next = `${Math.round(dx)}px`;
  if (next !== c.labelDx) {
    c.labelDx = next;
    el.style.setProperty('--dx', next);
  }
}
