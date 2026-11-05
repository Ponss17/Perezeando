import { CAT_SHAPE, CATEGORIES, type MarkerShape } from '../data/config';
import type { CategoryId } from '../data/types';
import { ICONS } from './icons';

/** Diámetro visible de la chincheta del mapa (px) y margen para sombra/favorito */
export const PIN = 30;
export const PIN_PAD = 7;

/** Contorno de la forma de cada familia de categorías, centrado en (c,c) */
export function shapePath(shape: MarkerShape, c: number, r: number) {
  if (shape === 'square') {
    const k = r * 0.9;
    const rr = 7;
    const x = c - k;
    const y = c - k;
    const w = k * 2;
    return `M${x + rr},${y}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${w - 2 * rr}a${rr},${rr} 0 0 1 -${rr},${rr}h-${w - 2 * rr}a${rr},${rr} 0 0 1 -${rr},-${rr}v-${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},-${rr}z`;
  }
  if (shape === 'diamond') {
    const k = r * 1.08;
    const q = 3.2; // redondeo de vértices
    return `M${c},${c - k + q}Q${c},${c - k} ${c + q},${c - k + q}L${c + k - q},${c - q}Q${c + k},${c} ${c + k - q},${c + q}L${c + q},${c + k - q}Q${c},${c + k} ${c - q},${c + k - q}L${c - k + q},${c + q}Q${c - k},${c} ${c - k + q},${c - q}Z`;
  }
  return `M${c - r},${c}a${r},${r} 0 1 0 ${r * 2},0a${r},${r} 0 1 0 -${r * 2},0z`;
}

export function pinShapeMarkup(cat: CategoryId, filter?: string) {
  const { color, icon } = CATEGORIES[cat];
  const c = (PIN + PIN_PAD * 2) / 2;
  const r = PIN / 2 - 1.5;
  const shape = CAT_SHAPE[cat];
  const g = 16;
  const f = filter ? ` filter="${filter}"` : '';
  const glyph = `<svg x="${c - g / 2}" y="${c - g / 2}" width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon] ?? ''}</svg>`;
  return `<path d="${shapePath(shape, c, r)}" fill="${color}" stroke="#fff" stroke-width="2"${f}/>
${glyph}`;
}
