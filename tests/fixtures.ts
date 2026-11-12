import fs from 'node:fs';
import path from 'node:path';
import type { AtlasData } from '../src/data/load';
import type { CategoryId, EezFC, Place, ProvinceId, ProvincesFC } from '../src/data/types';

let atlas: AtlasData | null = null;

export function loadAtlas(): AtlasData {
  if (atlas) return atlas;
  const file = path.resolve(import.meta.dirname, '../public/data/atlas.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    places: Place[];
    provinces: ProvincesFC;
    eez: EezFC;
  };
  atlas = {
    places: raw.places,
    byId: new Map(raw.places.map((p) => [p.id, p])),
    provinces: raw.provinces,
    provById: new Map(raw.provinces.features.map((f) => [f.properties.id, f.properties])),
    eez: raw.eez,
  };
  return atlas;
}

export function place(id: string, lat: number, lng: number, cat: CategoryId = 'volcanes'): Place {
  const p: Place = {
    id,
    cat,
    lat,
    lng,
    prov: 'sanjose' as ProvinceId,
    name: { es: id, en: id },
    desc: { es: '', en: '' },
  };
  return p;
}

export function atPlusKm(origin: [number, number], kmNorth: number): [number, number] {
  return [origin[0] + kmNorth / 111.19492664455873, origin[1]];
}
