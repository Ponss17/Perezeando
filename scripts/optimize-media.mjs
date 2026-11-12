#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { dishKey, MEDIA_SIZES, requireSharp, ROOT, writeWebpVariants } from './shared.mjs';

const sharp = requireSharp();

const MEDIA = path.join(ROOT, 'public', 'media');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jpe?g|png|webp)$/i.test(e.name) && !/-\d+\.webp$/i.test(e.name)) out.push(p);
  }
  return out;
}

const before = walk(MEDIA);
function allMediaBytes() {
  let n = 0, b = 0;
  const go = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) go(p);
      else {
        n++;
        b += fs.statSync(p).size;
      }
    }
  };
  go(MEDIA);
  return { n, b };
}
const pre = allMediaBytes();
console.log('before', pre);

const contentHash = new Map(); // sha1 -> base id used
const fileMap = new Map(); // old local path -> new canonical -800 path
const report = [];

for (const file of before) {
  const buf = fs.readFileSync(file);
  const sha = createHash('sha1').update(buf).digest('hex');
  const dir = path.dirname(file);
  const relDir = path.relative(path.join(ROOT, 'public'), dir).split(path.sep).join('/'); // media/food
  let baseId = contentHash.get(sha);
  if (!baseId) {
    baseId = sha.slice(0, 10);
    contentHash.set(sha, baseId);
    await writeWebpVariants(sharp, buf, dir, baseId, 6);
  } else {
    for (const { tag } of MEDIA_SIZES) {
      const dest = path.join(dir, `${baseId}-${tag}.webp`);
      if (!fs.existsSync(dest)) {
        const donor = [...fileMap.values()].find((v) => v.includes(`/${baseId}-800.webp`));
        if (donor) {
          const donorFile = path.join(ROOT, 'public', donor.replace(/^\//, '').replace(`-800.webp`, `-${tag}.webp`));
          if (fs.existsSync(donorFile)) fs.copyFileSync(donorFile, dest);
        }
      }
    }
  }
  const canonical = `/${relDir}/${baseId}-800.webp`.replace(/\\/g, '/');
  const oldUrl = '/' + path.relative(path.join(ROOT, 'public'), file).split(path.sep).join('/');
  fileMap.set(oldUrl, canonical);
  fileMap.set(oldUrl.replace(/^\/+/, '/'), canonical);
  report.push({ old: oldUrl, neu: canonical, sha: sha.slice(0, 10) });
}

for (const file of before) {
  try {
    fs.unlinkSync(file);
  } catch {}
}

function remapSrc(src) {
  if (!src || typeof src !== 'string') return src;
  if (!src.startsWith('/media/')) return src;
  if (/-\d+\.webp$/i.test(src)) {
    return src.replace(/-(?:120|320|800)\.webp$/i, '-800.webp');
  }
  const hit = fileMap.get(src) || fileMap.get(src.split('?')[0]);
  if (hit) return hit;
  const base = path.basename(src).replace(/\.(jpe?g|png|webp)$/i, '');
  for (const [old, neu] of fileMap) {
    if (old.includes(base)) return neu;
  }
  return src;
}

const photosPath = path.join(ROOT, 'data', 'photos.json');
const photos = JSON.parse(fs.readFileSync(photosPath, 'utf8'));
let pN = 0;
for (const [id, img] of Object.entries(photos.found || {})) {
  if (!img?.src) continue;
  const n = remapSrc(img.src);
  if (n !== img.src) {
    img.src = n;
    pN++;
  }
}
fs.writeFileSync(photosPath, JSON.stringify(photos));
console.log('photos remapped', pN);

const foodPath = path.join(ROOT, 'scripts/data/food-photos.json');
const food = JSON.parse(fs.readFileSync(foodPath, 'utf8'));
let fN = 0;
for (const [k, img] of Object.entries(food)) {
  if (!img?.src) continue;
  const n = remapSrc(img.src);
  if (n !== img.src) {
    img.src = n;
    fN++;
  }
}
fs.writeFileSync(foodPath, JSON.stringify(food, null, 2) + '\n');
console.log('food-photos remapped', fN);

const pcPath = path.join(ROOT, 'public/data/provinces-content.json');
const pc = JSON.parse(fs.readFileSync(pcPath, 'utf8'));
let cN = 0;
const stamp = (item) => {
  if (!item?.img?.src) return;
  const n = remapSrc(item.img.src);
  if (n !== item.img.src) {
    item.img.src = n;
    cN++;
  }
  const name = typeof item.name === 'string' ? item.name : item.name?.es;
  if (name) {
    const hit = food[dishKey(name)];
    if (hit?.src) item.img = { ...item.img, src: hit.src, page: hit.page || item.img.page, artist: hit.artist || item.img.artist, license: hit.license || item.img.license };
  }
};
for (const p of Object.values(pc.provinces || {})) for (const i of p.food?.items || []) stamp(i);
for (const i of pc.national?.food || []) stamp(i);
fs.writeFileSync(pcPath, JSON.stringify(pc));
console.log('provinces-content remapped', cN);

const post = allMediaBytes();
const outReport = {
  before: pre,
  after: post,
  savedBytes: pre.b - post.b,
  savedMB: +((pre.b - post.b) / 1e6).toFixed(2),
  ratio: +(post.b / pre.b).toFixed(3),
  unique: contentHash.size,
  mapped: report.length,
};
fs.writeFileSync(path.join(ROOT, 'perf/media-optimize.json'), JSON.stringify({ ...outReport, samples: report.slice(0, 20) }, null, 2));
console.log(JSON.stringify(outReport, null, 2));
