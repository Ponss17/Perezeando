import { getApp, setApp } from './useApp';
import { getData } from '../data/load';
import type { CategoryId, ProvinceId } from '../data/types';
import { CATEGORIES } from '../data/config';
import { pick, translate } from '../i18n';

export const t = (k: Parameters<typeof translate>[1]) => translate(getApp().lang, k);
export const L = (o: Parameters<typeof pick>[1]) => pick(getApp().lang, o);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  clearTimeout(toastTimer);
  setApp({ toast: { msg, n: Date.now() } });
  toastTimer = setTimeout(() => setApp({ toast: null }), 2600);
}

export const catName = (c: CategoryId) => L(CATEGORIES[c].name);
export const catOne = (c: CategoryId) => L(CATEGORIES[c].one);

export function provName(id: string) {
  if (id === 'mar') return t('marine');
  return getData()?.provById.get(id as ProvinceId)?.name ?? '';
}
