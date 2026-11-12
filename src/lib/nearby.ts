import type { Place } from '../data/types';
import { haversine, ll } from './geo';
import nearConst from './near-const.json' with { type: 'json' };

const { NEAR_RADIUS_KM, NEAR_RADIUS_EXPAND_KM, NEAR_EXPAND_IF_BELOW, NEAR_CAP, NEAR_PREVIEW } = nearConst;

export { NEAR_PREVIEW, NEAR_RADIUS_KM, NEAR_RADIUS_EXPAND_KM, NEAR_EXPAND_IF_BELOW, NEAR_CAP };

export function nearbyByDistance(origin: [number, number], places: Place[], excludeId?: string) {
  const list = excludeId ? places.filter((p) => p.id !== excludeId) : places.slice();
  const dists = new Map(list.map((p) => [p.id, haversine(origin, ll(p))]));
  list.sort((a, b) => dists.get(a.id)! - dists.get(b.id)!);
  return { list, dists };
}

export function limitNearby(list: Place[], dists: Map<string, number>): Place[] {
  const sorted = list.slice().sort((a, b) => dists.get(a.id)! - dists.get(b.id)!);
  const within = (km: number) => sorted.filter((p) => dists.get(p.id)! <= km);
  let cut = within(NEAR_RADIUS_KM);
  if (cut.length < NEAR_EXPAND_IF_BELOW) cut = within(NEAR_RADIUS_EXPAND_KM);
  return cut.slice(0, NEAR_CAP);
}

export function nearbyAround(origin: [number, number], places: Place[], excludeId?: string) {
  const { list, dists } = nearbyByDistance(origin, places, excludeId);
  return { list: limitNearby(list, dists), dists };
}

export function diversifyNearby(list: Place[], n: number): Place[] {
  const picked: Place[] = [];
  const seen = new Set<string>();
  for (const q of list) {
    if (picked.length >= n) break;
    if (seen.has(q.cat)) continue;
    picked.push(q);
    seen.add(q.cat);
  }
  for (const q of list) {
    if (picked.length >= n) break;
    if (!picked.includes(q)) picked.push(q);
  }
  return picked;
}

export function nearbyTop(
  origin: [number, number],
  places: Place[],
  n: number,
  opts: { diversify?: boolean } = {},
  excludeId?: string,
): readonly (readonly [Place, number])[] {
  const { list, dists } = nearbyByDistance(origin, places, excludeId);
  const want = Math.max(n * 8, 40);
  const pool = list.slice(0, want);
  const picked = opts.diversify ? diversifyNearby(pool, n) : pool.slice(0, n);
  return picked.map((q) => [q, dists.get(q.id)!] as const);
}
