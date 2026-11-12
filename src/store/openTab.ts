import { getApp } from './useApp';
import type { Tab } from '../data/types';
import { isMobile } from '../lib/selectors';
import { setSheet, setTab } from './selection';
import { fitRoute } from './trip';

export function openTab(tab: Tab) {
  setTab(tab);
  if (tab === 'route') fitRoute();
  if (isMobile() && getApp().sheet === 'peek') setSheet('half');
}
