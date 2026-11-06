const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const DATA = __DATA__;

const SHELL_CACHE = 'pz-shell-' + VERSION;
const DATA_CACHE = 'pz-data-v1';
const TILE_CACHE = 'pz-tiles-v1';
const IMG_CACHE = 'pz-img-v1';
const ROUTE_CACHE = 'pz-route-v1';
const KEEP = [SHELL_CACHE, DATA_CACHE, TILE_CACHE, IMG_CACHE, ROUTE_CACHE];
const DAY = 864e5;
const LIMITS = {
  [TILE_CACHE]: { max: 2000, age: 30 * DAY },
  [IMG_CACHE]: { max: 400, age: 30 * DAY },
  [ROUTE_CACHE]: { max: 30, age: DAY / 24 },
};
const TILE_HOSTS =
  /(^|\.)(arcgisonline\.com|tile\.openstreetmap\.org|tile\.opentopomap\.org|tiles\.openfreemap\.org|elevation-tiles-prod\.s3\.amazonaws\.com)$|^s3\.amazonaws\.com$/;
const IMG_HOSTS = /^(upload|thumb)\.wikimedia\.org$/;
/* hostname de VITE_MEDIA_BASE_URL (inyectado en build); vacío = sin remoto */
const MEDIA_HOST = '__MEDIA_HOST__';
const OSRM_HOST = /^router\.project-osrm\.org$/;

const scope = new URL(self.registration.scope);
const rel = (u) =>
  u.origin === scope.origin && u.pathname.startsWith(scope.pathname)
    ? u.pathname.slice(scope.pathname.length)
    : null;

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(SHELL_CACHE);
      await c.addAll(
        SHELL.map(
          (p) =>
            new Request(new URL(p, scope), { cache: p.startsWith('assets/') ? 'force-cache' : 'no-cache' }),
        ),
      );
      const dc = await caches.open(DATA_CACHE);
      await Promise.all(
        Object.entries(DATA).map(async ([p, h]) => {
          const req = new Request(new URL(p, scope));
          const hit = await dc.match(req);
          if (hit && hit.headers.get('sw-hash') === h) return;
          try {
            const res = await fetch(req, { cache: 'force-cache' });
            if (res.ok) await dc.put(req, await stamp(res, { 'sw-hash': h }));
          } catch {}
        }),
      );
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys())
        if (k.startsWith('pz-') && !KEEP.includes(k)) await caches.delete(k);
      const dc = await caches.open(DATA_CACHE);
      for (const r of await dc.keys()) {
        const p = rel(new URL(r.url));
        if (p && !(p in DATA)) await dc.delete(r);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

const stamp = async (res, extra = {}) => {
  const h = new Headers(res.headers);
  h.set('sw-time', String(Date.now()));
  for (const k in extra) h.set(k, extra[k]);
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: h });
};
const age = (res) => Date.now() - Number(res.headers.get('sw-time') || 0);

const trimming = {};
function trim(name) {
  if (trimming[name]) return;
  trimming[name] = setTimeout(async () => {
    trimming[name] = 0;
    const c = await caches.open(name);
    const keys = await c.keys();
    const extra = keys.length - LIMITS[name].max;
    if (extra <= 0) return;
    const ranked = await Promise.all(
      keys.map(async (req) => {
        const res = await c.match(req);
        return [Number(res && res.headers.get('sw-time')) || 0, req];
      }),
    );
    ranked.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < extra; i++) await c.delete(ranked[i][1]);
  }, 4000);
}

async function cacheFirstCapped(e, name, req) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const lim = LIMITS[name];
  if (hit && age(hit) < lim.age) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type !== 'opaque') {
      e.waitUntil(
        stamp(res.clone())
          .then((r) => c.put(req, r))
          .then(() => trim(name))
          .catch(() => {}),
      );
    }
    return res;
  } catch (err) {
    if (hit) return hit;
    throw err;
  }
}

async function shell(req, path, { networkFirst = false } = {}) {
  const c = await caches.open(SHELL_CACHE);
  const url = new URL(path, scope).href;
  const hit = await c.match(url, { ignoreSearch: true });
  const fromNet = async () => {
    const res = await fetch(path === 'index.html' ? new Request(url, { cache: 'no-cache' }) : req);
    if (res.ok) {
      try {
        await c.put(url, res.clone());
      } catch {}
    }
    return res;
  };
  if (networkFirst) {
    try {
      const res = await fromNet();
      if (res.ok) return res;
      if (hit) return hit;
      return res;
    } catch (err) {
      if (hit) return hit;
      throw err;
    }
  }
  if (hit) return hit;
  return fromNet();
}

async function data(e, req, path) {
  const c = await caches.open(DATA_CACHE);
  const want = DATA[path];
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit && want && hit.headers.get('sw-hash') === want) return hit;
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) e.waitUntil(stamp(res.clone(), { 'sw-hash': want || '' }).then((r) => c.put(req, r)));
    return res;
  } catch (err) {
    if (hit) return hit;
    throw err;
  }
}

async function route(req) {
  const c = await caches.open(ROUTE_CACHE);
  try {
    const res = await fetch(req, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      await c.put(req, await stamp(res.clone()));
      trim(ROUTE_CACHE);
    }
    return res;
  } catch (err) {
    const hit = await c.match(req);
    if (hit && age(hit) < LIMITS[ROUTE_CACHE].age) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const path = rel(u);

  if (req.mode === 'navigate' && path !== null) {
    if (u.searchParams.has('nosw')) return;
    if (path === 'robots.txt' || path === 'llms.txt' || path.startsWith('.well-known/')) return;
    e.respondWith(
      shell(req, 'index.html', { networkFirst: true }).catch(
        () =>
          new Response(
            '<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Perezeando</title><body style="font:16px/1.4 system-ui;padding:24px;background:#13281c;color:#fff"><p>No se pudo abrir el mapa.</p><p><a href="./" style="color:#d4ec8a">Reintentar</a></p></body>',
            { headers: { 'content-type': 'text/html; charset=utf-8' } },
          ),
      ),
    );
    return;
  }
  if (path !== null) {
    if (path === 'sw.js') return;
    if (path.startsWith('data/')) return e.respondWith(data(e, req, path));
    if (SHELL.includes(path)) {
      return e.respondWith(
        (async () => {
          let res;
          try {
            res = await shell(req, path);
          } catch {
            res = await fetch(req);
          }
          if (res.status === 404 && path.startsWith('assets/')) {
            for (const client of await self.clients.matchAll({ type: 'window' })) {
              client.postMessage({ type: 'asset-missing' });
            }
          }
          return res;
        })(),
      );
    }
    return;
  }
  if (TILE_HOSTS.test(u.hostname)) return e.respondWith(cacheFirstCapped(e, TILE_CACHE, req));
  const pathRel = rel(u);
  if (pathRel && pathRel.startsWith('media/')) {
    return e.respondWith(cacheFirstCapped(e, IMG_CACHE, req));
  }
  if (IMG_HOSTS.test(u.hostname) || (MEDIA_HOST && u.hostname === MEDIA_HOST)) {
    const cors = req.mode === 'cors' ? req : new Request(req.url, { mode: 'cors', credentials: 'omit' });
    return e.respondWith(cacheFirstCapped(e, IMG_CACHE, cors).catch(() => fetch(req)));
  }
  if (OSRM_HOST.test(u.hostname)) return e.respondWith(route(req));
});
