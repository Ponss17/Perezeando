import { useEffect, useState } from 'react';
import type { Lang, Place } from '../data/types';
import { thumbUrl } from './format';
import { mediaPath, mediaUrl } from './mediaUrl';

/** Foto resuelta para un lugar (portada de la ficha y miniatura del rótulo) */
export interface PlacePhoto {
  src: string;
  /**
   * Origen: solo datos curados en build (`img`).
   * `wiki` / `commons` pueden quedar en sessionStorage viejo; el runtime ya no los busca.
   */
  kind: 'img' | 'wiki' | 'commons';
  href?: string;
  credit?: string;
  license?: string;
}

export type RowPicture = { kind: 'photo'; src: string } | { kind: 'tile'; src: string; x: number; y: number };

/** ¿La URL es media local/R2 (`/media/...`)? */
const isLocalMediaSrc = (src?: string | null) => {
  if (!src) return false;
  return mediaPath(src).startsWith('/media/');
};

/**
 * ¿Se permite mostrar un remoto verificado en datos (hasta migrar a /media)?
 * - Cualquier `/media/...` (local o vía VITE_MEDIA_BASE_URL)
 * - HTTPS curado con `allowRemote: true` (p. ej. 2 especies aún sin WebP local)
 * - HTTPS curado legacy en photos.json / places (build-time); sin búsquedas en runtime
 */
function isAllowedPhotoSrc(src: string, allowRemote?: boolean) {
  if (!src) return false;
  if (isLocalMediaSrc(src)) return true;
  if (/^https?:\/\//i.test(src)) return allowRemote !== false;
  return false;
}

/** Imagen de la fila: solo foto curada (miniatura). Sin teselas satelitales: cada fila pedía un GET a Esri. */
export function placePicture(p: Place): RowPicture | null {
  const src = p.img?.src;
  if (!src || !isAllowedPhotoSrc(src, p.img?.allowRemote)) return null;
  return { kind: 'photo', src: thumbUrl(src) };
}

/** Foto curada (síncrona) desde datos de build; sin peticiones de red */
const curatedPhoto = (p: Place): PlacePhoto | null => {
  const img = p.img;
  if (!img?.src || !isAllowedPhotoSrc(img.src, img.allowRemote)) return null;
  return { src: img.src, kind: 'img', href: img.page, credit: img.artist, license: img.license };
};

const RESOLVED_CAP = 240;
const resolved = new Map<string, PlacePhoto | null>();
try {
  const raw = sessionStorage.getItem('pz.photos');
  if (raw) {
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, PlacePhoto | null>)) {
      if (resolved.size >= RESOLVED_CAP) break;
      // Ignorar caché runtime wiki/commons: ya no se descubren fotos en vivo
      if (v && (v.kind === 'wiki' || v.kind === 'commons')) continue;
      resolved.set(k, v);
    }
  }
} catch {
  /* private mode */
}
function persistResolved() {
  try {
    const o: Record<string, PlacePhoto | null> = {};
    for (const [k, v] of resolved) o[k] = v;
    sessionStorage.setItem('pz.photos', JSON.stringify(o));
  } catch {
    /* quota */
  }
}

function rememberResolved(key: string, photo: PlacePhoto | null) {
  resolved.delete(key);
  resolved.set(key, photo);
  while (resolved.size > RESOLVED_CAP) {
    const oldest = resolved.keys().next().value;
    if (oldest === undefined) break;
    resolved.delete(oldest);
  }
  persistResolved();
}

/** Foto ya resuelta (o null / undefined si todavía no se sabe) */
export const knownPhoto = (p: Place, lang: Lang) => curatedPhoto(p) ?? resolved.get(p.id + ':' + lang);

/**
 * Foto del lugar: solo la curada en datos (`p.img`).
 * No hay fallback en runtime a Wikipedia ni Commons (eso es build-time: fetch-photos / fetch-fauna-media).
 */
export async function resolvePhoto(p: Place, lang: Lang): Promise<PlacePhoto | null> {
  const cur = curatedPhoto(p);
  if (cur) return cur;
  const key = p.id + ':' + lang;
  if (resolved.has(key)) return resolved.get(key)!;
  rememberResolved(key, null);
  return null;
}

/**
 * Vista satelital estática (Esri World Imagery, export sin clave) centrada en el
 * lugar. Se usa como portada cuando no hay ninguna foto.
 */
export function satelliteSnapshot(p: Place, w = 768, h = 416) {
  const R = 6378137;
  const x = (p.lng * Math.PI * R) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (p.lat * Math.PI) / 360));
  // metros por píxel: más abierto para el mar y los parques grandes
  const res = p.prov === 'mar' ? 120 : p.geometry ? 14 : 3.2;
  const hw = (w * res) / 2;
  const hh = (h * res) / 2;
  const q = new URLSearchParams({
    bbox: [x - hw, y - hh, x + hw, y + hh].map((n) => n.toFixed(1)).join(','),
    bboxSR: '3857',
    imageSR: '3857',
    size: `${w},${h}`,
    format: 'jpg',
    f: 'image',
  });
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${q}`;
}

/** Elige el ancho adecuado: local WebP (-120/-320/-800) o thumb de Wikimedia. */
export function sizedThumb(src: string, w: number) {
  if (!src) return src;
  const local = mediaPath(src);
  if (local.startsWith('/media/')) {
    const tag = w <= 160 ? 120 : w <= 400 ? 320 : 800;
    return mediaUrl(
      local.replace(/-(?:120|320|800)\.webp$/i, `-${tag}.webp`).replace(/\.(jpe?g|png)$/i, `-${tag}.webp`),
    );
  }
  if (!/(upload|thumb)\.wikimedia\.org\/.+\/thumb\//.test(src)) return src;
  return src.replace(/\/(\d+)px-([^/]+)$/, (m, n, rest) => (Number(n) > w ? `/${w}px-${rest}` : m));
}

// Wikimedia solo sirve anchos estándar (120, 250, 330, 500, 960, 1280.)
// portada: 500 px alcanza para el panel de escritorio (~400 px a 1x); en pantallas densas o móviles, 960
export const HERO_W =
  typeof window !== 'undefined' &&
  (window.innerWidth <= 760 ? window.innerWidth : 400) * (window.devicePixelRatio || 1) <= 520
    ? 500
    : 800;

const decoded = new Map<string, Promise<boolean>>();
const ready = new Set<string>();

/** ¿La imagen ya está descargada y decodificada? */
export const isImageReady = (src: string) => ready.has(src);

export function useImageState(src: string | undefined) {
  const instant = !!src && isImageReady(src);
  const [state, setState] = useState<'wait' | 'ok' | 'err'>(instant ? 'ok' : 'wait');
  const [prev, setPrev] = useState(src);
  if (src !== prev) {
    setPrev(src);
    setState(src && isImageReady(src) ? 'ok' : 'wait');
  }
  useEffect(() => {
    if (!src || isImageReady(src)) return;
    let live = true;
    preloadImage(src).then((ok) => {
      if (live) setState(ok ? 'ok' : 'err');
    });
    return () => {
      live = false;
    };
  }, [src]);
  return { state, instant };
}

/** Descarga y decodifica una imagen fuera del DOM; true si quedó lista */
export function preloadImage(src: string): Promise<boolean> {
  let pr = decoded.get(src);
  if (pr) return pr;
  pr = new Promise<boolean>((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.referrerPolicy = 'no-referrer';
    im.onload = () => {
      const done = () => {
        ready.add(src);
        res(true);
      };
      (im.decode ? im.decode() : Promise.resolve()).then(done, done);
    };
    im.onerror = () => {
      decoded.delete(src);
      res(false);
    };
    im.src = src;
  });
  decoded.set(src, pr);
  return pr;
}

/**
 * Precarga solo fotos /media (local o R2).
 * No llama a Wikipedia/Commons en hover.
 */
export function prefetchPhoto(p: Place, _lang?: Lang) {
  const cur = curatedPhoto(p);
  if (!cur) return;
  // Solo precargar /media (local o R2). Remotos verificados se cargan al pintar la fila/ficha.
  if (!isLocalMediaSrc(cur.src)) return;
  preloadImage(sizedThumb(cur.src, Math.min(HERO_W, 320)));
}
