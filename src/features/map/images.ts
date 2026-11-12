import type { Map as MLMap } from 'maplibre-gl';
import { CATEGORIES, CATEGORY_ORDER } from '../../data/config';
import type { CategoryId } from '../../data/types';
import { pinShapeMarkup, PIN, PIN_PAD as PAD } from '../../lib/markerShape';

const PR = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio || 1 : 1);

function svgPin(cat: CategoryId, fav: boolean) {
  const S = PIN + PAD * 2;
  const c = S / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S * PR}" height="${S * PR}" viewBox="0 0 ${S} ${S}">
<defs><filter id="s" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.2" stdDeviation="1.3" flood-color="#000" flood-opacity=".32"/></filter></defs>
${pinShapeMarkup(cat, 'url(#s)')}
${fav ? `<circle cx="${c + 11}" cy="${c - 11}" r="5" fill="#b08968" stroke="#fff" stroke-width="1.8"/>` : ''}
</svg>`;
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function addImg(map: MLMap, name: string, img: HTMLImageElement) {
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  if (!map.hasImage(name))
    map.addImage(name, { width: cv.width, height: cv.height, data: data.data }, { pixelRatio: PR });
}

export async function addPinImages(map: MLMap) {
  await Promise.all(
    CATEGORY_ORDER.map((id) => loadSvg(svgPin(id, false)).then((img) => addImg(map, `pin-${id}`, img))),
  );
}

const pending = new Set<string>();
export function addFavPin(map: MLMap, name: string) {
  const id = name.slice(4, -4) as CategoryId;
  if (pending.has(name) || !CATEGORIES[id]) return;
  pending.add(name);
  loadSvg(svgPin(id, true))
    .then((img) => addImg(map, name, img))
    .catch(() => {})
    .finally(() => pending.delete(name));
}

export const clusterProperties = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [c, ['+', ['case', ['==', ['get', 'cat'], c], 1, 0]]]),
);

const SHARE = 10;
const SIZE_AT = [10, 30, 100];

function sizeBucket(n: number) {
  return n >= 100 ? 3 : n >= 30 ? 2 : n >= 10 ? 1 : 0;
}

function shareSteps(props: Record<string, unknown>, total: number) {
  return CATEGORY_ORDER.map((c) => {
    const part = (Number(props[c] ?? 0) / total) * SHARE;
    return part < 0 ? -Math.round(-part) : Math.round(part);
  });
}

function clusterIconId(props: Record<string, unknown>): string {
  const total = Math.max(1, Number(props.point_count) || 0);
  return `cl:${sizeBucket(total)}:${shareSteps(props, total).join(',')}`;
}

const shareExpr = (c: string) => [
  'to-string',
  [
    'round',
    ['*', ['/', ['coalesce', ['get', c], 0], ['max', ['coalesce', ['get', 'point_count'], 0], 1]], SHARE],
  ],
];

export const clusterImageExpr = [
  'concat',
  'cl:',
  [
    'case',
    ['>=', ['get', 'point_count'], SIZE_AT[2]],
    '3',
    ['>=', ['get', 'point_count'], SIZE_AT[1]],
    '2',
    ['>=', ['get', 'point_count'], SIZE_AT[0]],
    '1',
    '0',
  ],
  ':',
  ...CATEGORY_ORDER.flatMap((c, i) => (i ? [',', shareExpr(c)] : [shareExpr(c)])),
];

export function clusterBreakdown(props: Record<string, unknown>): [CategoryId, number][] {
  return CATEGORY_ORDER.map((c) => [c, Number(props[c] ?? 0)] as [CategoryId, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

const SIZE_R = [16, 18, 20, 22];
const CLUSTER_CAP = 64;
const clusterLru: string[] = [];

function touchCluster(id: string) {
  const i = clusterLru.indexOf(id);
  if (i >= 0) clusterLru.splice(i, 1);
  clusterLru.push(id);
}

export function drawCluster(map: MLMap, id: string) {
  const body = id.slice(3);
  const colon = body.indexOf(':');
  const bucket = Number(body.slice(0, colon));
  const weights = body
    .slice(colon + 1)
    .split(',')
    .map(Number);
  const r = SIZE_R[bucket] ?? SIZE_R[0];
  const ring = 4;
  const S = (r + ring + 6) * 2;
  const c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(S * PR);
  cv.height = Math.ceil(S * PR);
  const ctx = cv.getContext('2d')!;
  ctx.scale(PR, PR);
  ctx.save();
  ctx.shadowColor = 'rgba(20,32,24,.35)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 1.5;
  ctx.beginPath();
  ctx.arc(c, c, r + ring + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  const n = weights.reduce((a, b) => a + (b || 0), 0);
  if (n > 0) {
    let a = -Math.PI / 2;
    const gap = weights.filter((v) => v > 0).length > 1 ? 0.06 : 0;
    weights.forEach((v, i) => {
      if (!v) return;
      const da = (v / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c, c, r + ring / 2, a + gap / 2, a + da - gap / 2);
      ctx.strokeStyle = CATEGORIES[CATEGORY_ORDER[i]].color;
      ctx.lineWidth = ring;
      ctx.stroke();
      a += da;
    });
  }
  ctx.beginPath();
  ctx.arc(c, c, r - 1, 0, Math.PI * 2);
  ctx.fillStyle = '#386641';
  ctx.fill();
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  if (!map.hasImage(id))
    map.addImage(id, { width: cv.width, height: cv.height, data: data.data }, { pixelRatio: PR });
  touchCluster(id);
}

export function pruneClusterImages(map: MLMap) {
  if (!map.getLayer('clusters') || clusterLru.length <= CLUSTER_CAP) return;
  const live = new Set<string>();
  for (const f of map.queryRenderedFeatures({ layers: ['clusters'] })) {
    if (f.properties) live.add(clusterIconId(f.properties));
  }
  for (let i = 0; i < clusterLru.length && clusterLru.length > CLUSTER_CAP;) {
    const id = clusterLru[i];
    if (live.has(id)) {
      i++;
      continue;
    }
    clusterLru.splice(i, 1);
    if (map.hasImage(id)) map.removeImage(id);
  }
}
