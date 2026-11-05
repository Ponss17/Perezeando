import fs from 'node:fs';
import { dishKey } from './local-dishes.mjs';

const FILE = new URL('./data/food-photos.json', import.meta.url);
let cache;

export function foodPhotoMap() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

export function stampFoodPhotos(out) {
  const photos = foodPhotoMap();
  const stamp = (item) => {
    if (!item || item.img) return;
    const hit = photos[dishKey(item.name)];
    if (hit) item.img = hit;
  };
  for (const [k, o] of Object.entries(out)) {
    if (k === '_national' && Array.isArray(o)) o.forEach(stamp);
    else o?.items?.forEach(stamp);
  }
}
