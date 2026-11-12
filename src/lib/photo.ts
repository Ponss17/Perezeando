import { useEffect, useState } from 'react';
import type { Place, PlaceImage } from '../data/types';
import { thumbUrl } from './format';
import { mediaPath, mediaUrl } from './mediaUrl';

const isLocalMediaSrc = (src?: string | null) => {
  if (!src) return false;
  return mediaPath(src).startsWith('/media/');
};

function isAllowedPhotoSrc(src: string, allowRemote?: boolean) {
  if (!src) return false;
  if (isLocalMediaSrc(src)) return true;
  if (/^https?:\/\//i.test(src)) return allowRemote !== false;
  return false;
}

export function placePhoto(p: Place): PlaceImage | null {
  const img = p.img;
  return img?.src && isAllowedPhotoSrc(img.src, img.allowRemote) ? img : null;
}

export function placeThumb(p: Place): string | null {
  const img = placePhoto(p);
  return img ? thumbUrl(img.src) : null;
}

export function satelliteSnapshot(p: Place, w = 768, h = 416) {
  const R = 6378137;
  const x = (p.lng * Math.PI * R) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (p.lat * Math.PI) / 360));
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

export const HERO_W =
  typeof window !== 'undefined' &&
  (window.innerWidth <= 760 ? window.innerWidth : 400) * (window.devicePixelRatio || 1) <= 520
    ? 500
    : 800;

const decoded = new Map<string, Promise<boolean>>();
const ready = new Set<string>();

const isImageReady = (src: string) => ready.has(src);

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

function preloadImage(src: string): Promise<boolean> {
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

export function prefetchPhoto(p: Place) {
  const img = placePhoto(p);
  if (img && isLocalMediaSrc(img.src)) preloadImage(sizedThumb(img.src, Math.min(HERO_W, 320)));
}
