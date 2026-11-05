import type { AtlasData } from '../data/load';
import type { ProvinceFilter, ProvinceId } from '../data/types';

/**
 * Slugs cortos y legibles para la URL.
 * Los ids internos llevan un prefijo de categoría ("vol-volcan-arenal");
 * en la URL se quita ("volcan-arenal") siempre que siga siendo único.
 * Si dos lugares chocan (p. ej. "isla-del-coco"), ambos conservan su id completo.
 */
let cache: { d: AtlasData; toSlug: Map<string, string>; toId: Map<string, string> } | null = null;

const strip = (id: string) => {
  const i = id.indexOf('-');
  return i > 0 ? id.slice(i + 1) : id;
};

function tables(d: AtlasData) {
  if (cache?.d === d) return cache;
  const count = new Map<string, number>();
  d.places.forEach((p) => count.set(strip(p.id), (count.get(strip(p.id)) ?? 0) + 1));
  const ids = new Set(d.places.map((p) => p.id));
  const toSlug = new Map<string, string>();
  const toId = new Map<string, string>();
  for (const p of d.places) {
    const s = strip(p.id);
    const slug = count.get(s) === 1 && !ids.has(s) ? s : p.id;
    toSlug.set(p.id, slug);
    toId.set(slug, p.id);
  }
  cache = { d, toSlug, toId };
  return cache;
}

export const placeSlug = (d: AtlasData, id: string) => tables(d).toSlug.get(id) ?? id;

/** slug corto o id completo (enlaces viejos) → id interno */
export function placeFromSlug(d: AtlasData, slug: string): string | null {
  const s = decodeURIComponent(slug).trim().toLowerCase();
  if (!s) return null;
  if (d.byId.has(s)) return s;
  return tables(d).toId.get(s) ?? null;
}

/* provincias: "san-jose" en la URL, "sanjose" internamente */
const PROV_SLUG: Partial<Record<ProvinceId, string>> = { sanjose: 'san-jose' };

export const provSlug = (id: ProvinceFilter) => PROV_SLUG[id as ProvinceId] ?? id;

export function provFromSlug(d: AtlasData, slug: string): ProvinceFilter | null {
  const s = decodeURIComponent(slug)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '');
  if (s === 'mar') return 'mar';
  return d.provById.has(s as ProvinceId) ? (s as ProvinceId) : null;
}
