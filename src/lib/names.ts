import type { Lang, LocalizedText } from '../data/types';

/**
 * Nombre en el otro idioma, sin repetir el principal:
 * "Cerro de la Muerte (Mountain of Death)" bajo "Cerro de la Muerte" → "Mountain of Death".
 */
export function altName(lang: Lang, name: LocalizedText): string {
  const main = (name[lang] || name.es || '').trim();
  const other = (lang === 'es' ? name.en : name.es)?.trim() ?? '';
  const norm = (x: string) =>
    x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
