import { beforeAll, describe, expect, it } from 'vitest';
import {
  NEAR_CAP,
  NEAR_EXPAND_IF_BELOW,
  NEAR_RADIUS_EXPAND_KM,
  NEAR_RADIUS_KM,
  diversifyNearby,
  limitNearby,
  nearbyAround,
  nearbyTop,
} from '../src/lib/nearby';
import { haversine, ll } from '../src/lib/geo';
import { useData } from '../src/data/load';
import { nearbyOf } from '../src/store/selection';
import type { CategoryId, Place } from '../src/data/types';
import { atPlusKm, loadAtlas, place } from './fixtures';

const O: [number, number] = [10, -84];
const at = (id: string, km: number, cat?: CategoryId) => {
  const [lat, lng] = atPlusKm(O, km);
  return place(id, lat, lng, cat);
};

describe('constants', () => {
  it('keep the documented radius, expansion and cap', () => {
    expect(NEAR_RADIUS_KM).toBe(25);
    expect(NEAR_RADIUS_EXPAND_KM).toBe(50);
    expect(NEAR_EXPAND_IF_BELOW).toBe(8);
    expect(NEAR_CAP).toBe(30);
  });
});

describe('nearbyAround', () => {
  it('keeps only places within the base radius when there are enough', () => {
    const inside = Array.from({ length: 10 }, (_, i) => at('in' + i, 2 + i * 2));
    const outside = [at('mid', 40), at('far', 80)];
    const { list, dists } = nearbyAround(O, [...outside, ...inside]);
    expect(list.map((p) => p.id)).toEqual(inside.map((p) => p.id));
    expect(list.every((p) => dists.get(p.id)! <= NEAR_RADIUS_KM)).toBe(true);
  });

  it('expands to the wider radius when fewer than the threshold are close', () => {
    const places = [at('a', 3), at('b', 10), at('c', 30), at('d', 49), at('e', 51), at('f', 120)];
    const ids = nearbyAround(O, places).list.map((p) => p.id);
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('caps the list and sorts it by distance', () => {
    const places = Array.from({ length: 45 }, (_, i) => at('p' + i, 20 - i * 0.4));
    const { list, dists } = nearbyAround(O, places);
    expect(list).toHaveLength(NEAR_CAP);
    const ds = list.map((p) => dists.get(p.id)!);
    expect(ds).toEqual([...ds].sort((x, y) => x - y));
  });

  it('excludes the origin place', () => {
    const places = [at('self', 0), at('a', 1)];
    expect(nearbyAround(O, places, 'self').list.map((p) => p.id)).toEqual(['a']);
  });

  it('limitNearby does not mutate its input', () => {
    const places = [at('b', 5), at('a', 1)];
    const dists = new Map(places.map((p) => [p.id, haversine(O, ll(p))]));
    limitNearby(places, dists);
    expect(places.map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('diversifyNearby', () => {
  const list: Place[] = [
    at('v1', 1, 'volcanes'),
    at('v2', 2, 'volcanes'),
    at('p1', 3, 'playas'),
    at('v3', 4, 'volcanes'),
    at('r1', 5, 'rios'),
  ];

  it('picks one per category first, then fills by distance', () => {
    expect(diversifyNearby(list, 4).map((p) => p.id)).toEqual(['v1', 'p1', 'r1', 'v2']);
  });

  it('never returns more than asked or duplicates', () => {
    const out = diversifyNearby(list, 10);
    expect(out).toHaveLength(list.length);
    expect(new Set(out).size).toBe(list.length);
    expect(diversifyNearby(list, 2).map((p) => p.id)).toEqual(['v1', 'p1']);
  });

  it('nearbyTop returns [place, km] pairs and respects diversify', () => {
    const plain = nearbyTop(O, list, 3).map(([p]) => p.id);
    const mixed = nearbyTop(O, list, 3, { diversify: true }).map(([p]) => p.id);
    expect(plain).toEqual(['v1', 'v2', 'p1']);
    expect(mixed).toEqual(['v1', 'p1', 'r1']);
    const [[, km]] = nearbyTop(O, list, 1);
    expect(km).toBeCloseTo(1, 3);
  });
});

describe('nearbyOf with the real atlas', () => {
  beforeAll(() => {
    useData.setState({ data: loadAtlas(), error: null });
  });

  it('returns the n closest places, without the place itself, in order', () => {
    const near = nearbyOf('wd-volcan-tortuguero', 6);
    expect(near).toHaveLength(6);
    expect(near.some(([p]) => p.id === 'wd-volcan-tortuguero')).toBe(false);
    const ds = near.map(([, km]) => km);
    expect(ds).toEqual([...ds].sort((a, b) => a - b));
  });

  it('diversify spreads categories', () => {
    const plain = new Set(nearbyOf('ciu-san-jose', 6).map(([p]) => p.cat));
    const mixed = new Set(nearbyOf('ciu-san-jose', 6, { diversify: true }).map(([p]) => p.cat));
    expect(mixed.size).toBeGreaterThanOrEqual(plain.size);
    expect(mixed.size).toBeGreaterThan(1);
  });

  it('caches by id, n and diversify', () => {
    expect(nearbyOf('ciu-san-jose', 6)).toBe(nearbyOf('ciu-san-jose', 6));
    expect(nearbyOf('ciu-san-jose', 6)).not.toBe(nearbyOf('ciu-san-jose', 5));
  });

  it('returns an empty list for unknown ids', () => {
    expect(nearbyOf('no-such-place')).toEqual([]);
  });
});
