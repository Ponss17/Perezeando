type BootFn = () => void;

let mapReady = false;
const waiters = new Set<BootFn>();

export function signalMapReady() {
  if (mapReady) return;
  mapReady = true;
  waiters.forEach((fn) => fn());
  waiters.clear();
}

export function onMapReady(fn: BootFn) {
  if (mapReady) {
    fn();
    return () => {};
  }
  waiters.add(fn);
  return () => waiters.delete(fn);
}

export function isMapReady() {
  return mapReady;
}
