import { useEffect } from 'react';
import { getApp, setApp, useApp, type AppState } from '../store/useApp';
import { getData, type AtlasData } from '../data/load';
import { BASEMAPS, CATEGORIES } from '../data/config';
import type { BasemapId, CategoryId, ProvinceFilter } from '../data/types';
import { getMap, onMapMove } from '../lib/mapBus';
import { placeFromSlug, placeSlug, provFromSlug, provSlug } from '../lib/slugs';
import { deselect, select } from '../store/actions';

/*
 * URL limpia:
 *   /#volcan-arenal                       → lugar abierto (lo único que va en la URL al usar la app)
 *   /?ruta=volcan-arenal,monteverde       → enlace compartido con una ruta
 *   /?provincia=cartago#volcan-irazu      → enlace compartido con filtro de provincia
 * Capas, mapa base, vista, idioma, etc. se guardan en localStorage, no en la URL.
 * Los hashes viejos (#p=…&l=…&v=…) se siguen leyendo y se reescriben a la forma limpia.
 */

const VIEW_KEY = 'crmapa.view';
const SEEN_KEY = 'crmapa.seen';
/** parámetros propios de la app en la query (el resto, p. ej. ?e2e, se conserva) */
const OWN_PARAMS = ['ruta', 'provincia', 'lugar'];

export function isFirstVisit() {
  try {
    return localStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

const isLegacy = (hash: string) => hash.includes('=');

function legacy(hash: string, d: AtlasData | null): Partial<AppState> {
  const h = new URLSearchParams(hash.slice(1));
  const out: Partial<AppState> = {};
  const l = h.get('l');
  // "l=none" (todo oculto) se ignora: dejaba el mapa vacío para siempre
  if (l && l !== 'none') {
    const act = l.split(',').filter((c) => c in CATEGORIES) as CategoryId[];
    if (act.length) out.active = act;
  }
  const prov = h.get('prov');
  if (prov && (prov === 'mar' || d?.provById.has(prov as never))) out.prov = prov as ProvinceFilter;
  const cat = h.get('cat');
  if (cat && cat in CATEGORIES) out.cat = cat as CategoryId;
  const b = h.get('b');
  if (b && b in BASEMAPS) out.base = b as BasemapId;
  const r = h.get('r');
  if (r) out.route = r.split(',').filter((id) => !d || d.byId.has(id));
  const lang = h.get('lang');
  if (lang) out.lang = lang === 'en' ? 'en' : 'es';
  const ov = h.get('ov');
  if (ov) out.ov = { prov: ov[0] === '1', eez: ov[1] === '1', hill: ov[2] === '1', cluster: ov[3] !== '0' };
  const v = h.get('v')?.split(',').map(Number);
  if (v && v.length === 3 && v.every(Number.isFinite)) out.initialView = [v[0], v[1], v[2]];
  const p = h.get('p');
  if (p && d?.byId.has(p)) out.sel = { kind: 'place', id: p };
  return out;
}

/** URL actual (hash + query propia, o formato viejo) → cambios del estado */
export function readHash(): Partial<AppState> {
  const d = getData();
  const hash = location.hash;
  const out: Partial<AppState> = isLegacy(hash) ? legacy(hash, d) : {};
  if (d && hash.length > 1 && !isLegacy(hash)) {
    const id = placeFromSlug(d, hash.slice(1));
    if (id) out.sel = { kind: 'place', id };
  }
  const fromPath = d ? placeFromSlug(d, lugarSlug()) : null;
  if (fromPath) out.sel = { kind: 'place', id: fromPath };
  const q = new URLSearchParams(location.search);
  const ruta = q.get('ruta');
  if (d && ruta) {
    const ids = ruta
      .split(',')
      .map((s) => placeFromSlug(d, s))
      .filter((x): x is string => !!x);
    if (ids.length) out.route = [...new Set(ids)];
  }
  const provincia = q.get('provincia');
  if (d && provincia) {
    const p = provFromSlug(d, provincia);
    if (p) out.prov = p;
  }
  if (!out.initialView && !out.sel && !isFirstVisit()) {
    const v = loadView();
    if (v) out.initialView = v;
  }
  return out;
}

function loadView(): [number, number, number] | null {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
    return Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)
      ? (v as [number, number, number])
      : null;
  } catch {
    return null;
  }
}

/** query sin los parámetros propios (conserva ?e2e y similares) */
function keptSearch() {
  const q = new URLSearchParams(location.search);
  OWN_PARAMS.forEach((k) => q.delete(k));
  const s = q.toString().replace(/=(&|$)/g, '$1');
  return s ? '?' + s : '';
}

function lugarSlug() {
  return new URLSearchParams(location.search).get('lugar') ?? '';
}

function pageUrl(slug: string | null, shared: boolean) {
  const q = new URLSearchParams(keptSearch().slice(1));
  if (shared) {
    const s = getApp();
    const d = getData();
    if (d && s.route.length) q.set('ruta', s.route.map((id) => placeSlug(d, id)).join(','));
    if (s.prov !== 'all') q.set('provincia', provSlug(s.prov));
  }
  if (slug) q.set('lugar', slug);
  const qs = q.toString();
  return location.pathname + (qs ? '?' + qs : '');
}

function write(mode: 'push' | 'replace') {
  const d = getData();
  const s = getApp();
  const slug = s.sel?.kind === 'place' && d ? placeSlug(d, s.sel.id) : null;
  const url = pageUrl(slug, false);
  if (url === location.pathname + location.search) return;
  try {
    if (mode === 'push') history.pushState({ crPlace: 1 }, '', url);
    else history.replaceState(history.state, '', url);
  } catch {
    /* file:// en algunos navegadores */
  }
}

/** Enlace para compartir: ?lugar=slug, en la misma página, para que lleve título y foto */
export function shareUrl(placeId?: string | null): string {
  const d = getData();
  const sel = getApp().sel;
  const id = placeId ?? (sel?.kind === 'place' ? sel.id : null);
  const slug = id && d ? placeSlug(d, id) : null;
  return location.origin + pageUrl(slug, true);
}

/** Mantiene la URL limpia en sincronía con el lugar abierto */
export function useHashSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    // reescribir enlaces viejos / compartidos a la forma limpia (sin entrada nueva en el historial)
    write('replace');

    let fromHistory = false;
    const unsub = useApp.subscribe((s, prev) => {
      if (s.sel === prev.sel || fromHistory) return;
      const was = prev.sel?.kind === 'place';
      const is = s.sel?.kind === 'place';
      if (is && !was)
        write('push'); // abrir un lugar → "atrás" lo cierra
      else if (!is && was && history.state?.crPlace) {
        // cerrar con la X: volver a la entrada anterior (sin lugar)
        fromHistory = true;
        history.back();
        setTimeout(() => (fromHistory = false), 0);
      } else write('replace');
    });

    // vista del mapa: solo en localStorage
    let vt: ReturnType<typeof setTimeout> | undefined;
    const off = onMapMove(() => {
      clearTimeout(vt);
      vt = setTimeout(() => {
        const v = getMap()?.getView();
        if (v)
          localStorage.setItem(
            VIEW_KEY,
            JSON.stringify([+v[0].toFixed(4), +v[1].toFixed(4), +v[2].toFixed(2)]),
          );
      }, 400);
    });

    // atrás/adelante o hash editado a mano
    const onNav = () => {
      const d = getData();
      if (!d) return;
      const h = location.hash;
      if (isLegacy(h)) {
        const patch = legacy(h, d);
        const sel = patch.sel;
        delete patch.sel;
        const v = patch.initialView;
        delete patch.initialView;
        setApp(patch);
        if (sel?.kind === 'place') select(sel.id, { noFly: !!v });
        if (v) getMap()?.flyTo(v[0], v[1], v[2]);
        write('replace');
        return;
      }
      const id =
        (h.length > 1 && !isLegacy(h) ? placeFromSlug(d, h.slice(1)) : null) || placeFromSlug(d, lugarSlug());
      const cur = getApp().sel;
      fromHistory = true;
      if (id && !(cur?.kind === 'place' && cur.id === id)) select(id);
      else if (!id && cur?.kind === 'place') deselect();
      fromHistory = false;
    };
    window.addEventListener('popstate', onNav);
    window.addEventListener('hashchange', onNav);
    return () => {
      unsub();
      off();
      clearTimeout(vt);
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
    };
  }, [enabled]);
}
