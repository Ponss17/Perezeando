import type { Place } from '../data/types';
import type { Bounds } from './geo';

/** API imperativa que expone el mapa (MapLibre) al resto de la app. */
export interface MapApi {
  focusPlace(p: Place, opts?: { fromMap?: boolean }): void;
  fitBounds(b: Bounds, opts?: { maxZoom?: number }): void;
  flyTo(lat: number, lng: number, zoom: number): void;
  getView(): [number, number, number];
  snapshot(): Promise<string | null>;
}

let api: MapApi | null = null;
let pending: ((a: MapApi) => void)[] = [];
const moveListeners = new Set<() => void>();

export function registerMap(a: MapApi | null) {
  api = a;
  if (a) {
    const q = pending;
    pending = [];
    q.forEach((fn) => fn(a));
  }
}

/** Ejecuta ahora o cuando el mapa esté listo */
export function withMap(fn: (a: MapApi) => void) {
  if (api) fn(api);
  else pending.push(fn);
}

export const getMap = () => api;
export const onMapMove = (fn: () => void) => {
  moveListeners.add(fn);
  return () => moveListeners.delete(fn);
};
export const emitMapMove = () => moveListeners.forEach((f) => f());
