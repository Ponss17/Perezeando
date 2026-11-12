import { describe, expect, it } from 'vitest';
import { dishKey } from '../scripts/shared.mjs';
import { placeFromSlug, placeSlug, provFromSlug, provSlug } from '../src/lib/slugs';
import type { AtlasData } from '../src/data/load';
import { loadAtlas, place } from './fixtures';

describe('dishKey', () => {
  it('lowercases and strips accents', () => {
    expect(dishKey('Olla de Carne')).toBe('olla de carne');
    expect(dishKey('Patacón')).toBe('patacon');
    expect(dishKey('Ñame')).toBe('name');
  });

  it('drops parentheses and punctuation and collapses spaces', () => {
    expect(dishKey('Arroz con leche (postre)')).toBe('arroz con leche');
    expect(dishKey('  Rice-and-beans,  caribeño ')).toBe('rice and beans caribeno');
    expect(dishKey('Gallo pinto (desayuno) típico')).toBe('gallo pinto tipico');
  });

  it('reads the Spanish name of localized objects and tolerates empty input', () => {
    expect(dishKey({ es: 'Chifrijo', en: 'Chifrijo bowl' })).toBe('chifrijo');
    expect(dishKey(undefined)).toBe('');
    expect(dishKey('')).toBe('');
  });

  it('gives the same key to spelling variants', () => {
    expect(dishKey('Tamal  Asado')).toBe(dishKey('tamal asado'));
    expect(dishKey('Casado (almuerzo)')).toBe(dishKey('casado'));
  });
});

describe('place slugs', () => {
  const d = loadAtlas();

  it('round-trips every place in the atlas', () => {
    for (const p of d.places) expect(placeFromSlug(d, placeSlug(d, p.id))).toBe(p.id);
  });

  it('uses short slugs when the suffix is unique', () => {
    expect(placeSlug(d, 'wd-refugio-de-vida-silvestre-archie-carr')).toBe(
      'refugio-de-vida-silvestre-archie-carr',
    );
    expect(placeFromSlug(d, 'refugio-de-vida-silvestre-archie-carr')).toBe(
      'wd-refugio-de-vida-silvestre-archie-carr',
    );
  });

  it('accepts full ids, case, spaces and URL encoding', () => {
    expect(placeFromSlug(d, 'ciu-san-jose')).toBe('ciu-san-jose');
    expect(placeFromSlug(d, ' CIU-SAN-JOSE ')).toBe('ciu-san-jose');
    expect(placeFromSlug(d, encodeURIComponent('ciu-san-jose'))).toBe('ciu-san-jose');
    expect(placeFromSlug(d, '')).toBeNull();
    expect(placeFromSlug(d, 'no-such-place')).toBeNull();
  });

  it('keeps the full id when two places share a suffix', () => {
    const places = [place('wd-poas', 10, -84), place('par-poas', 10.1, -84), place('ciu-solo', 9, -84)];
    const mini: AtlasData = { ...d, places, byId: new Map(places.map((p) => [p.id, p])) };
    expect(placeSlug(mini, 'wd-poas')).toBe('wd-poas');
    expect(placeSlug(mini, 'par-poas')).toBe('par-poas');
    expect(placeSlug(mini, 'ciu-solo')).toBe('solo');
    expect(placeFromSlug(mini, 'poas')).toBeNull();
  });
});

describe('province slugs', () => {
  const d = loadAtlas();

  it('maps San José to a readable slug and back', () => {
    expect(provSlug('sanjose')).toBe('san-jose');
    expect(provSlug('limon')).toBe('limon');
    expect(provFromSlug(d, 'san-jose')).toBe('sanjose');
    expect(provFromSlug(d, 'San José')).toBe('sanjose');
    expect(provFromSlug(d, 'LIMÓN')).toBe('limon');
  });

  it('handles the sea and unknown names', () => {
    expect(provFromSlug(d, 'mar')).toBe('mar');
    expect(provFromSlug(d, 'atlantis')).toBeNull();
  });
});
