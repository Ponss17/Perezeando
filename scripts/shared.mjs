import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const km = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180,
    dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** Licencia libre reutilizable (CC0, CC BY, CC BY-SA, dominio público); nunca NC/ND */
export const FREE = (l) => /^(cc0|cc[- ]by(-sa)?( \d(\.\d)?)?|public domain|pd\b|dominio p)/i.test(l || '') && !/nc|nd/i.test(l || '');

export const dishKey = (name) =>
  norm(typeof name === 'string' ? name : name?.es)
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const EN_DESC_RE =
  /\b(the|and|with|from|which|located|situated|known as|is a|was a|are a|national park|protected area|wildlife refuge|nature reserve|founded in|population of|square kilometres|pacific ocean|caribbean)\b/i;
export const ES_MARK_RE =
  /[áéíóúñ¿¡]|\b(el|la|los|las|un|una|del|al|es|son|está|fue|para|con|desde|que|ubicad|conocid|parque|playa|río|volcán|provincia|municipio|refugio|reserva|área|silvestre|también|durante|entre|cerca|norte|sur|costarricense|nacional|proteg|cantón|distrito)\b/i;

export function isEnglishLooking(text, esMark = ES_MARK_RE) {
  const t = String(text || '').trim();
  if (!t || t.length < 12) return false;
  if (esMark.test(t)) return false;
  const hits = t.match(EN_DESC_RE) || [];
  return hits.length >= 2 || (hits.length >= 1 && t.length > 50);
}

export const MEDIA_SIZES = [
  { tag: 120, w: 120, q: 72 },
  { tag: 320, w: 320, q: 74 },
  { tag: 800, w: 800, q: 78 },
];

export function loadSharp() {
  const require = createRequire(import.meta.url);
  try {
    return require(path.join(process.env.TEMP || '/tmp', 'pz-imgopt/node_modules/sharp'));
  } catch {
    try {
      return require('sharp');
    } catch {
      return null;
    }
  }
}

export function requireSharp() {
  const sharp = loadSharp();
  if (!sharp) {
    console.error('sharp no disponible (TEMP/pz-imgopt o sharp). Abort.');
    process.exit(1);
  }
  return sharp;
}

export async function writeWebpVariants(sharp, buf, dir, baseId, effort = 4) {
  const meta = await sharp(buf).rotate().metadata();
  let bytes800 = 0;
  for (const { tag, w, q } of MEDIA_SIZES) {
    let pipe = sharp(buf).rotate();
    if ((meta.width || 0) > w) pipe = pipe.resize({ width: w, withoutEnlargement: true });
    const info = await pipe.webp({ quality: q, effort }).toFile(path.join(dir, `${baseId}-${tag}.webp`));
    if (tag === 800) bytes800 = info.size;
  }
  return bytes800;
}

export const fold = (x) => norm(x).replace(/\s+/g, ' ').trim();
