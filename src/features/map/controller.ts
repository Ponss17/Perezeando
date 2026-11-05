import * as maplibregl from 'maplibre-gl';
import {
  type GeoJSONSource,
  type LngLatLike,
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
import { boundsOf, positions, type Bounds } from '../../lib/geo';
import type { MapApi } from '../../lib/mapBus';
import { addFavPin, addPinImages, drawCluster, pruneClusterImages } from './images';
import type { ClusterHost } from './clusters';
import { addContentLayers, CLUSTER } from './layers';
import { PANEL_W } from './layout';
import { attachLimitHint } from './limitHint';
import { onClick, onMove, clearHover } from './mapPointer';
import {
  placeLabel,
  set3d,
  setBase,
  syncMeasure,
  syncMe,
  syncOverlays,
  syncPlaces,
  syncProvStyle,
  syncRoute,
  syncSelected,
} from './mapSync';
import { areaZoom, easeInOutCubic, targetZoom } from './placeZoom';

maplibregl.setWorkerUrl(workerUrl);

export interface ControllerEvents {
  selectPlace(id: string, fly: boolean): void;
  provinceClick(id: ProvinceId, lngLat: [number, number]): void;
  emptyClick(): void;
  moved(): void;
  /** se abrió una tarjeta del controlador (menú de grupo): cerrar las demás */
  overlayOpened?(): void;
}

/**
 * Controlador imperativo de MapLibre. Recibe el estado de la app (Zustand) y
 * sincroniza fuentes/capas de forma incremental. Un solo motor para 2D y 3D.
 */
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
  clPicking = false;
  listPop: maplibregl.Popup | null = null;
  extOverlay = false;

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
        compact: false,
        customAttribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      },
      canvasContextAttributes: { antialias: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    this.map.touchZoomRotate.disableRotation();
    // gancho para pruebas automáticas (solo con ?e2e en la URL)
    if (location.search.includes('e2e'))
      (window as unknown as { __crmap: maplibregl.Map }).__crmap = this.map;
    this.map.setPadding(this.panelPadding());
    // encuadre inicial: el padding del panel ya está aplicado, aquí solo el margen
    if (!view)
      this.map.fitBounds(CR_BOUNDS as maplibregl.LngLatBoundsLike, {
        padding: isMobile() ? 12 : { top: 16, bottom: 16, left: 16, right: 64 },
        duration: 0,
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

    // imágenes de grupos dibujadas al vuelo (antes de que MapLibre las dé por faltantes)
    this.map.setMissingStyleImageResolver((id) => {
      if (id.startsWith('cl:') && !this.map.hasImage(id)) drawCluster(this.map, id);
      else if (id.startsWith('pin-') && id.endsWith('-fav')) addFavPin(this.map, id);
    });
    // una tesela que falta en el proveedor (p. ej. un hueco del satélite) no es un error de la app
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
      if (state.is3d) set3d(this, true, false);
    });
    this.map.on('moveend', () => {
      pruneClusterImages(this.map);
      this.ev.moved();
    });
    this.map.on('move', () => placeLabel(this));
    this.map.on('resize', () => placeLabel(this));
    this.map.on('click', (e) => onClick(this, e));
    attachLimitHint(this.map, container, () => this.s.lang);
    // hover: como mucho una consulta por cuadro y ninguna mientras se arrastra el mapa
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

  /* ------------------------------------------------------------ estilo */
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

  /* --------------------------------------------------- sincronización */
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
    if (s.routeData !== p.routeData || s.route !== p.route || s.lang !== p.lang) syncRoute(this);
    if (s.measure !== p.measure || s.measurePts !== p.measurePts) syncMeasure(this);
    if (s.me !== p.me) syncMe(this);
    if (s.lang !== p.lang && this.meMarker)
      this.meMarker.getElement().title = translate(s.lang, 'you_are_here');
    if (s.is3d !== p.is3d) set3d(this, s.is3d, true);
    if (s.panelOpen !== p.panelOpen) this.panelToggled();
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

  /** Vuelve a pintar lugares (p. ej. cuando llegan los trazados diferidos) */
  refreshPlaces() {
    if (this.ready) syncPlaces(this);
  }

  /* -------------------------------------------------------- relleno */
  private panelPadding() {
    if (isMobile()) {
      const peek = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek')) || 150;
      return { top: 56, bottom: peek, left: 0, right: 0 };
    }
    return { top: 0, bottom: 0, left: this.s.panelOpen ? PANEL_W : 0, right: 0 };
  }
  /**
   * El panel tapa el mapa, no lo empuja. El relleno cambia en el mismo instante
   * y un punto de la esquina se queda en su píxel. Anclar el centro no sirve:
   * MapLibre no mueve la cámara si el ancla es el centro del relleno.
   */
  private panelToggled() {
    if (isMobile()) return this.applyPadding(true);
    const m = this.map;
    m.stop();
    const pad = this.panelPadding();
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
  applyPadding(animate: boolean) {
    this.map.easeTo({ padding: this.panelPadding(), duration: animate ? 340 : 0 });
  }

  /* ------------------------------------------------------- MapApi */
  /**
   * Vuelo a un lugar: zum objetivo según el tipo (un estadio o una iglesia se ven de cerca, una playa
   * un poco más lejos, un parque o un río por su contorno). El relleno descuenta el panel lateral o la
   * hoja inferior visible, así el lugar queda en el centro de lo que realmente se ve.
   * Si ya se está más cerca que el objetivo, solo se desplaza. Arrastrar el mapa interrumpe el vuelo.
   */
  focusPlace(p: Place, opts: { fromMap?: boolean } = {}) {
    const m = this.map;
    m.stop();
    const pad = this.visiblePadding();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cur = m.getZoom();
    const maxZ = m.getMaxZoom();
    if (p.geometry) {
      const b = boundsOf(positions(p.geometry));
      if (b) {
        const cam = m.cameraForBounds(b as maplibregl.LngLatBoundsLike, { padding: pad, maxZoom: 15.5 });
        if (cam?.center) return this.flyCam(cam.center as LngLatLike, cam.zoom ?? cur, pad, reduce, false);
      }
    }
    let z = areaZoom(p) ?? targetZoom(p);
    if (opts.fromMap) z = Math.min(z, Math.max(cur + 4, 14)); // desde el mapa: un salto más corto
    z = Math.min(z, maxZ - 0.5);
    this.flyCam([p.lng, p.lat], z, pad, reduce, true);
  }
  /**
   * Transición proporcional a la distancia:
   *  - cerca (el destino cabe en ~1,5 pantallas al zum actual): easeTo directo, sin alejarse (0,7–1,1 s);
   *  - lejos: vuelo en arco; se aleja solo lo necesario para ver origen y destino (minZoom) y vuelve a
   *    acercarse; la duración crece con la distancia (1,4–3,5 s). En medio, el arco es apenas una leve bajada.
   */
  private flyCam(
    center: LngLatLike,
    zoom: number,
    padding: maplibregl.PaddingOptions,
    reduce: boolean,
    keepCloser: boolean,
  ) {
    const m = this.map;
    m.stop();
    const cur = m.getZoom();
    const c = m.getContainer();
    const W = Math.max(1, c.clientWidth - (padding.left ?? 0) - (padding.right ?? 0));
    const to = m.project(center);
    const from = m.project(m.getCenter());
    const px = Math.hypot(to.x - from.x, to.y - from.y);
    const screens = px / W;
    // ya está más cerca y el lugar está a la vista: no alejar, solo desplazar
    if (keepCloser && cur >= zoom && screens < 0.6) zoom = cur;
    if (reduce) return void m.easeTo({ center, zoom, padding, duration: 250 });
    const dz = Math.abs(zoom - cur);
    if (screens < 1.5 && dz <= 3) {
      const duration = Math.round(Math.min(1100, 700 + screens * 180 + Math.abs(zoom - cur) * 40));
      return void m.easeTo({ center, zoom, padding, duration, easing: easeInOutCubic });
    }
    // zum que encuadra los dos puntos con el relleno, menos medio nivel de aire
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
    // distancias medias (1,5–4 pantallas): bajada suave, interpolada
    const k = Math.min(1, (screens - 1.5) / 2.5);
    minZoom = Math.min(cur, zoom) - (Math.min(cur, zoom) - minZoom) * k;
    const km = a.distanceTo(b) / 1000;
    const duration = Math.round(
      Math.min(3500, Math.max(1400, 1100 + Math.log2(1 + km) * 330, 900 + dz * 160)),
    );
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
  /** relleno = zona tapada por el panel (escritorio) o por la hoja inferior visible (móvil) */
  private visiblePadding(): maplibregl.PaddingOptions {
    const c = this.map.getContainer();
    const h = c.clientHeight;
    if (isMobile()) {
      const sheet = document.querySelector('.panel') as HTMLElement | null;
      const top = sheet?.getBoundingClientRect().top ?? h * 0.5;
      const bottom = Math.min(h * 0.62, Math.max(0, c.getBoundingClientRect().bottom - top)) + 24;
      return { top: 70, bottom, left: 24, right: 24 };
    }
    return { top: 60, bottom: 50, left: (this.s.panelOpen ? PANEL_W : 0) + 50, right: 80 };
  }
  fitBounds(b: Bounds, opts: { maxZoom?: number } = {}) {
    const mob = isMobile();
    const pad = mob
      ? { top: 20, left: 20, right: 20, bottom: Math.round(window.innerHeight * 0.45) - 100 }
      : { top: 30, left: 30, right: 70, bottom: 30 };
    this.map.fitBounds(b, { padding: pad, duration: 700, maxZoom: opts.maxZoom ?? 11 });
  }
  flyTo(lat: number, lng: number, zoom: number) {
    this.flyCam(
      [lng, lat],
      zoom,
      this.visiblePadding(),
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
  /** Hay una tarjeta externa abierta (popup de provincia): sin tooltips y sin rótulo del seleccionado encima */
  setOverlay(on: boolean) {
    this.extOverlay = on;
    if (on) this.tip.remove();
    if (!this.listPop) this.selMarker?.getElement().classList.toggle('menu-hide', on);
  }
  /** Cierra los popups flotantes del mapa (lista de un grupo, tooltip) */
  closePopups() {
    this.listPop?.remove();
    this.listPop = null;
    this.tip.remove();
  }

  destroy() {
    this.map.remove();
  }
}
