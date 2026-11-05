import { create } from 'zustand';

/** Estado de red y de actualización (service worker) */
export const useNet = create<{ online: boolean; update: boolean }>(() => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  update: false,
}));

let waiting: ServiceWorker | null = null;
let reloading = false;

/** El usuario tocó «Actualizar»: activa la versión en espera y recarga una sola vez. */
export function applyUpdate() {
  if (!waiting) return location.reload();
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  waiting.postMessage('skipWaiting');
}

export function initNet() {
  const set = () => useNet.setState({ online: navigator.onLine });
  addEventListener('online', set);
  addEventListener('offline', set);
}

/** Solo en producción (main.tsx). `?nosw` desinstala el SW y borra sus cachés. */
export async function initSW() {
  if (!('serviceWorker' in navigator)) return;
  if (new URLSearchParams(location.search).has('nosw')) {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) if (k.startsWith('pz-')) await caches.delete(k);
    console.info('[sw] desinstalado (?nosw)');
    return;
  }
  const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' });
  const offer = (w: ServiceWorker | null) => {
    // solo si ya hay una versión controlando la página (en la primera visita no hay nada que actualizar)
    if (!w || !navigator.serviceWorker.controller) return;
    waiting = w;
    useNet.setState({ update: true });
  };
  if (reg.waiting) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => w.state === 'installed' && offer(w));
  });
  // sin sondeos: se revisa sw.js (pocos bytes, no-cache) al volver a la pestaña, como mucho cada hora
  let last = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - last > 36e5) {
      last = Date.now();
      reg.update().catch(() => {});
    }
  });
}
