import { useEffect, useState } from 'react';
import type { Lang, Place } from '../data/types';
import { fetchWikiSummary, usableWikiThumb, wikiTarget, wikiUrl } from './wiki';
import { norm, thumbUrl } from './format';

/** Foto resuelta para un lugar (portada de la ficha y miniatura del rótulo) */
export interface PlacePhoto {
  src: string;
  /** de dónde salió: foto curada, Wikipedia o búsqueda en Commons por cercanía */
  kind: 'img' | 'wiki' | 'commons';
  href?: string;
  credit?: string;
  license?: string;
}

/** Palabras genéricas que no sirven para saber si una foto cercana es del lugar */
const GENERIC = new Set(
  (
    'volcan volcano cerro mount monte peak parque park nacional national refugio reserva reserve bosque forest ' +
    'catarata waterfall falls cascada playa beach isla island islas islands rio river laguna lagoon lago lake ' +
    'costa rica fosil fossil hito sitio site museo museum ciudad city puerto port aeropuerto airport ' +
    'internacional international area zona marina marine fauna para with from the del las los una'
  ).split(' '),
);

const tokens = (p: Place) =>
  [...new Set(norm(`${p.name.es} ${p.name.en}`).split(/[^a-z0-9]+/))].filter(
    (w) => w.length >= 4 && !GENERIC.has(w),
  );

const COMMONS_CAP = 80;
const commonsCache = new Map<string, Promise<PlacePhoto | null>>();

function rememberCommons(id: string, pr: Promise<PlacePhoto | null>) {
  commonsCache.delete(id);
  commonsCache.set(id, pr);
  while (commonsCache.size > COMMONS_CAP) {
    const oldest = commonsCache.keys().next().value;
    if (oldest === undefined || oldest === id) break;
    commonsCache.delete(oldest);
  }
}

interface CommonsPage {
  title: string;
  index?: number;
  imageinfo?: {
    thumburl?: string;
    mime?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

const stripHtml = (s?: string) => (s ? s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : undefined);

/**
 * Foto de Wikimedia Commons tomada cerca de las coordenadas. Solo se acepta si el
 * título del archivo menciona el nombre del lugar (si no, sería una foto cualquiera
 * de la zona) y se descartan mapas, logos y escudos.
 */
export function fetchCommonsNear(p: Place): Promise<PlacePhoto | null> {
  let pr = commonsCache.get(p.id);
  if (pr) return pr;
  const words = tokens(p);
  if (!words.length) {
    pr = Promise.resolve(null);
    rememberCommons(p.id, pr);
    return pr;
  }
  pr = (async () => {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000);
    try {
      const q = new URLSearchParams({
        action: 'query',
        generator: 'geosearch',
        ggscoord: `${p.lat}|${p.lng}`,
        ggsradius: '5000',
        ggsnamespace: '6',
        ggslimit: '20',
        prop: 'imageinfo',
        iiprop: 'url|mime|extmetadata',
        iiextmetadatafilter: 'Artist|LicenseShortName',
        iiurlwidth: '960',
        format: 'json',
        formatversion: '2',
        origin: '*',
      });
      const r = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { signal: ctl.signal });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { query?: { pages?: CommonsPage[] } };
      const pages = (d.query?.pages ?? [])
        .filter((pg) => {
          const ii = pg.imageinfo?.[0];
          if (!ii?.thumburl || !/jpe?g|png|webp/i.test(ii.mime ?? '')) return false;
          const t = norm(pg.title);
          if (/\b(map|mapa|logo|escudo|flag|bandera|coat)\b/.test(t)) return false;
          return words.some((w) => t.includes(w));
        })
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const pg = pages[0];
      if (!pg) return null;
      const ii = pg.imageinfo![0];
      return {
        src: ii.thumburl!,
        kind: 'commons',
        href: ii.descriptionurl,
        credit: stripHtml(ii.extmetadata?.Artist?.value)?.slice(0, 60) || 'Wikimedia Commons',
        license: stripHtml(ii.extmetadata?.LicenseShortName?.value),
      } satisfies PlacePhoto;
    } catch (err) {
      commonsCache.delete(p.id);
      throw err;
    } finally {
      clearTimeout(to);
    }
  })();
  rememberCommons(p.id, pr);
  return pr;
}

const NO_SNAPSHOT = new Set(['gastronomia', 'submarinas', 'isras', 'immas', 'hitosOceanicos']);
const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

export type RowPicture = { kind: 'photo'; src: string } | { kind: 'tile'; src: string; x: number; y: number };

/** Tesela ya cacheada del mapa, recortada al punto. Varios lugares cercanos comparten la misma. */
export function satelliteTile(lat: number, lng: number, z = 16) {
  const n = 2 ** z;
  const xf = ((lng + 180) / 360) * n;
  const latR = (lat * Math.PI) / 180;
  const yf = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n;
  const tx = Math.floor(xf);
  const ty = Math.floor(yf);
  return { src: `${TILE}/${z}/${ty}/${tx}`, x: (xf - tx) * 256, y: (yf - ty) * 256 };
}

/** Imagen de la fila: la foto del lugar, o un recorte de tesela. El mar y los restaurantes se quedan con el ícono. */
export function placePicture(p: Place): RowPicture | null {
  if (p.img?.src) return { kind: 'photo', src: thumbUrl(p.img.src) };
  if (NO_SNAPSHOT.has(p.cat) || p.prov === 'mar') return null;
  return { kind: 'tile', ...satelliteTile(p.lat, p.lng, p.geometry ? 15 : 16) };
}

/** Foto curada (síncrona) */
export const curatedPhoto = (p: Place): PlacePhoto | null =>
  p.img
    ? { src: p.img.src, kind: 'img', href: p.img.page, credit: p.img.artist, license: p.img.license }
    : null;

const RESOLVED_CAP = 160;
const resolved = new Map<string, PlacePhoto | null>();

function rememberResolved(key: string, photo: PlacePhoto | null) {
  resolved.delete(key);
  resolved.set(key, photo);
  while (resolved.size > RESOLVED_CAP) {
    const oldest = resolved.keys().next().value;
    if (oldest === undefined) break;
    resolved.delete(oldest);
  }
}

/** Foto ya resuelta (o null / undefined si todavía no se sabe) */
export const knownPhoto = (p: Place, lang: Lang) =>
  curatedPhoto(p) ?? resolved.get(p.id + ':' + lang);

/** Foto del lugar: curada → miniatura de Wikipedia → Commons cercana con el nombre */
export async function resolvePhoto(p: Place, lang: Lang): Promise<PlacePhoto | null> {
  const cur = curatedPhoto(p);
  if (cur) return cur;
  const key = p.id + ':' + lang;
  if (resolved.has(key)) return resolved.get(key)!;
  let out: PlacePhoto | null = null;
  const w = wikiTarget(lang, p.wiki);
  if (w) {
    try {
      const s = await fetchWikiSummary(w);
      const src = s.thumbnail?.source;
      if (src && usableWikiThumb(src)) out = { src, kind: 'wiki', href: wikiUrl(w), credit: 'Wikipedia' };
    } catch {
      /* sin red: seguimos con Commons */
    }
  }
  let commonsFailed = false;
  if (!out) {
    try {
      out = await fetchCommonsNear(p);
    } catch {
      commonsFailed = true;
    }
  }
  if (commonsFailed && !out) return null;
  rememberResolved(key, out);
  return out;
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

/** Ajusta una miniatura de Wikimedia al ancho pedido (solo reduce, nunca agranda) */
export function sizedThumb(src: string, w: number) {
  if (!/(upload|thumb)\.wikimedia\.org\/.+\/thumb\//.test(src)) return src;
  return src.replace(/\/(\d+)px-([^/]+)$/, (m, n, rest) => (Number(n) > w ? `/${w}px-${rest}` : m));
}

// Wikimedia solo sirve anchos estándar (120, 250, 330, 500, 960, 1280…)
// portada: 500 px alcanza para el panel de escritorio (≈400 px a 1x); en pantallas densas o móviles, 960
export const HERO_W =
  typeof window !== 'undefined' &&
  (window.innerWidth <= 760 ? window.innerWidth : 400) * (window.devicePixelRatio || 1) <= 520
    ? 500
    : 960;

const decoded = new Map<string, Promise<boolean>>();
const ready = new Set<string>();

/** ¿La imagen ya está descargada y decodificada? */
export const isImageReady = (src: string) => ready.has(src);

export function useImageState(src: string | undefined) {
  const [state, setState] = useState<'wait' | 'ok' | 'err'>(() =>
    src && isImageReady(src) ? 'ok' : 'wait',
  );
  const [instant] = useState(() => !!src && isImageReady(src));
  useEffect(() => {
    if (!src) return;
    if (isImageReady(src)) {
      setState('ok');
      return;
    }
    let live = true;
    setState('wait');
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

/** Al pasar el ratón solo se pide la miniatura de Wikipedia. La búsqueda en Commons espera a abrir la ficha. */
export function prefetchPhoto(p: Place, lang: Lang) {
  const cur = curatedPhoto(p);
  const key = p.id + ':' + lang;
  const known = cur ?? (resolved.has(key) ? resolved.get(key)! : undefined);
  if (known) {
    preloadImage(sizedThumb(known.src, HERO_W));
    return;
  }
  if (known === null) return;
  const w = wikiTarget(lang, p.wiki);
  if (!w) return;
  fetchWikiSummary(w)
    .then((s) => {
      const src = s.thumbnail?.source;
      if (!src || !usableWikiThumb(src) || resolved.has(key)) return;
      const ph: PlacePhoto = { src, kind: 'wiki', href: wikiUrl(w), credit: 'Wikipedia' };
      resolved.set(key, ph);
      preloadImage(sizedThumb(src, HERO_W));
    })
    .catch(() => {});
}
