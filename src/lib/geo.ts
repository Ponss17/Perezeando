import type { LatLng } from '../data/types';

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const r = Math.PI / 180;
  const dLa = (b[0] - a[0]) * r;
  const dLo = (b[1] - a[1]) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const ll = (p: { lat: number; lng: number }): LatLng => [p.lat, p.lng];

export type Bounds = [[number, number], [number, number]];

export function boundsOf(coords: Iterable<number[]>): Bounds | null {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const c of coords) {
    if (c[0] < w) w = c[0];
    if (c[0] > e) e = c[0];
    if (c[1] < s) s = c[1];
    if (c[1] > n) n = c[1];
  }
  return Number.isFinite(w)
    ? [
        [w, s],
        [e, n],
      ]
    : null;
}

export function* positions(g: GeoJSON.Geometry): Generator<number[]> {
  switch (g.type) {
    case 'Point':
      yield g.coordinates;
      break;
    case 'LineString':
    case 'MultiPoint':
      yield* g.coordinates;
      break;
    case 'Polygon':
    case 'MultiLineString':
      for (const r of g.coordinates) yield* r;
      break;
    case 'MultiPolygon':
      for (const p of g.coordinates) for (const r of p) yield* r;
      break;
    case 'GeometryCollection':
      for (const x of g.geometries) yield* positions(x);
      break;
  }
}

export function circlePolygon(center: LatLng, radiusM: number, steps = 64): GeoJSON.Polygon {
  const [lat, lng] = center;
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}
