import type { LineString, Polygon, FeatureCollection, MultiLineString, MultiPolygon } from 'geojson';

export type Lang = 'es' | 'en';
export type LocalizedText = Record<Lang, string>;

export const CATEGORY_IDS = [
  'volcanes',
  'cerros',
  'parques',
  'bosques',
  'cataratas',
  'rios',
  'islas',
  'playas',
  'faunaTerrestre',
  'fauna',
  'ciudades',
  'hitos',
  'datos',
  'museos',
  'iglesias',
  'arqueologia',
  'deportes',
  'surf',
  'gastronomia',
  'hitosOceanicos',
  'submarinas',
  'isras',
  'immas',
  'aeropuertos',
  'puertos',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const PROVINCE_IDS = [
  'sanjose',
  'alajuela',
  'cartago',
  'heredia',
  'guanacaste',
  'puntarenas',
  'limon',
] as const;
export type ProvinceId = (typeof PROVINCE_IDS)[number];
/** 'mar' = mar territorial (pseudo-provincia) */
export type PlaceProvince = ProvinceId | 'mar';
export type ProvinceFilter = PlaceProvince | 'all';

export interface Category {
  id: CategoryId;
  icon: string;
  color: string;
  name: LocalizedText;
  one: LocalizedText;
}

export interface CategoryGroup {
  id: string;
  label: LocalizedText;
  cats: CategoryId[];
}

export interface PlaceImage {
  src: string;
  page?: string;
  artist?: string;
  license?: string;
}

export interface PlaceFacts {
  alt?: string;
  area?: string;
  depth?: string;
  year?: LocalizedText;
  tag?: LocalizedText;
  capital?: boolean;
}

/** Fuente citada (chip con enlace) */
export interface SourceRef {
  name: string;
  url: string;
  license?: string;
}

/** Datos extra por lugar generados por scripts/fetch-content.mjs */
export interface PlaceExtra {
  qid?: string;
  elev?: number;
  inception?: string;
  area?: number;
  pop?: number;
  web?: string;
  her?: LocalizedText;
  voy?: Partial<LocalizedText>;
  sinac?: string;
  img?: PlaceImage;
}

/** apodo y gentilicio, solo con fuente verificable */
export interface Nick {
  nickname?: string;
  popularNickname?: string;
  demonym?: string;
  popularDemonym?: string;
  src: string;
}

export interface Place {
  id: string;
  cat: CategoryId;
  /** otras categorías en las que también aparece (p. ej. una playa que es spot de surf) */
  also?: CategoryId[];
  /** datos de surf cuando la playa es rompiente conocida */
  surf?: { name?: string; osm?: string };
  prov: PlaceProvince;
  lat: number;
  lng: number;
  name: LocalizedText;
  desc: LocalizedText;
  wiki?: Partial<LocalizedText>;
  facts?: PlaceFacts;
  img?: PlaceImage;
  link?: string;
  geometry?: LineString | Polygon;
  /** origen del registro: curado a mano o importado de Wikidata */
  src?: 'wikidata' | 'osm';
  /** elemento de OpenStreetMap ("node/123") */
  osm?: string;
  q?: string;
  x?: PlaceExtra;
  nick?: Nick;
}

export interface ProvinceProps {
  id: ProvinceId;
  name: string;
  capital: string;
  area: number;
  cantones: number;
  color?: string;
  iso?: string;
  wiki?: Partial<LocalizedText>;
  img?: PlaceImage;
  nick?: Nick;
}

export type ProvincesFC = FeatureCollection<Polygon | MultiPolygon, ProvinceProps>;
export type EezFC = FeatureCollection<
  MultiLineString,
  { id: string; kind: 'eez' | 'mma'; name_es: string; name_en: string }
>;

export interface Basemap {
  id: BasemapId;
  name: LocalizedText;
  tiles: string[];
  max: number;
  attr: string;
  labels?: string;
  dark?: boolean;
  thumb: string;
  preview: string;
}
export type BasemapId = 'voyager' | 'osm' | 'satellite' | 'topo' | 'dark';

export interface Overlays {
  prov: boolean;
  eez: boolean;
  hill: boolean;
  cluster: boolean;
}

export type Tab = 'explore' | 'layers' | 'route' | 'favs';
export type Selection = { kind: 'place'; id: string } | { kind: 'province'; id: ProvinceId };
export type SheetState = 'peek' | 'half' | 'full';
export type LatLng = [number, number];

export interface RouteLeg {
  d: number; // km
  t: number; // s
}
export interface RouteResult {
  key: string;
  mode: 'osrm' | 'fallback';
  distance: number;
  duration: number;
  legs: RouteLeg[];
  /** [lng, lat] */
  line: [number, number][];
  offroad: boolean[];
}

/* ----------------------------------------- contenido por provincia (build) */
export interface ContentText {
  section?: string;
  text: string;
  src: SourceRef;
}
export interface ContentItem {
  qid?: string;
  id?: string;
  name: LocalizedText | string;
  img?: PlaceImage;
  her?: LocalizedText;
  venue?: string;
  leagues?: string[];
  scope?: 'regional' | 'national';
  /** una línea que explica el plato (comidas curadas por provincia) */
  note?: LocalizedText;
  /** escudo/logo: miniatura enlazada (no alojada aquí) */
  crest?: { src: string; page: string; from: 'commons' | 'wikipedia'; artist?: string; license?: string };
  /** 1 = Primera División */
  tier?: number;
  src?: SourceRef;
}
export interface ProvinceContent {
  facts: { qid?: string; pop?: number; popYear?: string; area?: number; capital?: string; envoy?: string; esvoy?: string; src?: SourceRef };
  food: { intro: ContentText[]; items: ContentItem[]; voy: Partial<Record<Lang, ContentText>>; drink: Partial<Record<Lang, ContentText>> };
  culture: { wiki: ContentText | null; heritage: ContentItem[]; museums: ContentItem[]; churches: ContentItem[]; archaeology: ContentItem[]; voy: Partial<Record<Lang, ContentText>> };
  sports: { clubs: ContentItem[]; stadiums: ContentItem[]; surf: (ContentItem & { lat: number; lng: number })[]; voy: Partial<Record<Lang, ContentText>> };
}
