import type Fuse from 'fuse.js';
import type { Place } from '../../data/types';
import { CATEGORIES } from '../../data/config';
import { norm } from '../../lib/format';
import type { AtlasData } from '../../data/load';

interface Doc {
  id: string;
  n1: string;
  n2: string;
  d1: string;
  d2: string;
  c: string;
  pv: string;
  k: string;
}

let fuse: Fuse<Doc> | null = null;
let src: AtlasData | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function subscribeSearch(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function plain(d: AtlasData, q: string): Place[] {
  const n = norm(q);
  const out: Place[] = [];
  for (const p of d.places) {
    const hay = norm(
      `${p.name.es} ${p.name.en} ${p.nick?.nickname ?? ''} ${p.nick?.popularNickname ?? ''} ${p.nick?.demonym ?? ''} ${p.nick?.popularDemonym ?? ''} ${CATEGORIES[p.cat].name.es} ${CATEGORIES[p.cat].name.en}`,
    );
    if (!hay.includes(n)) continue;
    out.push(p);
    if (out.length === 80) break;
  }
  return out;
}

function ensure(d: AtlasData) {
  if (fuse && src === d) return;
  if (loading) return;
  loading = import('fuse.js').then(({ default: FuseImpl }) => {
    src = d;
    fuse = new FuseImpl(
      d.places.map((p) => ({
        id: p.id,
        n1: norm(p.name.es),
        n2: norm(p.name.en),
        d1: norm(p.desc.es),
        d2: norm(p.desc.en),
        c: norm(CATEGORIES[p.cat].name.es + ' ' + CATEGORIES[p.cat].name.en),
        k: norm(
          [p.nick?.nickname, p.nick?.popularNickname, p.nick?.demonym, p.nick?.popularDemonym]
            .filter(Boolean)
            .join(' '),
        ),
        pv: norm(p.prov === 'mar' ? 'mar territorial territorial sea' : (d.provById.get(p.prov)?.name ?? '')),
      })),
      {
        keys: [
          { name: 'n1', weight: 0.45 },
          { name: 'n2', weight: 0.25 },
          { name: 'k', weight: 0.3 },
          { name: 'c', weight: 0.12 },
          { name: 'pv', weight: 0.06 },
          { name: 'd1', weight: 0.07 },
          { name: 'd2', weight: 0.05 },
        ],
        threshold: 0.36,
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 2,
      },
    );
    loading = null;
    for (const fn of listeners) fn();
  });
}

export function searchPlaces(d: AtlasData, q: string): Place[] {
  if (fuse && src === d) {
    return fuse
      .search(norm(q))
      .map((r) => d.byId.get(r.item.id)!)
      .filter(Boolean);
  }
  ensure(d);
  return plain(d, q);
}

/** Empieza a bajar Fuse cuando el usuario va a buscar, no en el primer pintado. */
export function warmSearch(d: AtlasData) {
  ensure(d);
}
