import { create } from 'zustand';

/** Estado de red y de actualización (service worker) */
export const useNet = create<{ online: boolean; update: boolean }>(() => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  update: false,
}));

let waiting: ServiceWorker | null = null;
let reloading = false;
const RECOVERY_KEY = 'pz-sw-recovery';

function reloadOnce() {
  if (reloading) return;
  reloading = true;
  location.reload();
}

/** El usuario tocó «Actualizar»: activa la versión en espera y recarga una sola vez. */
export function applyUpdate() {
  if (!waiting) return reloadOnce();
  waiting.postMessage('skipWaiting');
}

async function hardRecover() {
  try {
    if (sessionStorage.getItem(RECOVERY_KEY)) return;
    sessionStorage.setItem(RECOVERY_KEY, '1');
  } catch {
    /* private mode */
  }
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) if (k.startsWith('pz-')) await caches.delete(k);
  } catch {
    /* ignore */
  }
  reloadOnce();
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

  // si ya había un SW controlando y entra uno nuevo → recargar para alinear HTML y assets
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    reloadOnce();
  });

  const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {
    updateViaCache: 'none',
  });
  const offer = (w: ServiceWorker | null) => {
    if (!w || !navigator.serviceWorker.controller) return;
    waiting = w;
    useNet.setState({ update: true });
    // en móvil no siempre tocan «Actualizar»: activar solo
    w.postMessage('skipWaiting');
  };
  if (reg.waiting) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => w.state === 'installed' && offer(w));
  });

  let last = 0;
  const check = () => {
    if (Date.now() - last < 3e4) return;
    last = Date.now();
    reg.update().catch(() => {});
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'asset-missing') return;
    if (reg.waiting) applyUpdate();
    else void hardRecover();
  });
  check();
  // solo liberar el candado tras una carga estable (si no, un 404 al arrancar entra en bucle)
  setTimeout(() => {
    try {
      sessionStorage.removeItem(RECOVERY_KEY);
    } catch {
      /* ignore */
    }
  }, 15000);
}
