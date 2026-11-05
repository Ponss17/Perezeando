import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatLike, Map as MLMap, MapGeoJSONFeature, Marker, Popup } from 'maplibre-gl';
import type { AtlasData } from '../../data/load';
import { CATEGORIES, CATEGORY_ORDER } from '../../data/config';
import type { Lang, Place } from '../../data/types';
import { pick } from '../../i18n';
import { iconSvg } from '../../lib/icons';
import type { ControllerEvents } from './controller';

export interface ClusterHost {
  map: MLMap;
  d: AtlasData;
  ev: ControllerEvents;
  tip: { remove(): void };
  lang: Lang;
  listPop: Popup | null;
  clPicking: boolean;
  readonly selMarker: Marker | null;
  readonly selMarkerId: string | null;
}

export async function expandCluster(host: ClusterHost, f: MapGeoJSONFeature) {
  const CHOOSER_MAX = 10;
  const src = host.map.getSource('places') as GeoJSONSource;
  const cid = f.properties.cluster_id as number;
  const count = Number(f.properties.point_count);
  const center = (f.geometry as GeoJSON.Point).coordinates as [number, number];
  const [z, leaves] = await Promise.all([
    src.getClusterExpansionZoom(cid),
    src.getClusterLeaves(cid, 200, 0),
  ]);
  const pts = leaves.map((l) => (l.geometry as GeoJSON.Point).coordinates);
  const xs = pts.map((c) => c[0]);
  const ys = pts.map((c) => c[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const cur = host.map.getZoom();
  const target = Math.min(z + 0.35, 15);
  const canZoom = span >= 0.003 && cur < host.map.getMaxZoom() - 0.5 && target > cur + 0.05;
  const zoomIn = () => host.map.easeTo({ center: center as LngLatLike, zoom: target, duration: 550 });
  if (count <= CHOOSER_MAX || !canZoom) {
    showClusterList(host, center, leaves.map((l) => String(l.properties?.id)), canZoom ? zoomIn : null);
    return;
  }
  zoomIn();
}

function showClusterList(host: ClusterHost, at: [number, number], ids: string[], zoomIn: (() => void) | null) {
  host.tip.remove();
  host.listPop?.remove();
  const L = host.lang;
  const places = ids
    .map((id) => host.d.byId.get(id))
    .filter((p): p is Place => !!p)
    .sort((a, b) => pick(L, a.name).localeCompare(pick(L, b.name), L));
  const n = places.length;
  const tally = new Map<string, { color: string; n: number }>();
  for (const p of places) {
    const c = CATEGORIES[p.cat];
    const t = tally.get(p.cat) ?? { color: c.color, n: 0 };
    t.n += 1;
    tally.set(p.cat, t);
  }
  const box = document.createElement('div');
  box.className = 'cl-list';
  const bar = document.createElement('div');
  bar.className = 'ct-bar';
  [...tally.values()]
    .sort((a, b) => b.n - a.n)
    .forEach((t) => {
      const s = document.createElement('i');
      s.style.width = (t.n / n) * 100 + '%';
      s.style.background = t.color;
      bar.appendChild(s);
    });
  const head = document.createElement('div');
  head.className = 'ct-head';
  const badge = document.createElement('b');
  badge.className = 'ct-n';
  badge.textContent = String(n);
  const text = document.createElement('span');
  const title = document.createElement('b');
  title.textContent = L === 'en' ? (n === 1 ? 'place' : 'places') : n === 1 ? 'lugar' : 'lugares';
  text.appendChild(title);
  if (zoomIn) {
    const zb = document.createElement('button');
    zb.type = 'button';
    zb.className = 'cl-zoom';
    zb.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>';
    zb.append(L === 'en' ? 'Zoom in' : 'Acercar');
    zb.addEventListener('click', () => {
      host.listPop?.remove();
      zoomIn();
    });
    text.appendChild(zb);
  }
  head.append(badge, text);
  box.append(bar, head);
  const ul = document.createElement('ul');
  const byCat = new Map<Place['cat'], Place[]>();
  for (const p of places) {
    const list = byCat.get(p.cat);
    if (list) list.push(p);
    else byCat.set(p.cat, [p]);
  }
  for (const id of CATEGORY_ORDER) {
    const group = byCat.get(id);
    if (!group) continue;
    const c = CATEGORIES[id];
    const li = document.createElement('li');
    li.className = 'cl-group';
    li.style.setProperty('--c', c.color);
    const sec = document.createElement('div');
    sec.className = 'cl-sec';
    const mark = document.createElement('i');
    const label = document.createElement('span');
    label.textContent = pick(L, c.name);
    sec.append(mark, label);
    if (group.length > 1) {
      const count = document.createElement('em');
      count.textContent = String(group.length);
      sec.appendChild(count);
    }
    li.appendChild(sec);
    for (const p of group) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cl-item';
      b.style.setProperty('--c', c.color);
      b.innerHTML = `<i class="cl-ico">${iconSvg(c.icon, { size: 13, color: '#fff', stroke: 2.4 })}</i><span><b><span class="mq"></span></b></span>`;
      b.querySelector('b .mq')!.textContent = pick(L, p.name);
      b.addEventListener('click', () => {
        host.clPicking = host.selMarkerId?.split('|')[0] !== p.id;
        host.listPop?.remove();
        host.clPicking = false;
        host.ev.selectPlace(p.id, true);
      });
      li.appendChild(b);
    }
    ul.appendChild(li);
  }
  box.appendChild(ul);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !host.listPop) return;
    e.stopImmediatePropagation();
    host.listPop.remove();
  };
  window.addEventListener('keydown', onKey, true);
  const pop = new maplibregl.Popup({
    className: 'cl-pop',
    offset: 24,
    maxWidth: '290px',
    closeButton: false,
    closeOnClick: true,
    focusAfterOpen: false,
  })
    .setLngLat(at)
    .setDOMContent(box)
    .addTo(host.map);
  host.ev.overlayOpened?.();
  host.selMarker?.getElement().classList.add('menu-hide');
  pop.on('close', () => {
    window.removeEventListener('keydown', onKey, true);
    if (!host.clPicking) host.selMarker?.getElement().classList.remove('menu-hide');
    if (host.listPop === pop) host.listPop = null;
  });
  host.listPop = pop;
}
