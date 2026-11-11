import * as maplibregl from 'maplibre-gl';
import {
  type GeoJSONSource,
  type Map as MLMap,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { AppState } from '../../store/useApp';
import type { AtlasData } from '../../data/load';
import type { Place, ProvinceId } from '../../data/types';
import { BASEMAPS, CR_BOUNDS, MAX_BOUNDS, ENDPOINTS } from '../../data/config';
import { translate } from '../../i18n';
import { isMobile } from '../../lib/selectors';
import type { Bounds } from '../../lib/geo';
import type { MapApi } from '../../lib/mapBus';
import {
  applyPadding as applyCamPadding,
  fitBounds as fitCamBounds,
  flyCam,
  focusPlace as focusCamPlace,
  panelPadding,
  panelToggled as onPanelToggled,
  visiblePadding,
} from './camera';
import { addFavPin, addPinImages, drawCluster, pruneClusterImages } from './images';
import type { ClusterHost } from './clusters';
import { addContentLayers, CLUSTER } from './layers';
import { attachLimitHint } from './limitHint';
import { onClick, onMove, clearHover } from './mapPointer';
import { set3d, syncMeasure, syncMe, syncRoute } from './syncExtras';
import { repositionPlaceLabel, syncPlaces, syncSelected } from './syncSelection';
import { setBase, syncOverlays, syncProvStyle } from './syncStyle';

maplibregl.setWorkerUrl(workerUrl);

const BOOT_CONTENT = [
  'clusters',
  'pins',
  'pins-hover',
  'pin-labels',
  'geom-fill',
  'geom-outline-dash',
  'geom-lines',
  'geom-dashed',
  'eez',
  'eez-mma',
  'eez-hit',
] as const;

export interface ControllerEvents {
  selectPlace(id: string, fly: boolean): void;
  provinceClick(id: ProvinceId, lngLat: [number, number]): void;
  emptyClick(): void;
  moved(): void;
  overlayOpened?(): void;
}

export class MapController implements MapApi {
  map: MLMap;
  s: AppState;
  d: AtlasData;
  hoverPin = '';
  hoverTip = '';
  hitLayers: string[] | null = null;
  labelBox: { el: HTMLElement; w: number; h: number } | null = null;
  labelDx = '';
  ev: ControllerEvents;
  ready = false;
  tip: maplibregl.Popup;
  stopMarkers: maplibregl.Marker[] = [];
  meMarker: maplibregl.Marker | null = null;
  provLabels: maplibregl.Marker[] = [];
  hoverGeom: string | number | null = null;
  hoverProv: string | number | null = null;
  selMarker: maplibregl.Marker | null = null;
  selMarkerId: string | null = null;
  measureLabel: maplibregl.Marker | null = null;
  clPicking = false;
  listPop: maplibregl.Popup | null = null;
  extOverlay = false;
  contentVisible = false;
  wantReveal = false;

  constructor(container: HTMLElement, state: AppState, data: AtlasData, ev: ControllerEvents) {
    this.s = state;
    this.d = data;
    this.ev = ev;
    const view = state.initialView;
    this.map = new maplibregl.Map({
      container,
      style: this.buildStyle(),
      center: view ? [view[1], view[0]] : [-84.2, 9.6],
      zoom: view ? view[2] : 6.8,
      minZoom: 4.5,
      maxBounds: MAX_BOUNDS as maplibregl.LngLatBoundsLike,
      renderWorldCopies: false,
      maxZoom: 18,
      maxPitch: 80,
      attributionControl: {
        compact: isMobile(),
        customAttribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      },
      canvasContextAttributes: { antialias: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    this.map.touchZoomRotate.disableRotation();

    if (location.search.includes('e2e'))
      (window as unknown as { __crmap: maplibregl.Map }).__crmap = this.map;
    this.map.setPadding(panelPadding(this));
    if (!view)
      this.map.fitBounds(CR_BOUNDS as maplibregl.LngLatBoundsLike, {
        padding: isMobile() ? 22 : { top: 36, bottom: 36, left: 36, right: 80 },
        duration: 0,
        maxZoom: 7.85,
      });
    this.map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true, showCompass: false }),
      'bottom-right',
    );
    this.map.addControl(new maplibregl.ScaleControl({ maxWidth: 110 }), 'bottom-left');
    this.tip = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'tip',
      offset: 14,
      maxWidth: '260px',
    });

    this.map.setMissingStyleImageResolver((id) => {
      if (id.startsWith('cl:') && !this.map.hasImage(id)) drawCluster(this.map, id);
      else if (id.startsWith('pin-') && id.endsWith('-fav')) addFavPin(this.map, id);
    });

    this.map.on('error', (e) => {
      const src = (e as { sourceId?: string }).sourceId;
      if (src || /Failed to fetch|AJAXError/.test(String(e.error?.message ?? ''))) return;
      console.error(e.error);
    });
    this.map.on('load', async () => {
      await addPinImages(this.map);
      this.addLayers();
      this.ready = true;
      this.syncAll();
      this.hideBootContent();
      if (this.wantReveal) this.revealContent();
      if (state.is3d) set3d(this, true, false);
    });
    this.map.on('moveend', () => {
      pruneClusterImages(this.map);
      this.ev.moved();
    });
    this.map.on('move', () => repositionPlaceLabel(this));
    this.map.on('resize', () => repositionPlaceLabel(this));
    this.map.on('click', (e) => onClick(this, e));
    attachLimitHint(this.map, container, () => this.s.lang);

    let moveEv: MapMouseEvent | null = null;
    this.map.on('mousemove', (e) => {
      if (e.originalEvent.buttons) return;
      const first = !moveEv;
      moveEv = e;
      if (first)
        requestAnimationFrame(() => {
          const ev = moveEv;
          moveEv = null;
          if (ev) onMove(this, ev);
        });
    });
    this.map.on('mouseout', () => clearHover(this));
  }

  private buildStyle(): StyleSpecification {
    const b = BASEMAPS[this.s.base];
    return {
      version: 8,
      glyphs: ENDPOINTS.glyphs,
      sources: {
        base: { type: 'raster', tiles: b.tiles, tileSize: 256, maxzoom: b.max, attribution: b.attr },
        hs: {
          type: 'raster-dem',
          tiles: [ENDPOINTS.terrain],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 13,
        },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#0e1a22' } },
        { id: 'base', type: 'raster', source: 'base', paint: { 'raster-fade-duration': 150 } },
        {
          id: 'hillshade',
          type: 'hillshade',
          source: 'hs',
          layout: { visibility: this.s.ov.hill ? 'visible' : 'none' },
          paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#3b2f2f' },
        },
      ],
    };
  }

  private addLayers() {
    this.provLabels = addContentLayers(this.map, this.d, this.s.ov.cluster);
  }

  clusterHost(): ClusterHost {
    const lang = () => this.s.lang;
    const listPop = () => this.listPop;
    const setListPop = (v: maplibregl.Popup | null) => {
      this.listPop = v;
    };
    const clPicking = () => this.clPicking;
    const setClPicking = (v: boolean) => {
      this.clPicking = v;
    };
    const selMarker = () => this.selMarker;
    const selMarkerId = () => this.selMarkerId;
    return {
      map: this.map,
      d: this.d,
      ev: this.ev,
      tip: this.tip,
      get lang() {
        return lang();
      },
      get listPop() {
        return listPop();
      },
      set listPop(v) {
        setListPop(v);
      },
      get clPicking() {
        return clPicking();
      },
      set clPicking(v) {
        setClPicking(v);
      },
      get selMarker() {
        return selMarker();
      },
      get selMarkerId() {
        return selMarkerId();
      },
    };
  }

  update(s: AppState) {
    const p = this.s;
    this.s = s;
    if (!this.ready) return;
    const m = this.map;
    if (s.base !== p.base) setBase(this);
    if (s.ov !== p.ov) {
      m.setLayoutProperty('hillshade', 'visibility', s.ov.hill ? 'visible' : 'none');
      syncOverlays(this);
      if (s.ov.cluster !== p.ov.cluster)
        (m.getSource('places') as GeoJSONSource).setClusterOptions({
          cluster: s.ov.cluster,
          clusterMaxZoom: CLUSTER.clusterMaxZoom,
          clusterRadius: CLUSTER.clusterRadius,
        });
    }
    const filters = s.active !== p.active || s.prov !== p.prov || s.cat !== p.cat;
    const lang = s.lang !== p.lang;
    if (filters || lang || s.favs !== p.favs) syncPlaces(this, filters || lang);
    if (s.prov !== p.prov || s.base !== p.base) syncProvStyle(this);
    if (s.sel !== p.sel || s.favs !== p.favs || s.lang !== p.lang) syncSelected(this);
    if (s.sel !== p.sel || s.prov !== p.prov) syncOverlays(this);
    if (s.routeData !== p.routeData || s.route !== p.route || s.lang !== p.lang) syncRoute(this);
    if (s.measure !== p.measure || s.measurePts !== p.measurePts) syncMeasure(this);
    if (s.me !== p.me) syncMe(this);
    if (s.lang !== p.lang && this.meMarker)
      this.meMarker.getElement().title = translate(s.lang, 'you_are_here');
    if (s.is3d !== p.is3d) set3d(this, s.is3d, true);
    if (s.panelOpen !== p.panelOpen) onPanelToggled(this);
    if (!this.contentVisible) this.hideBootContent();
  }

  private syncAll() {
    setBase(this, true);
    syncOverlays(this);
    syncPlaces(this);
    syncProvStyle(this);
    syncSelected(this);
    syncRoute(this);
    syncMeasure(this);
    syncMe(this);
  }

  refreshPlaces() {
    if (!this.ready) return;
    syncPlaces(this);
    if (!this.contentVisible) this.hideBootContent();
  }

  revealContent() {
    this.wantReveal = true;
    if (this.contentVisible || !this.ready) return;
    this.contentVisible = true;
    for (const id of BOOT_CONTENT) {
      if (!this.map.getLayer(id)) continue;
      this.map.setLayoutProperty(id, 'visibility', 'visible');
    }
    syncOverlays(this);
    this.fadeInPlaces();
  }

  private hideBootContent() {
    for (const id of BOOT_CONTENT) {
      if (!this.map.getLayer(id)) continue;
      this.map.setLayoutProperty(id, 'visibility', 'none');
    }
  }

  private fadeInPlaces() {
    const m = this.map;
    const setOp = (op: number) => {
      if (m.getLayer('clusters')) {
        m.setPaintProperty('clusters', 'icon-opacity', op);
        m.setPaintProperty('clusters', 'text-opacity', op);
      }
      if (m.getLayer('pins')) m.setPaintProperty('pins', 'icon-opacity', op);
      if (m.getLayer('pin-labels')) m.setPaintProperty('pin-labels', 'text-opacity', op);
    };
    setOp(0);
    const t0 = performance.now();
    const dur = 650;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - t) * (1 - t);
      setOp(e);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  applyPadding(animate: boolean) {
    applyCamPadding(this, animate);
  }

  focusPlace(p: Place, opts: { fromMap?: boolean } = {}) {
    focusCamPlace(this, p, opts);
  }

  fitBounds(b: Bounds, opts: { maxZoom?: number } = {}) {
    fitCamBounds(this, b, opts);
  }

  flyTo(lat: number, lng: number, zoom: number) {
    flyCam(
      this,
      [lng, lat],
      zoom,
      visiblePadding(this),
      matchMedia('(prefers-reduced-motion: reduce)').matches,
      false,
    );
  }
  getView(): [number, number, number] {
    const c = this.map.getCenter();
    return [c.lat, c.lng, this.map.getZoom()];
  }
  snapshot(): Promise<string | null> {
    return new Promise((res) => {
      this.map.once('render', () => {
        try {
          res(this.map.getCanvas().toDataURL('image/png'));
        } catch {
          res(null);
        }
      });
      this.map.triggerRepaint();
    });
  }
  resize() {
    this.map.resize();
  }
  highlightPlace(id: string | null) {
    if (!this.ready) return;
    const hid = id ?? '';
    if (hid === this.hoverPin) return;
    this.hoverPin = hid;
    this.map.setFilter('pins-hover', [
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'id'], hid],
    ] as never);
  }

  setOverlay(on: boolean) {
    this.extOverlay = on;
    if (on) this.tip.remove();
    if (!this.listPop) this.selMarker?.getElement().classList.toggle('menu-hide', on);
  }

  closePopups() {
    this.listPop?.remove();
    this.listPop = null;
    this.tip.remove();
  }

  destroy() {
    this.map.remove();
  }
}
