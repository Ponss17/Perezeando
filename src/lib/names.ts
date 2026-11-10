import type { Lang, LocalizedText, Place } from '../data/types';
import { pick } from '../i18n';

const GENERIC = new Set([
  'cascada',
  'catarata',
  'waterfall',
  'playa',
  'beach',
  'cerro',
  'rio',
  'río',
  'river',
  'isla',
  'island',
  'laguna',
  'lagoon',
]);

/** Nombres genéricos tipo “Cascada” / “Waterfall” sin nombre propio */
export function isGenericName(p: Place, lang: Lang): boolean {
  const raw = pick(lang, p.name).trim();
  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
  return GENERIC.has(norm) || /^cascada\s*(grande|pequena|pequeña)?$/.test(norm);
}

/** Etiqueta para genéricos: “Cascada sin nombre · cerca de Playa X” */
export function genericLabel(p: Place, lang: Lang, near?: Place | null): string {
  const name = pick(lang, p.name).trim();
  if (!isGenericName(p, lang)) return name;
  const base = lang === 'es' ? `${name} sin nombre` : `Unnamed ${name.toLowerCase()}`;
  if (!near) return base;
  const n = pick(lang, near.name);
  return lang === 'es' ? `${base} · cerca de ${n}` : `${base} · near ${n}`;
}

/**
 * Nombre en el otro idioma, sin repetir el principal:
 * "Cerro de la Muerte (Mountain of Death)" bajo "Cerro de la Muerte" → "Mountain of Death".
 */
export function altName(lang: Lang, name: LocalizedText): string {
  const main = (name[lang] || name.es || '').trim();
  const other = (lang === 'es' ? name.en : name.es)?.trim() ?? '';
  const norm = (x: string) =>
    x
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  if (!other) return '';
  if (norm(other) === norm(main)) return '';
  // "X (traducción)" → "traducción"
  if (norm(other).startsWith(norm(main))) {
    const m = other.match(/\(([^)]+)\)\s*$/);
    return m && norm(m[1]) !== norm(main) ? m[1] : '';
  }
  // el principal ya incluye al otro entre paréntesis
  if (norm(main).startsWith(norm(other))) return '';
  return other;
}
