import type { Lang, LocalizedText, Place } from '../data/types';
import { pick } from '../i18n';
import { norm as fold } from './format';

const GENERIC = new Set([
  'cascada',
  'catarata',
  'waterfall',
  'playa',
  'beach',
  'cerro',
  'rio',
  'river',
  'isla',
  'island',
  'laguna',
  'lagoon',
]);

const foldKey = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9 ]/g, '')
    .trim();

/** Nombres genéricos tipo “Cascada” / “Waterfall” sin nombre propio */
export function isGenericName(p: Place, lang: Lang): boolean {
  const key = foldKey(pick(lang, p.name));
  return GENERIC.has(key) || /^cascada\s*(grande|pequena)?$/.test(key);
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
  const key = (x: string) =>
    fold(x)
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  if (!other) return '';
  if (key(other) === key(main)) return '';
  if (key(other).startsWith(key(main))) {
    const m = other.match(/\(([^)]+)\)\s*$/);
    return m && key(m[1]) !== key(main) ? m[1] : '';
  }
  if (key(main).startsWith(key(other))) return '';
  return other;
}
