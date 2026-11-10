import { useCallback } from 'react';
import { useApp } from '../store/useApp';
import { es, type DictKey } from './es';
import { en } from './en';
import type { Lang, LocalizedText } from '../data/types';

const DICTS = { es, en } as const;
export type { DictKey };

export const translate = (lang: Lang, k: DictKey): string => DICTS[lang][k] ?? es[k] ?? k;
export const pick = (lang: Lang, o?: Partial<LocalizedText> | null): string => (o && (o[lang] || o.es)) || '';
export const locale = (lang: Lang) => (lang === 'es' ? 'es-CR' : 'en-US');

/** Hook de traducción: devuelve t(), el idioma y L() para textos localizados */
export function useT() {
  const lang = useApp((s) => s.lang);
  const t = useCallback((k: DictKey) => translate(lang, k), [lang]);
  const L = useCallback((o?: Partial<LocalizedText> | null) => pick(lang, o), [lang]);
  return { t, L, lang };
}
