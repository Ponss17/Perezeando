/** Prefijo opcional de medios (R2 / CDN). Vacío = servir /media local. */
const RAW = String(import.meta.env.VITE_MEDIA_BASE_URL ?? '').trim();
const MEDIA_BASE_URL = RAW.replace(/\/+$/, '');

/**
 * Resuelve una ruta canónica `/media/...` (o ya absoluta) a la URL final.
 * Los JSON siguen guardando `/media/...`; aquí se antepone VITE_MEDIA_BASE_URL si existe.
 */
export function mediaUrl(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (!src.startsWith('/media/')) return src;
  if (!MEDIA_BASE_URL) return src;
  return MEDIA_BASE_URL + src;
}

/** Quita el prefijo remoto y deja `/media/...` para elegir variante 120/320/800. */
export function mediaPath(src: string): string {
  if (!src) return src;
  if (src.startsWith('/media/')) return src;
  if (MEDIA_BASE_URL && src.startsWith(MEDIA_BASE_URL + '/media/')) {
    return src.slice(MEDIA_BASE_URL.length);
  }
  const m = /(?:https?:\/\/[^/]+)?(\/media\/(?:places|food)\/[^?#]+)/i.exec(src);
  return m ? m[1] : src;
}
