import type { Lang, Place, RouteResult } from '../../data/types';
import { ENDPOINTS } from '../../data/config';
import { haversine, ll } from '../../lib/geo';
import { escXml } from '../../lib/download';
import { pick } from '../../i18n';

export const routeKey = (ids: string[]) => ids.join(',');

/** Calcula la ruta en carro con OSRM; si falla, estima en línea recta (×1,3 a 50 km/h). */
export async function computeRoute(stops: Place[], signal?: AbortSignal): Promise<RouteResult> {
  const key = routeKey(stops.map((p) => p.id));
  try {
    const coords = stops.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 12000);
    signal?.addEventListener('abort', () => ctl.abort());
    let j: {
      code: string;
      routes?: {
        distance: number;
        duration: number;
        legs: { distance: number; duration: number }[];
        geometry: { coordinates: [number, number][] };
      }[];
      waypoints?: { distance: number }[];
    };
    try {
      const r = await fetch(`${ENDPOINTS.osrm}${coords}?overview=full&geometries=geojson&steps=false`, {
        signal: ctl.signal,
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      j = await r.json();
    } finally {
      clearTimeout(to);
    }
    const rt = j.routes?.[0];
    if (j.code !== 'Ok' || !rt) throw new Error(j.code);
    return {
      key,
      mode: 'osrm',
      distance: rt.distance / 1000,
      duration: rt.duration,
      legs: rt.legs.map((l) => ({ d: l.distance / 1000, t: l.duration })),
      line: rt.geometry.coordinates,
      offroad: (j.waypoints || []).map((w) => w.distance > 3000),
    };
  } catch (e) {
    if (signal?.aborted) throw e;
    const legs = [];
    for (let i = 1; i < stops.length; i++) {
      const d = haversine(ll(stops[i - 1]), ll(stops[i]));
      legs.push({ d, t: ((d * 1.3) / 50) * 3600 });
    }
    return {
      key,
      mode: 'fallback',
      distance: legs.reduce((a, l) => a + l.d, 0),
      duration: legs.reduce((a, l) => a + l.t, 0),
      legs,
      line: stops.map((p) => [p.lng, p.lat]),
      offroad: [],
    };
  }
}

/** Vecino más cercano + mejora 2-opt, manteniendo fija la primera parada */
export function optimizeOrder(pts: Place[]): Place[] {
  if (pts.length < 3) return pts;
  const rest = pts.slice(1);
  const order = [pts[0]];
  while (rest.length) {
    const last = order[order.length - 1];
    let bi = 0,
      bd = Infinity;
    rest.forEach((p, i) => {
      const d = haversine(ll(last), ll(p));
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    order.push(rest.splice(bi, 1)[0]);
  }
  const len = (o: Place[]) => o.reduce((a, p, i) => (i ? a + haversine(ll(o[i - 1]), ll(p)) : 0), 0);
  let improved = true,
    best = order,
    guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++)
      for (let k = i + 1; k < best.length; k++) {
        const c = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        if (len(c) + 1e-9 < len(best)) {
          best = c;
          improved = true;
        }
      }
  }
  return best;
}

export function gmapsRouteUrl(stops: Place[]) {
  const pts = stops.map((p) => `${p.lat},${p.lng}`);
  if (!pts.length) return '';
  if (pts.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${pts[0]}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${pts[0]}&destination=${pts[pts.length - 1]}${
    pts.length > 2 ? '&waypoints=' + encodeURIComponent(pts.slice(1, -1).join('|')) : ''
  }&travelmode=driving`;
}

export const directionsUrl = (p: Place) =>
  p.prov === 'mar'
    ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;

export function buildGpx(lang: Lang, stops: Place[], data: RouteResult | null) {
  const wpts = stops
    .map(
      (p, i) =>
        `  <wpt lat="${p.lat}" lon="${p.lng}"><name>${i + 1}. ${escXml(pick(lang, p.name))}</name><desc>${escXml(pick(lang, p.desc))}</desc></wpt>`,
    )
    .join('\n');
  const trk = data
    ? `  <trk><name>Ruta Costa Rica</name><trkseg>\n${data.line.map((c) => `    <trkpt lat="${c[1].toFixed(6)}" lon="${c[0].toFixed(6)}"/>`).join('\n')}\n  </trkseg></trk>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Mapa interactivo de Costa Rica" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n${trk}\n</gpx>\n`;
}
