import { beforeAll, describe, expect, it } from 'vitest';
import { searchPlaces, subscribeSearch, warmSearch } from '../src/features/search/searchIndex';
import { loadAtlas } from './fixtures';

const d = loadAtlas();
const ids = (q: string) => searchPlaces(d, q).map((p) => p.id);

describe('search before Fuse loads (plain fallback)', () => {
  it('finds San José by the nickname Chepe, case and accent insensitive', () => {
    const hit = ids('CHEPE');
    expect(hit).toContain('ciu-san-jose');
    expect(hit).toContain('wd-canton-de-san-jose');
  });
});

describe('fuzzy search with nicknames and gentilicios', () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      const off = subscribeSearch(() => {
        off();
        resolve();
      });
      warmSearch(d);
    });
  });

  it('puts San José in the top two for Chepe', () => {
    expect(ids('Chepe').slice(0, 2)).toContain('ciu-san-jose');
  });

  it('matches the popular nickname Moncho from "monchos"', () => {
    expect(ids('monchos').slice(0, 3)).toContain('wd-canton-de-san-ramon');
  });

  it('matches gentilicios', () => {
    expect(ids('josefino').slice(0, 3)).toContain('ciu-san-jose');
    expect(ids('ramonense').slice(0, 3)).toContain('wd-canton-de-san-ramon');
  });

  it('ignores accents in names', () => {
    const plainHit = ids('volcan arenal')[0];
    expect(plainHit).toMatch(/arenal/);
    expect(plainHit).toBe(ids('Volcán Arenal')[0]);
  });

  it('returns nothing useful for gibberish', () => {
    expect(ids('zzqxv')).toHaveLength(0);
  });
});
