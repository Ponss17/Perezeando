import { describe, expect, it } from 'vitest';
import { boundsOf, circlePolygon, haversine, ll } from '../src/lib/geo';

const KM_PER_DEG = (6371 * Math.PI) / 180;

describe('haversine', () => {
  it('is zero for the same point', () => {
    expect(haversine([9.93, -84.08], [9.93, -84.08])).toBe(0);
  });

  it('measures one degree of latitude on the 6371 km sphere', () => {
    expect(haversine([0, 0], [1, 0])).toBeCloseTo(KM_PER_DEG, 6);
    expect(haversine([10, -84], [11, -84])).toBeCloseTo(KM_PER_DEG, 6);
  });

  it('shrinks longitude degrees with latitude', () => {
    expect(haversine([0, 0], [0, 1])).toBeCloseTo(KM_PER_DEG, 6);
    expect(haversine([60, 0], [60, 1])).toBeCloseTo(KM_PER_DEG / 2, 1);
  });

  it('is symmetric', () => {
    const a: [number, number] = [9.9281, -84.0907];
    const b: [number, number] = [10.6346, -85.4377];
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 9);
  });

  it('gives a realistic San José to Liberia distance', () => {
    const km = haversine([9.9281, -84.0907], [10.6346, -85.4377]);
    expect(km).toBeGreaterThan(160);
    expect(km).toBeLessThan(175);
  });

  it('reads lat/lng objects in [lat, lng] order', () => {
    expect(ll({ lat: 9.5, lng: -84 })).toEqual([9.5, -84]);
  });
});

describe('geometry helpers', () => {
  it('computes bounds as [[w, s], [e, n]]', () => {
    expect(
      boundsOf([
        [-85, 10],
        [-83, 9],
        [-84, 11],
      ]),
    ).toEqual([
      [-85, 9],
      [-83, 11],
    ]);
    expect(boundsOf([])).toBeNull();
  });

  it('builds a closed circle whose points sit near the radius', () => {
    const c: [number, number] = [9.9, -84.1];
    const poly = circlePolygon(c, 5000, 32);
    const ring = poly.coordinates[0];
    expect(ring).toHaveLength(33);
    expect(ring[0][0]).toBeCloseTo(ring[32][0], 9);
    expect(ring[0][1]).toBeCloseTo(ring[32][1], 9);
    for (const [lng, lat] of ring) expect(haversine(c, [lat, lng])).toBeCloseTo(5, 1);
  });
});
