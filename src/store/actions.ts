import { select, showProvince, deselect, setCat, setProv } from './selection';
import { setBase, locate } from './tools';

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

export { openTab } from './openTab';

if (typeof location !== 'undefined' && location.search.includes('e2e'))
  (window as unknown as { __cract: unknown }).__cract = {
    showProvince,
    select,
    setCat,
    setProv,
    deselect,
    setBase,
    locate,
  };
