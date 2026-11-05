export type GeoIssue = 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'unsupported' | 'outside';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  BasemapId,
  CategoryId,
  Lang,
  LatLng,
  Overlays,
  ProvinceFilter,
  RouteResult,
  Selection,
  SheetState,
  Tab,
} from '../data/types';
import { BASEMAPS, CATEGORIES, DEFAULT_ACTIVE, DEFAULT_BASE, DEFAULT_OVERLAYS } from '../data/config';

export interface AppState {
  // preferencias (persistentes)
  lang: Lang;
  base: BasemapId;
  ov: Overlays;
  panelOpen: boolean;
  favs: string[];
  route: string[];
  /** ids de paradas que abren un día nuevo (la primera nunca) */
  dayStarts: string[];
  night: boolean;
  measure: boolean;
  /** puntos [lng, lat] de la regla, como mucho dos */
  measurePts: [number, number][];
  // filtros / vista
  active: CategoryId[];
  prov: ProvinceFilter;
  cat: CategoryId | 'all';
  query: string;
  near: boolean;
  me: LatLng | null;
  meAcc: number;
  is3d: boolean;
  // UI
  tab: Tab;
  sel: Selection | null;
  detailOpen: boolean;
  sheet: SheetState;
  basemapPop: boolean;
  creditsOpen: boolean;
  locating: boolean;
  toast: { msg: string; n: number } | null;
  /** aviso con acciones (p. ej. errores de ubicación) */
  notice: { kind: 'geo'; code: GeoIssue; n: number } | null;
  // ruta calculada
  routeData: RouteResult | null;
  routeLoading: boolean;
  /** vista inicial pedida por la URL [lat, lng, zoom] */
  initialView: [number, number, number] | null;
}

export const useApp = create<AppState>()(
  persist(
    (): AppState => ({
      lang: 'es' as Lang,
      base: DEFAULT_BASE,
      ov: { ...DEFAULT_OVERLAYS },
      panelOpen: true,
      favs: [] as string[],
      route: [] as string[],
      dayStarts: [] as string[],
      night: false,
      measure: false,
      measurePts: [] as [number, number][],
      active: [...DEFAULT_ACTIVE],
      prov: 'all' as ProvinceFilter,
      cat: 'all' as const,
      query: '',
      near: false,
      me: null,
      meAcc: 0,
      is3d: false,
      tab: 'explore' as Tab,
      sel: null,
      detailOpen: false,
      sheet: 'peek' as SheetState,
      basemapPop: false,
      creditsOpen: false,
      locating: false,
      toast: null,
      notice: null,
      routeData: null,
      routeLoading: false,
      initialView: null,
    }),
    {
      name: 'crmapa.v2',
      version: 3,
      // v2: nuevas categorías (museos, iglesias, arqueología, deportes) visibles para quien ya tenía filtros guardados
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        if (version < 2 && Array.isArray(p.active)) {
          const add: CategoryId[] = ['museos', 'iglesias', 'arqueologia', 'deportes'];
          p.active = [...new Set([...p.active, ...add])];
        }
        // v3: surf y gastronomía (OpenStreetMap)
        if (version < 3 && Array.isArray(p.active)) p.active = [...new Set([...p.active, 'surf', 'gastronomia'] as CategoryId[])];
        return p as AppState;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        lang: s.lang,
        base: s.base,
        ov: s.ov,
        panelOpen: s.panelOpen,
        favs: s.favs,
        route: s.route,
        dayStarts: s.dayStarts,
        night: s.night,
        active: s.active,
      }),
      merge: (persisted, current) => {
        const p = { ...((persisted ?? {}) as Partial<AppState>) };
        // la leyenda flotante ya no existe: descartar su preferencia guardada
        delete (p as Record<string, unknown>).legendOpen;
        return {
          ...current,
          ...p,
          base: p.base && BASEMAPS[p.base] ? p.base : current.base,
          ov: { ...current.ov, ...(p.ov ?? {}) },
          lang: p.lang === 'en' ? 'en' : 'es',
          night: p.night === true,
          dayStarts: Array.isArray(p.dayStarts) ? p.dayStarts.filter((id) => typeof id === 'string') : [],
          // categorías visibles: solo ids válidos (lista vacía = todo oculto, se respeta)
          active: Array.isArray(p.active) ? p.active.filter((c) => c in CATEGORIES) : current.active,
        };
      },
    },
  ),
);

export const setApp = useApp.setState;
export const getApp = useApp.getState;
