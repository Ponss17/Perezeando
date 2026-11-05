import { CATEGORIES } from '../../data/config';
import type { Lang, Place } from '../../data/types';
import { pick } from '../../i18n';

/** Puntos visibles del mapa, con el nombre en el idioma activo */
export function placeCollection(places: Place[], lang: Lang, favs: Set<string>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: places.map((p, i) => ({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        cat: p.cat,
        fav: favs.has(p.id),
        name: pick(lang, p.name),
        catLabel: pick(lang, CATEGORIES[p.cat].one),
        order: favs.has(p.id) ? 1 : 0,
      },
    })),
  };
}

/** Trazados (ríos, áreas, costa) de esos mismos lugares */
export function geomCollection(places: Place[], lang: Lang): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: places
      .filter((p) => p.geometry)
      .map((p) => {
        const color = CATEGORIES[p.cat].color;
        const marine = p.cat === 'isras' || p.cat === 'immas';
        return {
          type: 'Feature' as const,
          geometry: p.geometry!,
          properties: {
            id: p.id,
            name: pick(lang, p.name),
            catLabel: pick(lang, CATEGORIES[p.cat].one),
            color,
            lcolor: p.cat === 'rios' ? '#8cc3e8' : color,
            poly: p.geometry!.type === 'Polygon' ? 1 : 0,
            marine: marine ? 1 : 0,
            dashed: p.cat === 'submarinas' ? 1 : 0,
            op: marine ? 0.1 : 0.18,
            w: 2,
          },
        };
      }),
  };
}
