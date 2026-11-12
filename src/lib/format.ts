import { mediaPath, mediaUrl } from './mediaUrl';
import type { Lang } from '../data/types';
import { translate, locale } from '../i18n';

export function fmt(lang: Lang, input: string | number): string {
  let s = String(input);
  if (lang === 'en') {
    s = s
      .replace(/(\d)\.(\d{3})(?!\d)/g, '$1,$2')
      .replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2')
      .replace(/\s?a\.C\./g, ' BC')
      .replace(/\s?d\.C\./g, ' AD');
  } else {
    s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1.$2');
  }
  return s;
}

export const fmtNum = (lang: Lang, n: number) => n.toLocaleString(locale(lang));

export const fmtKm = (lang: Lang, km: number) =>
  (km < 10 ? Number(km.toFixed(1)) : Math.round(km)).toLocaleString(locale(lang)) +
  ' ' +
  translate(lang, 'km');

export function fmtDur(lang: Lang, s: number) {
  const m = Math.round(s / 60);
  if (m < 60) return m + ' ' + translate(lang, 'min');
  return (
    Math.floor(m / 60) +
    ' ' +
    translate(lang, 'h') +
    ' ' +
    String(m % 60).padStart(2, '0') +
    ' ' +
    translate(lang, 'min')
  );
}

export const norm = (s: string | undefined | null) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const thumbUrl = (src: string) => {
  if (!src) return src;
  const local = mediaPath(src);
  if (local.startsWith('/media/')) {
    return mediaUrl(
      local.replace(/-(?:120|320|800)\.webp$/i, '-120.webp').replace(/\.(jpe?g|png)$/i, '-120.webp'),
    );
  }
  if (src.includes('/960px-')) return src.replace('/960px-', '/120px-');
  const m =
    /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f]\/[0-9a-f]{2})\/([^/?#]+\.(?:jpe?g|png))(?:[?#].*)?$/i.exec(
      src,
    );
  return m ? `${m[1]}/thumb/${m[2]}/${m[3]}/120px-${m[3]}` : src;
};
