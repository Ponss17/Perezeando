import type { Basemap, BasemapId, Category, CategoryGroup, CategoryId, Overlays } from './types';
import { CATEGORY_IDS, PROVINCE_IDS } from './types';

const c = (
  id: CategoryId,
  icon: string,
  color: string,
  es: string,
  en: string,
  oneEs: string,
  oneEn: string,
): Category => ({
  id,
  icon,
  color,
  name: { es, en },
  one: { es: oneEs, en: oneEn },
});

export const CATEGORIES: Record<CategoryId, Category> = {
  volcanes: c('volcanes', 'volcano', '#a4473a', 'Volcanes', 'Volcanoes', 'Volcán', 'Volcano'),
  cerros: c('cerros', 'mountain', '#6f6a3e', 'Cerros y montañas', 'Peaks & mountains', 'Cerro', 'Peak'),
  parques: c(
    'parques',
    'trees',
    '#2e7d4f',
    'Parques nacionales',
    'National parks',
    'Parque nacional',
    'National park',
  ),
  bosques: c('bosques', 'tree-pine', '#5f8f45', 'Bosques', 'Forests', 'Bosque', 'Forest'),
  cataratas: c('cataratas', 'droplets', '#3593b8', 'Cataratas', 'Waterfalls', 'Catarata', 'Waterfall'),
  rios: c('rios', 'waves', '#3b62b0', 'Ríos', 'Rivers', 'Río', 'River'),
  islas: c('islas', 'tree-palm', '#1f8a78', 'Islas', 'Islands', 'Isla', 'Island'),
  playas: c('playas', 'sun', '#a87a22', 'Playas', 'Beaches', 'Playa', 'Beach'),
  faunaTerrestre: c(
    'faunaTerrestre',
    'paw-print',
    '#a0602c',
    'Fauna terrestre',
    'Land wildlife',
    'Fauna terrestre',
    'Land wildlife',
  ),
  fauna: c('fauna', 'fish', '#0284c7', 'Fauna marina', 'Marine wildlife', 'Fauna marina', 'Marine wildlife'),
  ciudades: c('ciudades', 'building-2', '#386641', 'Ciudades y pueblos', 'Cities & towns', 'Ciudad', 'City'),
  hitos: c(
    'hitos',
    'landmark',
    '#bc4749',
    'Hitos históricos',
    'Historic landmarks',
    'Hito histórico',
    'Historic landmark',
  ),
  datos: c('datos', 'lightbulb', '#8a7f22', 'Datos curiosos', 'Fun facts', 'Dato curioso', 'Fun fact'),
  hitosOceanicos: c(
    'hitosOceanicos',
    'shell',
    '#0e7490',
    'Hitos oceánicos',
    'Ocean highlights',
    'Hito oceánico',
    'Ocean highlight',
  ),
  submarinas: c(
    'submarinas',
    'activity',
    '#6366f1',
    'Relieve submarino',
    'Undersea relief',
    'Relieve submarino',
    'Undersea feature',
  ),
  isras: c(
    'isras',
    'shield',
    '#059669',
    'ISRA (tiburones y rayas)',
    'ISRA (sharks & rays)',
    'Área ISRA',
    'ISRA area',
  ),
  immas: c(
    'immas',
    'sailboat',
    '#1d4ed8',
    'IMMA (mamíferos marinos)',
    'IMMA (marine mammals)',
    'Área IMMA',
    'IMMA area',
  ),
  aeropuertos: c('aeropuertos', 'plane', '#68737a', 'Aeropuertos', 'Airports', 'Aeropuerto', 'Airport'),
  museos: c('museos', 'library', '#7a5a3f', 'Museos', 'Museums', 'Museo', 'Museum'),
  iglesias: c('iglesias', 'church', '#a07d5c', 'Iglesias y templos', 'Churches', 'Iglesia', 'Church'),
  arqueologia: c(
    'arqueologia',
    'pickaxe',
    '#8c6a3c',
    'Sitios arqueológicos',
    'Archaeological sites',
    'Sitio arqueológico',
    'Archaeological site',
  ),
  deportes: c(
    'deportes',
    'trophy',
    '#7d5260',
    'Estadios y deporte',
    'Stadiums & sport',
    'Estadio',
    'Stadium',
  ),
  surf: c('surf', 'surfboard', '#0e7a7a', 'Surf', 'Surf', 'Spot de surf', 'Surf spot'),
  gastronomia: c(
    'gastronomia',
    'utensils',
    '#b8613d',
    'Gastronomía',
    'Food & markets',
    'Gastronomía',
    'Food spot',
  ),
  puertos: c('puertos', 'anchor', '#3a4a5c', 'Puertos', 'Ports', 'Puerto', 'Port'),
};

export const CATEGORY_ORDER = CATEGORY_IDS;

export const GROUPS: CategoryGroup[] = [
  {
    id: 'naturaleza',
    label: { es: 'Naturaleza', en: 'Nature' },
    cats: ['volcanes', 'cerros', 'parques', 'bosques', 'cataratas', 'rios', 'islas', 'playas'],
  },
  { id: 'fauna', label: { es: 'Fauna', en: 'Wildlife' }, cats: ['faunaTerrestre', 'fauna'] },
  {
    id: 'cultura',
    label: { es: 'Cultura e historia', en: 'Culture & history' },
    cats: ['ciudades', 'hitos', 'iglesias', 'museos', 'arqueologia', 'datos'],
  },
  {
    id: 'mar',
    label: { es: 'Mar territorial', en: 'Territorial sea' },
    cats: ['hitosOceanicos', 'submarinas', 'isras', 'immas'],
  },
  { id: 'deportes', label: { es: 'Deporte', en: 'Sport' }, cats: ['deportes', 'surf'] },
  { id: 'gastronomia', label: { es: 'Gastronomía', en: 'Food' }, cats: ['gastronomia'] },
  { id: 'transporte', label: { es: 'Transporte', en: 'Transport' }, cats: ['aeropuertos', 'puertos'] },
];

/** Lenguaje de formas: naturaleza y fauna = círculo, cultura y transporte = cuadrado, mar = rombo */
export type MarkerShape = 'circle' | 'square' | 'diamond';
const SHAPE_BY_GROUP: Record<string, MarkerShape> = {
  naturaleza: 'circle',
  fauna: 'circle',
  cultura: 'square',
  transporte: 'square',
  deportes: 'square',
  gastronomia: 'square',
  mar: 'diamond',
};
export const CAT_SHAPE = Object.fromEntries(
  GROUPS.flatMap((g) => g.cats.map((c) => [c, SHAPE_BY_GROUP[g.id] ?? 'circle'])),
) as Record<CategoryId, MarkerShape>;

export const DEFAULT_OFF: CategoryId[] = ['isras', 'immas', 'submarinas'];
export const DEFAULT_ACTIVE: CategoryId[] = CATEGORY_IDS.filter((x) => !DEFAULT_OFF.includes(x));
export const DEFAULT_OVERLAYS: Overlays = { prov: true, eez: true, hill: false, cluster: true };
export const DEFAULT_BASE: BasemapId = 'satellite';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
export const BASEMAPS: Record<BasemapId, Basemap> = {
  voyager: {
    id: 'voyager',
    name: { es: 'Calles', en: 'Streets' },
    tiles: [ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
    max: 19,
    attr: 'Mapa © Esri, HERE, Garmin',
    thumb: '#e8e4da',
    preview: ESRI + 'World_Street_Map/MapServer/tile/7/61/34',
  },
  osm: {
    id: 'osm',
    name: { es: 'OSM clásico', en: 'OSM classic' },
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    max: 19,
    attr: '',
    thumb: '#f2efe9',
    preview: 'https://tile.openstreetmap.org/7/34/61.png',
  },
  satellite: {
    id: 'satellite',
    name: { es: 'Satélite', en: 'Satellite' },
    tiles: [ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    max: 17, // en zonas rurales Esri no tiene z18+ (404 sin CORS): se amplía el 17
    attr: 'Imágenes © Esri, Maxar, Earthstar Geographics',
    labels: ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    thumb: '#2f4a2a',
    dark: true,
    preview: ESRI + 'World_Imagery/MapServer/tile/7/61/34',
  },
  topo: {
    id: 'topo',
    name: { es: 'Relieve', en: 'Topographic' },
    tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
    max: 17,
    attr: 'SRTM · © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    thumb: '#d9e3c4',
    preview: 'https://a.tile.opentopomap.org/7/34/61.png',
  },
  dark: {
    id: 'dark',
    name: { es: 'Oscuro', en: 'Dark' },
    tiles: [ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
    max: 16,
    attr: 'Mapa © Esri, HERE, Garmin',
    thumb: '#1f2430',
    dark: true,
    preview: ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/7/61/34',
  },
};
export const BASEMAP_IDS = Object.keys(BASEMAPS) as BasemapId[];

export const ENDPOINTS = {
  terrain: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  osrm: 'https://router.project-osrm.org/route/v1/driving/',
  /** Tipografías SDF para etiquetas del mapa (OpenFreeMap, sin clave) */
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
};

export { PROVINCE_IDS };

/** Límites aproximados de Costa Rica [[w,s],[e,n]] — más tierra, menos Pacífico vacío */
export const CR_BOUNDS: [[number, number], [number, number]] = [
  [-85.95, 8.05],
  [-82.55, 11.15],
];
/** Límite de navegación del mapa: tierra firme + Isla del Coco + ZEE, con margen [[w,s],[e,n]] */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-91.5, 2.8],
  [-80.5, 12.6],
];
/** Posición de las etiquetas de provincia (solo se muestran en el mapa oscuro) */
export const PROVINCE_LABELS: Record<string, [number, number]> = {
  sanjose: [9.47, -83.88],
  alajuela: [10.6, -84.55],
  cartago: [9.76, -83.62],
  heredia: [10.42, -84.05],
  guanacaste: [10.48, -85.35],
  puntarenas: [8.95, -83.35],
  limon: [10.0, -83.4],
};

export const MOBILE_QUERY = '(max-width: 760px)';
