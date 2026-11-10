import { create } from 'zustand';
import type {
  ContentItem,
  EezFC,
  Place,
  ProvinceContent,
  ProvinceId,
  ProvinceProps,
  ProvincesFC,
} from './types';

export interface AtlasData {
  places: Place[];
  byId: Map<string, Place>;
  provinces: ProvincesFC;
  provById: Map<ProvinceId, ProvinceProps>;
  eez: EezFC;
}

interface DataState {
  data: AtlasData | null;
  error: string | null;
}

/** Datos estáticos (JSON en /public/data) cargados de forma diferida */
export const useData = create<DataState>(() => ({ data: null, error: null }));

const url = (f: string) => import.meta.env.BASE_URL + 'data/' + f;

async function getJson<T>(f: string): Promise<T> {
  const r = await fetch(url(f));
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

let loading: Promise<AtlasData> | null = null;

export function loadData(): Promise<AtlasData> {
  if (!loading) {
    // un solo archivo compacto (scripts/build-data.mjs): lugares + enriquecimiento + provincias + ZEE
    loading = getJson<{ places: Place[]; provinces: ProvincesFC; eez: EezFC }>('atlas.json').then(
      ({ places, provinces, eez }) => {
        const data: AtlasData = {
          places,
          byId: new Map(places.map((p) => [p.id, p])),
          provinces,
          provById: new Map(provinces.features.map((f) => [f.properties.id, f.properties])),
          eez,
        };
        useData.setState({ data });
        return data;
      },
    );
    loading.catch((e: unknown) => useData.setState({ error: String(e) }));
  }
  return loading;
}

/* ------------------------------ trazados de rutas y áreas (diferidos) */
export const useGeoms = create<{ ready: boolean }>(() => ({ ready: false }));
let geomsP: Promise<void> | null = null;
/** Pide geoms.json y lo cuelga de cada lugar; se llama cuando el mapa ya se pintó */
export function loadGeoms() {
  if (!geomsP) {
    geomsP = Promise.all([loadData(), getJson<Record<string, Place['geometry']>>('geoms.json')]).then(
      ([d, g]) => {
        for (const id in g) {
          const p = d.byId.get(id);
          if (p) p.geometry = g[id];
        }
        useGeoms.setState({ ready: true });
      },
    );
    geomsP.catch(() => (geomsP = null));
  }
  return geomsP;
}

/** Acceso síncrono (solo después de cargar) */
export const getData = () => useData.getState().data;

/* --------------------------------------- contenido por provincia (diferido) */
let contentP: Promise<Record<ProvinceId, ProvinceContent>> | null = null;
export const useContent = create<{
  content: Record<ProvinceId, ProvinceContent> | null;
  national: ContentItem[];
  orgs: ContentItem[];
}>(() => ({ content: null, national: [], orgs: [] }));
export function loadContent() {
  if (!contentP) {
    contentP = getJson<{
      provinces: Record<ProvinceId, ProvinceContent>;
      national?: { food: ContentItem[]; orgs?: ContentItem[] };
    }>('provinces-content.json').then((d) => {
      useContent.setState({
        content: d.provinces,
        national: d.national?.food ?? [],
        orgs: d.national?.orgs ?? [],
      });
      return d.provinces;
    });
    contentP.catch(() => (contentP = null));
  }
  return contentP;
}
