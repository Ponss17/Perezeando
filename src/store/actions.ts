import { getApp } from './useApp';
import type { Tab } from '../data/types';
import { isMobile } from '../lib/selectors';
import { setSheet, setTab, select, showProvince, deselect, setCat, setProv } from './selection';
import { fitRoute } from './trip';
import { setBase } from './tools';

export { catName, catOne, provName } from './labels';

export {
  setSheet,
  setTab,
  select,
  showProvince,
  deselect,
  closeDetail,
  setProv,
  setCat,
  toggleCat,
  toggleGroup,
  layersAll,
  layersNone,
  clearFilters,
  surprise,
  nearbyOf,
  openNearbyExplore,
} from './selection';

export {
  toggleFav,
  setRoute,
  toggleDayStart,
  sleepInTown,
  toggleRoute,
  moveStop,
  optimizeRoute,
  fitRoute,
  routeWithFavs,
  exportGpx,
} from './trip';

export {
  setBase,
  toggleOv,
  toggle3d,
  togglePanel,
  dismissNotice,
  retryLocate,
  locate,
  share,
  doPrint,
  toggleNight,
  toggleMeasure,
  addMeasurePoint,
} from './tools';

export function openTab(tab: Tab) {
  setTab(tab);
  if (tab === 'route') fitRoute();
  if (isMobile() && getApp().sheet === 'peek') setSheet('half');
}

if (typeof location !== 'undefined' && location.search.includes('e2e'))
  (window as unknown as { __cract: unknown }).__cract = {
    showProvince,
    select,
    setCat,
    setProv,
    deselect,
    setBase,
  };
