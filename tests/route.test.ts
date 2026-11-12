import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildGpx, gmapsRouteUrl, optimizeOrder, routeKey } from '../src/features/route/routing';
import { haversine, ll } from '../src/lib/geo';
import { useData } from '../src/data/load';
import { getApp, setApp } from '../src/store/useApp';
import { moveStop, optimizeRoute, setRoute, sleepInTown, toggleDayStart } from '../src/store/trip';
import type { Place } from '../src/data/types';
import { loadAtlas, place } from './fixtures';

const length = (o: Place[]) => o.reduce((a, p, i) => (i ? a + haversine(ll(o[i - 1]), ll(p)) : 0), 0);

describe('optimizeOrder', () => {
  const line = Array.from({ length: 7 }, (_, i) => place('s' + i, 10, -85 + i * 0.2));

  it('leaves routes with fewer than three stops alone', () => {
    const two = [line[3], line[0]];
    expect(optimizeOrder(two)).toBe(two);
  });

  it('keeps the first stop and visits every stop once', () => {
    const shuffled = [line[0], line[4], line[1], line[6], line[2], line[5], line[3]];
    const out = optimizeOrder(shuffled);
    expect(out[0]).toBe(line[0]);
    expect(out).toHaveLength(shuffled.length);
    expect(new Set(out.map((p) => p.id))).toEqual(new Set(shuffled.map((p) => p.id)));
  });

  it('finds the straight order along a line', () => {
    const shuffled = [line[0], line[4], line[1], line[6], line[2], line[5], line[3]];
    expect(optimizeOrder(shuffled).map((p) => p.id)).toEqual(line.map((p) => p.id));
  });

  it('never makes a route longer', () => {
    const pts = [
      place('a', 9.9, -84.1),
      place('b', 10.6, -85.4),
      place('c', 9.99, -83.03),
      place('d', 10.3, -84.8),
      place('e', 9.4, -84.2),
      place('f', 10.46, -84.7),
    ];
    expect(length(optimizeOrder(pts))).toBeLessThanOrEqual(length(pts) + 1e-9);
  });

  it('is deterministic', () => {
    const pts = [line[0], line[5], line[2], line[6], line[1]];
    expect(optimizeOrder(pts).map((p) => p.id)).toEqual(optimizeOrder(pts).map((p) => p.id));
  });
});

describe('route links and export', () => {
  const a = place('a', 9.9, -84.1);
  const b = place('b', 10, -84.2);
  const c = place('c', 10.1, -84.3);

  it('builds the key from ids', () => {
    expect(routeKey(['a', 'b'])).toBe('a,b');
  });

  it('builds Google Maps links with waypoints only in the middle', () => {
    expect(gmapsRouteUrl([])).toBe('');
    expect(gmapsRouteUrl([a])).toBe('https://www.google.com/maps/dir/?api=1&destination=9.9,-84.1');
    const url = gmapsRouteUrl([a, b, c]);
    expect(url).toContain('origin=9.9,-84.1');
    expect(url).toContain('destination=10.1,-84.3');
    expect(url).toContain('waypoints=' + encodeURIComponent('10,-84.2'));
  });

  it('writes numbered, escaped GPX waypoints', () => {
    const odd = { ...a, name: { es: 'Río & <Mar>', en: 'River' } };
    const gpx = buildGpx('es', [odd, b], null);
    expect(gpx).toContain('<name>1. Río &amp; &lt;Mar&gt;</name>');
    expect(gpx).toContain('<name>2. b</name>');
    expect(gpx).not.toContain('<trk>');
  });
});

describe('route store and day splitting', () => {
  const d = loadAtlas();
  const stops = ['ciu-san-jose', 'wd-canton-de-san-ramon', 'wd-volcan-tortuguero', 'ciu-tortuguero'];

  beforeAll(() => {
    useData.setState({ data: d, error: null });
  });

  beforeEach(() => {
    setApp({ route: [], dayStarts: [] });
  });

  it('drops unknown and repeated stops', () => {
    setRoute(['ciu-san-jose', 'nope', 'ciu-san-jose', 'ciu-tortuguero']);
    expect(getApp().route).toEqual(['ciu-san-jose', 'ciu-tortuguero']);
  });

  it('marks and unmarks a day start, but never on the first stop or outside the route', () => {
    setRoute(stops);
    toggleDayStart(stops[2]);
    expect(getApp().dayStarts).toEqual([stops[2]]);
    toggleDayStart(stops[0]);
    toggleDayStart('par-p-n-manuel-antonio');
    expect(getApp().dayStarts).toEqual([stops[2]]);
    toggleDayStart(stops[2]);
    expect(getApp().dayStarts).toEqual([]);
  });

  it('forgets a day start when its stop leaves the route or becomes the first stop', () => {
    setRoute(stops);
    toggleDayStart(stops[1]);
    toggleDayStart(stops[3]);
    setRoute(stops.filter((id) => id !== stops[3]));
    expect(getApp().dayStarts).toEqual([stops[1]]);
    moveStop(1, -1);
    expect(getApp().route[0]).toBe(stops[1]);
    expect(getApp().dayStarts).toEqual([]);
  });

  it('sleeping in a town inserts it after the stop and starts the next day after it', () => {
    setRoute([stops[0], stops[2], stops[3]]);
    sleepInTown('ciu-limon', stops[0]);
    expect(getApp().route).toEqual([stops[0], 'ciu-limon', stops[2], stops[3]]);
    expect(getApp().dayStarts).toEqual([stops[2]]);
    sleepInTown('ciu-limon', stops[2]);
    expect(getApp().route).toHaveLength(4);
  });

  it('optimizing keeps the start, the stops and the day starts that are still valid', () => {
    setRoute(stops);
    toggleDayStart(stops[2]);
    optimizeRoute();
    const r = getApp().route;
    expect(r[0]).toBe(stops[0]);
    expect(new Set(r)).toEqual(new Set(stops));
    expect(getApp().dayStarts).toEqual([stops[2]]);
  });
});
