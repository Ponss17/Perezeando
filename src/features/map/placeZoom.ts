import type { Place } from '../../data/types';

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function targetZoom(p: Place): number {
  switch (p.cat) {
    case 'playas':
    case 'surf':
      return 15;
    case 'ciudades':
      return 13.5;
    case 'volcanes':
    case 'cerros':
      return 13;
    case 'parques':
    case 'bosques':
    case 'islas':
    case 'rios':
      return 12.5;
    case 'faunaTerrestre':
    case 'fauna':
    case 'isras':
    case 'immas':
    case 'hitosOceanicos':
    case 'submarinas':
      return 11;
    case 'aeropuertos':
    case 'puertos':
      return 15;
    default:
      return 17;
  }
}

export function areaZoom(p: Place): number | null {
  const a = (p.facts as { area?: string | number } | undefined)?.area;
  if (a == null) return null;
  const t = String(a);
  const n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
  if (!isFinite(n) || n <= 0) return null;
  const km2 = /ha\b/.test(t) ? n / 100 : n;
  const side = Math.sqrt(km2);
  return Math.max(9.5, Math.min(15, Math.log2(80000 / side)));
}
