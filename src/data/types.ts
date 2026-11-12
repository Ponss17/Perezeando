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
type PlaceProvince = ProvinceId | 'mar';
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
  allowRemote?: boolean;
}

interface PlaceFacts {
  alt?: string;
  area?: string;
  depth?: string;
  year?: LocalizedText;
  tag?: LocalizedText;
  capital?: boolean;
}

interface SourceRef {
  name: string;
  url: string;
  license?: string;
}

interface PlaceExtra {
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
  also?: CategoryId[];
  surf?: { name?: string; osm?: string };
  prov: PlaceProvince;
  lat: number;
  lng: number;
  name: LocalizedText;
  desc: LocalizedText;
  descSrc?: SourceRef;
  wiki?: Partial<LocalizedText>;
  facts?: PlaceFacts;
  img?: PlaceImage;
  link?: string;
  geometry?: LineString | Polygon;
  src?: 'wikidata' | 'osm';
  osm?: string;
  q?: string;
  x?: PlaceExtra;
  nick?: Nick;
  related?: string[];
  tips?: { view?: LocalizedText; care?: LocalizedText };
  group?: 'mammal' | 'bird' | 'reptile' | 'amphibian' | 'insect' | 'marine';
  visit?: {
    access?: LocalizedText;
    activities?: LocalizedText;
    difficulty?: LocalizedText;
    note?: LocalizedText;
    season?: LocalizedText;
    services?: LocalizedText;
    fromSjo?: LocalizedText;
    nearestCity?: LocalizedText;
    src?: SourceRef;
  };
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

interface RouteLeg {
  d: number; // km
  t: number; // s
}
export interface RouteResult {
  key: string;
  mode: 'osrm' | 'fallback';
  distance: number;
  duration: number;
  legs: RouteLeg[];
  line: [number, number][];
  offroad: boolean[];
}

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
  note?: LocalizedText;
  crest?: { src: string; page: string; from: 'commons' | 'wikipedia'; artist?: string; license?: string };
  tier?: number;
  src?: SourceRef;
}
export interface ProvinceContent {
  activities?: { items?: ContentItem[]; note?: LocalizedText };
  facts: {
    qid?: string;
    pop?: number;
    popYear?: string;
    area?: number;
    capital?: string;
    envoy?: string;
    esvoy?: string;
    src?: SourceRef;
  };
  food: {
    intro: ContentText[];
    items: ContentItem[];
    voy: Partial<Record<Lang, ContentText>>;
    drink: Partial<Record<Lang, ContentText>>;
  };
  culture: {
    wiki: ContentText | null;
    heritage: ContentItem[];
    museums: ContentItem[];
    churches: ContentItem[];
    archaeology: ContentItem[];
    voy: Partial<Record<Lang, ContentText>>;
  };
  sports: {
    clubs: ContentItem[];
    stadiums: ContentItem[];
    surf: (ContentItem & { lat: number; lng: number })[];
    voy: Partial<Record<Lang, ContentText>>;
  };
}
