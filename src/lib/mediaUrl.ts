const RAW = String(import.meta.env.VITE_MEDIA_BASE_URL ?? '').trim();
const MEDIA_BASE_URL = RAW.replace(/\/+$/, '');

export function mediaUrl(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (!src.startsWith('/media/')) return src;
  if (!MEDIA_BASE_URL) return src;
  return MEDIA_BASE_URL + src;
}

export function mediaPath(src: string): string {
  if (!src) return src;
  if (src.startsWith('/media/')) return src;
  if (MEDIA_BASE_URL && src.startsWith(MEDIA_BASE_URL + '/media/')) {
    return src.slice(MEDIA_BASE_URL.length);
  }
  const m = /(?:https?:\/\/[^/]+)?(\/media\/(?:places|food)\/[^?#]+)/i.exec(src);
  return m ? m[1] : src;
}
