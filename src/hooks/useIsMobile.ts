import { useSyncExternalStore } from 'react';
import { MOBILE_QUERY } from '../data/config';

const mq = () => window.matchMedia(MOBILE_QUERY);
const subscribe = (cb: () => void) => {
  const m = mq();
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

/** true en pantallas ≤ 760 px (hoja inferior en lugar de panel lateral) */
export const useIsMobile = () =>
  useSyncExternalStore(
    subscribe,
    () => mq().matches,
    () => false,
  );
