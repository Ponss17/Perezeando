# Handoff — Perezeando (`cr-mapa-v2`)

**Fecha:** 2026-11-12 (America/Costa_Rica)  
**Proyecto en disco (fuente de verdad):** `D:\zpaginas\cr-mapa-v2`  
**Máquina:** Windows del usuario (Ponss), clone GitHub `https://github.com/Ponss17/Perezeando.git` (`origin/main`)  
**Hosting prod:** Cloudflare Worker assets `perezeando` → https://perezeando.lospherris.workers.dev (`wrangler.toml`, SPA `not_found_handling`)  
**HEAD reciente:** `abccc80` — Imperdibles/Todos + modularización store/mapa/CSS.  
**Trabajo reciente:** agente en disco local (no Cloud Agent).

Este archivo resume el estado real del repo. **No uses** copias viejas del box (`/workspace/cr-mapa*`, zips v35/v36) para sobrescribir `D:\zpaginas\cr-mapa-v2`.

---

## 1. Objetivo

Atlas interactivo **Perezeando**: mapa de consulta de Costa Rica (territorio + mar), rápido, con datos estáticos en build, fotos optimizadas y contenido citado. Prioridad: rendimiento percibido, media liviana, datos con fuente (sin inventar precios/horarios/teléfonos).

---

## 2. Stack actual (package / source)

| Pieza | Versión / nota |
|--------|----------------|
| Paquete | `perezeando` (el Worker de `wrangler.toml` también se llama `perezeando`) |
| Node | `>=22.13` (`engines`); CI usa Node 22 |
| Empaquetado | **pnpm 11.13.1** (`packageManager`) + Vite **8.3.5** |
| Tests | Vitest **5.1** (`pnpm test`, `tests/`, fuera del bundle) |
| UI | React **19.3** + TypeScript ~6 |
| Mapa | MapLibre GL **6.16** (lazy `MapView`) |
| Estado | Zustand **5** |
| Búsqueda | Fuse.js **7.5** |
| Dev útil R2 | `aws4fetch` ^1.0.20 (solo scripts) |

App: Vite + React + TS. Datos JSON generados en `predev`/`prebuild` → `public/data/` (`atlas.json`, `geoms.json`, `provinces-content.json`, `share.json`). Medios en `public/media/{places,food}/*-{120,320,800}.webp`.

**No hay base de datos.** Todo es estático. **R2 es CDN/almacén de imágenes**, no sustituye JSON ni es “backend”.

---

## 3. Cómo correr

```bash
cd D:\zpaginas\cr-mapa-v2
pnpm install
pnpm dev          # predev → build-data + vite
pnpm build        # prebuild → build-data + audit-quality + tsc + vite
pnpm preview
pnpm typecheck
pnpm test         # vitest run (tests/)
pnpm audit-quality
pnpm audit-lang
pnpm audit-remote   # opcional, throttled; no va en build
```

Medios / R2:

```bash
pnpm sync-media              # dry-run (default): cuenta WebP, no sube
pnpm sync-media:upload       # sube (credenciales solo en env)
node scripts/optimize-media.mjs
pnpm fetch-fauna             # build-time fotos fauna → /media
pnpm fetch-photos            # build-time photos.json
```

Producción con R2 (**obligatorio en build de prod**):

```bash
# .env.production está VERSIONADO (solo URL pública CDN; sin secretos)
VITE_MEDIA_BASE_URL=https://pub-409cfb54b50741928198b4469fad8d4e.r2.dev
pnpm build
npx wrangler deploy
```

Sin esa variable el bundle pide `/media` al Worker; el SPA responde HTML → miniaturas rotas.  
`public/media/` sigue gitignored (~50 MB); vive en disco local + R2. Dev: dejar `VITE_MEDIA_BASE_URL` vacío.

---

## 4. Contenido — secuencia desde ~v35 (estado verificado hoy)

Números tomados de `public/data/atlas.json`, `pnpm audit-quality`, `pnpm audit-lang` y reportes en `perf/` (2026-11-05).

| Tema | Antes → ahora / actual |
|------|-------------------------|
| Lugares | **835** (`places-extra` incluye Parque Juan Santamaría) |
| Fauna en mapa | **59** especies (**39** `faunaTerrestre` + **20** `fauna` marina) |
| Visit info | **15** sitios (`data/visitor-info.json`) |
| Actividades cantón/provincia | **18** ítems en 7 provincias (`canton-activities` + merge en provinces-content) |
| Tips / related fauna | **59** / **59** (todas las especies con tips+related) |
| Descripciones ES “en inglés” | **0** (`audit-lang` → `englishOnlyDescEs`) |
| Entradas cortas | **0** `thinUnder50` (antes 273; plantillas honestas + briefs) |
| Wiki EN sin título ES | **60** (`wikiEnWithoutEs`) |
| Actividades cantón | **18** ítems (antes 13) |
| Audit quality | **0** issues (`near-dup` estadios resuelto); `responsiveTokens: true` |

**Fauna:** solo como lugares + filtros del mapa. **No** hay pestaña Fauna en ficha de provincia (se quitó por redundancia).

**Pestañas provincia** (orden):  
`Datos` → `Comida` → `Cultura` → `Deportes` → `Actividades`  
UI: rejilla **3+2** siempre visible (Datos/Comida/Cultura · Deportes/Actividades); activa en verde. Sin scroll.

Enriquecimiento ES: herramientas `enrich-es`, `scripts/data/briefs.json`, `fill-desc`, `data/enrich.json`. `thinUnder50` = **0** (plantillas honestas por categoría + briefs).

---

## 5. Imágenes

### Disco `/public/media`

| Hito | Archivos | Bytes |
|------|----------|-------|
| Opt v36 (reporte `perf/media-optimize-report.md`) | 65 → 189 (62×3 WebP) | ~18.6 MB → ~4.17 MB |
| Tras fauna + 3 tamaños (antes del espejo) | **360** WebP | **~9.75 MB** (ya en R2) |
| **Tras Fase A espejo (2026-11-05 noche)** | **1650** WebP | **~50.5 MB** |
| **Tras Fase B pasada 1** | **1818** WebP | **~55.6 MB** |
| **Tras Fase B + gastro** | **1845** WebP | **~56.5 MB** |

Tres tamaños: `-120`, `-320`, `-800`. Paths: `/media/places/…`, `/media/food/…`, `/media/content/…` (culture/sports).

### Curación en atlas (hoy, post-mirror)

- Lugares con `img` local `/media/…`: **~495+** (0 missing-file; plaza Alajuela + monumento Juan Santamaría reasignados)
- Lugares con `img` remoto: **2** (`fau-lapa-roja`, `fau-ballena-piloto` — URLs Commons 404; siguen `allowRemote`)
- Lugares sin foto: **~340** (114 gastronomía; cataratas/bosques/cerros sin match Commons libre fiable)
- `provinces-content` walk: **192** local / **0** remoto

### Runtime (importante)

En `src/lib/photo.ts` **ya no** hay búsqueda en vivo a Wikipedia/Commons para portadas (`fetchCommonsNear` eliminado; `resolvePhoto` solo usa `p.img` curado).  
`prefetchPhoto` solo precarga `/media` (local o R2).  
**Sí** puede pedirse **texto** Wiki (`fetchWikiSummary`) en la ficha. Créditos/licencias de fotos curadas se mantienen. Sin foto: hero honesto (icono / satélite Esri), no foto ajena inventada.

Scripts de fotos = **build-time** (`mirror-media`, `fetch-photos`, `fetch-fauna-media`, `fetch-media-v36`, `optimize-media`, etc.). No borrarlos “porque hay R2”.

---

## 6. Cloudflare R2

| Ítem | Valor |
|------|--------|
| Bucket | `perezeando` |
| Dominio público gestionado (pruebas) | `https://pub-409cfb54b50741928198b4469fad8d4e.r2.dev` |
| Ejemplo verificado | `…/media/places/000afb7c3c-320.webp` → 200, `image/webp`, `Cache-Control: public, max-age=31536000, immutable` |
| Subida | **Hecha 2026-11-05:** `sync-media:upload` → **1290** nuevos, **360** skipped (mismo size), **0** fail (`total` 1650). Bucket `perezeando` al día con el disco. |

**Código app**

- `VITE_MEDIA_BASE_URL` (público, sin secretos) opcional en prod.
- Default local: vacío → Vite sirve `/media`.
- `src/lib/mediaUrl.ts` + `sizedThumb` / `thumbUrl` anteponen la base.
- SW inyecta `MEDIA_HOST` en build para cachear ese host.
- Antes de sitio en vivo: **dominio propio** (p. ej. `media.tudominio.com`) apuntando al bucket; no depender de `r2.dev` en producción real.

**Sync** — `scripts/sync-media-r2.mjs` (API S3 vía `aws4fetch`):

- Default **dry-run**; `--upload` para subir; **no borra** remotos.
- Env (solo máquina/CI, nunca frontend/repo):  
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (default `perezeando`).
- Token R2 con permiso de objeto **Read/Write** al bucket; no pegar tokens en archivos ni en este handoff.
- Headers al subir: `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`.

R2 **no** es base de datos: solo archivos de imagen. El mapa sigue leyendo JSON local/build.

---

## 7. Diseño / preferencias útiles

- Paleta en uso: `#386641`, `#6A994E`, `#A7C957`, `#DCE8B4`, `#B08968`.
- ES + EN en UI; contenido descriptivo prioriza ES propio (0 descripciones ES calcadas de inglés según audit-lang).
- Datos y fotos con atribución; políticas mencionan Wikipedia/Commons como fuentes complementarias.
- Preferencia de trabajo del dueño: **agente directo sobre `D:\zpaginas\cr-mapa-v2`**, no Cloud Agent de Cursor; **no commit/push** salvo que él lo pida explícito.

---

## 8. Git / working tree

- Rama: `main` tracking `origin/main`.
- Último push relevante: `abccc80` (Imperdibles/Todos + modularización). Antes: `8fb1977` (capas vacías), `05ce5af` (discovery UX).
- `public/media/` sigue gitignored; vive en disco + R2.
- **No resetear, no force-checkout, no pisar con backups viejos del box.**

Backups recientes (Windows Temp), tras inspeccionar nombres:

- `C:\Users\gordi\AppData\Local\Temp\cr-mapa-v2-r2-media-bak-20261105-214230`
- `C:\Users\gordi\AppData\Local\Temp\cr-mapa-v2-no-runtime-wiki-bak-20261105-215800`
- Otros: `pz-r2`, `pz-fauna`, `pz-imgopt`, `pz-v37c`, …

Box (referencia histórica, **no fuente de verdad**):  
`/workspace/cr-mapa-v2-backup-20261105.zip`, `…-v36pre.zip`, `/workspace/cr-mapa-v2`, `/workspace/pz-out/…`.

---

## 9. Perf medido (no exagerar)

S25U / CPU×4 / Slow4G-ish (`perf/FAUNA-PASS-REPORT.md`):

| Métrica | Baseline | After |
|---------|----------|-------|
| Home tReady | 8787 ms | **6215 ms** |
| Home FCP | 1872 ms | **1784 ms** |
| Requests home | 74 | 74 |
| Img bytes home | 198311 | 198311 (sin cambio) |

El home no se “arregló” por R2; el ahorro fuerte de disco fue la pasada WebP. Atlas un poco más grande → net bytes home pueden subir un poco.

Smoke R2 (prod build con `VITE_MEDIA_BASE_URL`): Jaguar hero desde R2; **0** `commons.wikimedia.org/w/api` / geosearch en runtime; texto Wiki sí; lugares sin `img` → satélite/icono, sin discovery de fotos.

---

## 10. Pendiente (sugerencias)

### Hecho (2026-11-05 noche) — Fase A espejo de remotas

Objetivo: traer a `/media` las imágenes **ya curadas** (sin discovery runtime). Las **360** WebP previas en disco/R2 **no se tocaron**; se añadieron variantes nuevas.

| Métrica | Resultado |
|---------|-----------|
| Descargas OK (pasada 1+2) | **413 + 17** (`perf/mirror-remote-media.json`) |
| Fallos | **2** — `fau-lapa-roja`, `fau-ballena-piloto` (HTTP 404 en Commons) |
| Atlas lugares `/media` | **428** local / **2** remoto / **405** sin foto |
| provinces-content | **192** local / **0** remoto |
| Disco | **1650** WebP · **~50.5 MB** |

- Script: `pnpm mirror-media` / `pnpm mirror-media:dry` → `scripts/mirror-remote-media.mjs`  
  Fuentes: `places*.json`, `fauna-extra`, `photos.json`, `photos-hand.json`, `enrich.json`, `places-osm.json`, `provinces-content` (walk anidado).
- **Sync R2:** OK — **1290** subidos, **360** omitidos (ya estaban), **0** fallos. Credenciales en `.env` local (gitignored).
- **No hecho:** Fase B (~405 sin `img`); arreglar las 2 URLs fauna 404.

### Resto (no aprobadas una a una)

1. Reemplazar URLs rotas de `fau-lapa-roja` / `fau-ballena-piloto` y pasarlas a `/media`.
2. ~~Alojar el grueso de remotas curadas~~ → **hecho** (Fase A).
3. Acortar la cola de **273** entradas thin; mejorar los **62** wiki EN sin ES.
4. Ampliar actividades por cantón (hoy starter de 13).
5. Dominio custom para media + hosting prod final (Pages/Workers/etc.) con `.env.production` real.
6. Si prod usa R2: valorar **no empaquetar** `public/media` en el deploy (opt-in); mantener local para dev.
7. ~~Suite de tests automatizados~~ → unitarios con Vitest desde el 2026-11-12 (búsqueda, cercanos, ruta, slugs, `dishKey`, haversine); UI solo con `pnpm e2e`.
8. ~~Resolver `near-dup` estadios~~ → **hecho** (se quitó el estadio viejo `…-q3067683`; queda el actual).
9. **Fase B + cierres (2026-11-06):** fauna `lapa-roja`/`ballena-piloto` en `/media`; Lito Monge sin foto Commons (sí desc). `thinUnder50` → **0**. Actividades **18**. Lugares `/media` **495**/835; **340** sin foto (gastro).

### Hecho (2026-11-06 tarde) — SW móvil, media prod, filtros provincia

| Tema | Qué |
|------|-----|
| SW móvil | `skipWaiting` + reload en `controllerchange`; recuperación dura si asset 404 (`src/lib/sw.ts`, `scripts/sw-template.js`) |
| Fotos en prod | `.env.production` con R2 versionado; Worker **no** sirve `/media` (SPA). Caché: R2 `immutable` 1 año + SW `pz-img-v1` (~400, 30 d) |
| Limpieza | CSS muerto (`.select-wrap`, `.cat-breakdown`, …); `perf/` gitignored; `usableWikiThumb` quitado |
| Filtros provincia | Conteos de categoría/provincia **cruzados** en Explorar + Capas; cats vacías ocultas; `setProv` resetea cat si queda en 0 |
| Límites mapa | Con provincia: solo borde activo **lima** `#d4ec8a` + casco oscuro; resto oscurecido; **sin** overlay Esri `base-labels` (compite). `all` = líneas discontinuas + Esri si `ov.prov` |
| Consola beacon | Errores `cloudflareinsights.com/beacon` = Web Analytics de CF / adblock; **no** es bug del atlas. Desactivar Analytics en el dashboard del Worker si molestan |

Archivos (históricos de esa oleada; mapa sync hoy vive en `syncStyle` / `syncSelection` / `syncExtras`): `ExplorePane.tsx`, `LayersPane.tsx`, `sw.ts`, `sw-template.js`, `.env.production`, `wrangler.toml`.

### Hecho (2026-11-06 noche) — fauna dentro del polígono

- **Problema:** `prov` curado ≠ pin; 24/59 especies fuera del ADM1 de su provincia (filtro por `prov`, no point-in-polygon).
- **Fix terrestre:** `scripts/snap-fauna-prov.mjs` ancla al parque/bosque más cercano **ya en el atlas** (misma `prov`). Actualiza `data/places.json` + `data/fauna-extra.json`.
- **Marina (`cat: fauna`):** no se mueve — anclar a islas/playas las dejaba **en tierra** (p. ej. tiburones encima de Isla del Coco). Se restauraron coords oceánicas originales.
- **Merge:** `build-data` ya no trata fauna apilada sobre un parque como dup a 25 m.

### Hecho (2026-11-08) — publicar + deploy limpio + datos

| Tema | Qué |
|------|-----|
| Deploy limpio | `.assetsignore` + `vite` escribe `dist/.assetsignore` con `media/**` (fotos solo por R2) |
| Estadios | near-dup cerrado; audit-quality **0** |
| Alajuela | P18 del monumento sacado del cantón; cantón → fuente Parque Central (`Plaza_Alajuela_fuente`); **Parque Juan Santamaría** (`ext-…`, Q111089635) con el monumento. `photos-hand` gana sobre img inline |
| Naturaleza fotos | Pasada `fetch-photos`/`fetch-missing-media` (cataratas/bosques/cerros): **0** nuevas — Wikidata `maxlag` + sin pageimage/Commons fiable. Flags `--geo-only` / `--p18-only` / `--only-wiki` |
| R2 | Subidos 3 WebP plaza Alajuela (`ea40e50b85-*`) |
| Local vs remoto | Resuelto tras commit/push/`wrangler deploy` de esta oleada |

**Siguiente (no bloquea):** gastro sin foto; dominio custom media; ~~OG middleware~~ (hecho 2026-11-11 con Worker); tests filtros/`visiblePlaces`.

### Hecho (2026-11-09) — CSS split + mascots Perezeando

| Tema | Qué |
|------|-----|
| CSS modular | `app.css` residual; piezas en `panel.css`, `detail.css`, `route.css`, `toolbar.css`, `overlays.css`, `map.css` (wire en `index.css`). **`theme-overrides.css` eliminado** — overrides absorbidos en los dueños |
| Panel / lista | Scroll + sticky heads opacos; item activo con **inset ring** (no borde mitad tapado en móvil); filtros/`sx` z-index por encima del sticky |
| Mascots | `src/mascots/` (importados con `?raw`, van dentro del bundle JS): `face.svg`, `mono.svg`, `route.svg`, `filters.svg`, `favs.svg`. *(Actualizado 2026-11-11: ya no existe `public/mascots/`; `face-color.svg`/`full.svg` no están en el repo.)* |
| Empty states | `MascotArt` (route/filters/favs) pinta SVG inline con `fill=currentColor` → `--accent` |
| Header | `BrandLogo` ← `face.svg` raw; blanco sobre barra brand |
| Créditos | `MascotMono` ← `mono.svg` raw; **blanco** en header verde de `#credits` (no `--accent`, se fundía) |
| Overflow | `.slide-pane` con `overflow-x: hidden` (meta-row Llevame/Cerca de mí empujaba ~5px y salía scrollbar horizontal) |
| SW | Los mascots viajan en el bundle (`?raw`), así que el precache del SW los cubre con los JS |

Archivos: `MascotArt.tsx`, `MascotMono.tsx`, `BrandLogo.tsx`, `PlaceItem.tsx` (EmptyState), `src/mascots/*`, estilos panel/detail/overlays.

### Hecho (2026-11-09 noche) — vista inicial Costa Rica

- Primera visita (`crmapa.seen` vacío): **no** restaura `crmapa.view`; abre con `fitBounds(CR_BOUNDS)` (país entero, `maxZoom: 7.4`, márgenes). Opciones = defaults de Zustand si no hay `crmapa.v2`.
- Visitas siguientes: sigue restaurando la última cámara.
- Archivos: `hooks/hash.ts` (`isFirstVisit` / `markSeen`), `controller.ts`, `MapView.tsx`.

### Hecho (2026-11-09) — boot splash + reveal

- Splash Perezeando hasta `map load` + `idle` (`BOOT_MIN_MS` 800 ms, `BOOT_MAX_MS` 16 s; `MapView` corta a 14 s).
- Luego fade del splash y reveal escalonado: mapa → panel → toolbar.
- Archivos: `BootSplash.tsx`, `lib/boot.ts`, `App.tsx`, `MapView.tsx`, `map.css`, i18n `boot_*`.

### Hecho (2026-11-10) — discovery UX + print + polish

- Home Explorar: secciones curadas (`data/discover.ts` — Imperdibles / poco conocidos / fin de semana) en lugar de tirar ~835 filas de golpe.
- Print atlas sheet, boot splash/reveal ya documentados arriba; más polish de mapa/panel.

### Hecho (2026-11-10/11) — Imperdibles \| Todos + limpieza modular

| Tema | Qué |
|------|-----|
| Browse toggle | En Explorar sin filtros/búsqueda: **Imperdibles \| Todos** (`ExplorePane`). Default = curado. **Todos** lista completa (scroll progresivo; arranca en ~120 ítems para no parecer “solo volcanes/cerros”). Contador `835` va en el botón Todos. |
| i18n | `discover_must`, `discover_all`, `discover_hidden`, `discover_weekend` |
| Store partido | `store/actions.ts` = barrel. Módulos: `labels.ts`, `selection.ts`, `trip.ts`, `tools.ts`. Imports de app siguen `from …/store/actions`. |
| Mapa partido | `mapSync.ts` **eliminado**. Sync en `syncStyle.ts`, `syncSelection.ts`, `syncExtras.ts`; cámara en `camera.ts`. `controller.ts` importa directo. |
| Detail | `hooks.ts` (`useDetailScroll`, `useWikiSummary`); bloques en `placeBlocks.tsx`. |
| CSS | `theme-overrides.css` borrado; overrides dark/night en dueños (`app`/`panel`/`detail`/`overlays`/`map`). |
| Capas vacías | Si todas las capas están off: empty state claro en lista (ojo tachado → mostrar todas / ir a Filtros). |

Archivos clave: `ExplorePane.tsx`, `data/discover.ts`, `store/{actions,labels,selection,trip,tools}.ts`, `features/map/{controller,camera,syncStyle,syncSelection,syncExtras}.ts`, `features/detail/{hooks,placeBlocks}.tsx`, estilos listados arriba.

### Hecho (2026-11-11) — revisión de código / limpieza

- Sin cambios de UX/datos; diff ~+280/−638 (39 archivos). Reporte completo: box `/workspace/pz-out/review/REVISION-CODIGO.md`. Backup previo: `%TEMP%\cr-mapa-v2-review-bak-20261111-105823.zip`.
- `main.tsx`: import estático de `lib/sw` (se fue el warning `INEFFECTIVE_DYNAMIC_IMPORT`).
- `lib/photo.ts`: borrado el resto del discovery runtime (cache `pz.photos`, `resolvePhoto`, tipos wiki/commons). API = `placePhoto()` / `placeThumb()`.
- Dedupe: `ThumbBox` (PlaceItem/ExplorePane), `clusterHeader`+`ZOOM_SVG` (markers/clusters), hook `hooks/useModalDialog.ts` (Créditos/Políticas), `showBaseLabels()` en `syncStyle`. `discover.ts` → `labelKey: DictKey`.
- Bug: `fadeInPlaces` daba opacidad negativa (4 errores MapLibre en consola por carga) → clamp. Consola limpia.
- CSS muerto fuera (`.sat-tile`, `.map-loading`, `.tip3d` dup, `#policies .close` dup).
- Scripts: utilidades comunes en `scripts/shared.mjs` (ROOT, sleep, norm, km, FREE, detector EN, sharp + variantes WebP); `build-data` da salida idéntica.
- Perf igual dentro del ruido (S25U CPU×4 Fast3G y desktop); smoke Puppeteer 0 errores.
- Nota: los tiempos de boot reales son `BOOT_MIN_MS 800` / `BOOT_MAX_MS 16000` (MapView 14000) — ya corregido arriba.

### Hecho (2026-11-11 tarde) — recomendaciones de la revisión

Backup previo: `%TEMP%\cr-mapa-v2-review2-bak-20261111-115701.zip` (dist anterior: `%TEMP%\cr-mapa-v2-dist-before-review2-20261111-124835`). Reporte: box `/workspace/pz-out/review/REVISION-CODIGO.md`.

| Tema | Qué |
|------|-----|
| OG por lugar | `functions/_middleware.js` **nunca corría** (deploy = Worker con assets, no Pages). Ahora `worker/index.js` + `wrangler.toml` (`main`, binding `ASSETS`, `run_worker_first = ["/"]`). Personas: pasa directo a `ASSETS` (+ headers de seguridad). Solo bots con `?lugar=slug` reciben `<title>`/`og:*`/`twitter:*` del lugar (lee `data/share.json`, imagen absoluta en R2). Validado con `wrangler dev`. Ojo: cada `GET /` cuenta como request de Worker. |
| Headers | `public/_headers`: seguridad en todo + `/assets/*` `immutable`. |
| Búsqueda | Fuse indexa solo los primeros 120 caracteres de la descripción (`DESC_CHARS` en `searchIndex.ts`); nombres, apodos, gentilicios y categorías igual. 30 consultas clave: mismos resultados arriba. |
| Datos | `vite.config.ts` → `finalizeData`: quita `img.remote` de `dist/data/{atlas,provinces-content}.json` (no lo lee el frontend; `public/data` intacto). atlas gzip 155→147 KB. `share.json` sale con URLs de imagen absolutas. |
| Fotos platos | Una sola clave: `dishKey()` en `scripts/shared.mjs` (antes `mediaDishKey` + `dishKey`). `food-photos.json` migrado (73→70 claves, 3 duplicadas idénticas). Platos con foto: 110/110. |
| Scripts | One-offs a `scripts/archive/` (`fetch-media-v36`, `fix-media-gaps`, `patch-content-fauna`) con README. `sharp` documentado en README (no es dependencia). |
| E2E | `pnpm e2e` (`scripts/e2e.mjs`): build + Chrome local + `puppeteer-core` aparte (`npm install --prefix "$env:TEMP\pz-e2e" puppeteer-core`). Desktop + móvil, falla si hay errores de consola. |
| Mapa | `nearbyOf` con caché + inserción ordenada (~2,8× más rápido, mismo resultado); etiqueta de lugar sin clon de medición; textos de clusters/menús en i18n (`cl_*`). |
| CSS | `map.css` con un solo bloque `@media (max-width: 760px)`; estilos de `#policies` en `overlays.css`; Prettier limpio en `src/**`. |
| Perf | Igual o mejor dentro del ruido (S25U CPU×4 + Fast 3G / desktop). Medianas TBT móvil 3806→3524 ms, desktop 2993→2664 ms; datos propios 136→130 KB. |

- **No hecho (a propósito):** el jank al escribir en móvil viene del composite del canvas del mapa (trace: ~80 % "Commit", no la lista); los cambios CSS probados no mejoraron → no se tocó.
- **SW `MEDIA_HOST`:** resuelto el 2026-11-12 (CORS en R2 + `loadEnv` en `vite.config.ts`). Ver «Hecho (2026-11-12)».



### Hecho (2026-11-12) — items 10, 3 y 9 (aprobados)

Backup previo: `%TEMP%\cr-mapa-v2-review4-bak-20261112-080712.zip`. Capturas y e2e: box `/workspace/pz-out/review4/`.

| Tema | Qué |
|------|-----|
| CORS R2 | Bucket `perezeando` (cuenta `b78c5cb20bace55958349c9e86f12bfa`): no había política (GET 404, código 10059). Aplicada `perezeando-media`: métodos GET,HEAD; `maxAgeSeconds` 86400; orígenes `https://perezeando.com`, `https://www.perezeando.com`, `https://perezeando.lospherris.workers.dev`, `http://localhost:{5173,4173,8787}` y los mismos en `http://127.0.0.1`. Cloudflare no acepta wildcard de puerto (`localhost:*`); se listaron Vite, preview y wrangler. curl: Origin permitido devuelve `Access-Control-Allow-Origin` + `Vary: Origin`; origen ajeno o sin Origin, no. Solo config del bucket, sin tocar objetos. |
| SW `MEDIA_HOST` | `vite.config.ts` inyecta el host de `VITE_MEDIA_BASE_URL` con `loadEnv` + `hostOf`. Build de prod: `MEDIA_HOST = 'pub-409cfb54b50741928198b4469fad8d4e.r2.dev'`. A/B (Fast 3G, CPU×4, móvil): 0 descargas dobles en ambos lados. mapLoad con SW 5322 / 1605 ms (1.ª visita, dos corridas) vs sin SW 4936 / 2889 ms; 2.ª visita ~4,0 s vs ~3,8 s. No reapareció la regresión de ~6 s de cuando faltaba CORS. Con `MEDIA_HOST`, las 23 imágenes de R2 salen `fromServiceWorker`. |
| Redibujos al tipear | No se tocó código. `controller.update` ya llama `syncPlaces`/`setData` solo si cambian `active`/`prov`/`cat`/`lang`/`favs`, no el query. `SearchBox` ya debuncia 140 ms. El costo al escribir sigue siendo el composite del canvas (nota del 11). Sin mejora medida de TBT, se deja igual. |
| Cerca de mí | La función ya existía (geolocalización solo al toque, nunca al cargar; `nearbyOf`/haversine; distancias en la lista; i18n ES/EN; `Notice` si deniegan o hay error). Ajuste: pin y halo `#386641`, targets táctiles 44 px, `locate` expuesto en `__cract` para e2e. e2e: `locate_near` (24 distancias, 0,2 km, pin «Estás aquí»), `locate_denied` (aviso, sin pin), `m_locate`. Suite completa OK. |
| Descripciones | Via `scripts/enrich-thin-desc.mjs` y `scripts/data/briefs.json` (no se edita el atlas a mano). **62** textos mejorados con Wikidata (52 nuevos + 10 reemplazos). 8 de esos reemplazos quitaban copias de Wikipedia de otro país (Uruguay, México, Chile, Perú, Honduras, España). **4** briefs de playas sin fuente fiable de CR se eliminaron (queda la plantilla). **244** lugares siguen con plantilla genérica (121 gastronomía OSM, 75 cataratas, 25 cerros, etc.): sin fuente fiable, no se inventó. briefs 272→320, 114002→128981 bytes (+15 KB). atlas en `dist`: raw 667507→693862 (+26 KB), gzip 147089→148986 (+1,9 KB). `descSrc` en 254 lugares (crédito bajo la descripción). audit-lang: 0 descripciones ES en inglés; 0 thin <50 (fillDesc rellena). |


### Hecho (2026-11-12, media mañana) — lista «cerca de»

Backup: `%TEMP%\cr-mapa-v2-review5-bak-20261112-084134.zip`. Capturas: box `/workspace/pz-out/review5/`.

La lista cercana ya no muestra los 834 lugares. Radio **25 km**; si hay menos de **8** resultados se abre a **50 km**; tope **30** (los más cercanos). Igual para «Cerca de mí» y para «Ver más cercanos» de un lugar. Encabezado en una línea, con elipsis: «15 lugares cerca de Volcán Tortuguero» / «30 lugares cerca de mí» (ES/EN). Botones Limpiar / Llévame / Cerca de mí en una fila aparte, sin el envoltorio de tres líneas. Valores en `NEAR_*` de `src/features/search/results.ts`. e2e: tope y radio comprobados (Tortuguero: 15 ≤ 25 km; San José: 30 ≤ 25 km, más lejano 2,3 km).

### Hecho (2026-11-12, ~09:00 America/Costa_Rica) — cercanos en la ficha + un solo héroe

Backup: `%TEMP%\cr-mapa-v2-review6-bak-20261112-085406.zip`. Capturas: box `/workspace/pz-out/review6/`. Servidor del usuario en localhost:5173 no se tocó.

1. **«Ver más cercanos» en la ficha.** Ya no abre la lista Explorar («15 lugares cerca de Volcán Tortuguero»). El botón expande la sección *Cerca de aquí* en el mismo detalle (misma regla 25 km / ampliar a 50 si hay menos de 8 / tope 30). Vista previa: 6 lugares diversificados (`NEAR_PREVIEW`). El detalle permanece abierto; el botón pasa a «Ver menos». Se eliminó el modo `openNearbyExplore` / `nearPlace` (nadie más lo usaba). **«Cerca de mí»** sigue siendo la lista Explorar ordenada por distancia.

2. **Bug de héroes apilados.** Causa: en `PlaceDetail`, `PhotoHero`/`NoPhotoHero` y `StickyTitle` eran hermanos con el mismo `key={p.id}`. Claves duplicadas entre hermanos; al cambiar de lugar React no desmontaba el `.hero` anterior y se acumulaban (repro en `dist` de producción: 13 héroes / 13 `.hero-top` / 1 h2 tras un ráfaga). Arreglo: se quitaron esas keys internas y se puso `key={sel.id}` en `PlaceDetail`/`ProvinceDetail` desde `Panel.tsx`, de modo que la ficha se remonta entera (también reinicia el expandido de cercanos, sin `setState` en un efecto). Tras el arreglo: exactamente 1 `.hero`, 1 `.hero-top`, 1 `section.detail` al seleccionar rápido por lista, mapa (`__cract.select`), cercanos y atrás/adelante (escritorio y móvil). e2e: `nearby_inline`, `detail_no_stack`, `m_nearby_inline`, `m_detail_no_stack`. Perf: mapLoad ~3,4–3,7 s (4173, dist nuevo).

### Hecho (2026-11-12, ~09:40 America/Costa_Rica) — revisión exhaustiva 2 (código muerto y arquitectura)

Backup: `%TEMP%\cr-mapa-v2-review7-bak-20261112-092400.zip`. Informe: box `/workspace/pz-out/review7/REVISION-2.md`. Servidor del usuario en localhost:5173 no se tocó.

Se aplicaron solo cambios seguros, sin cambiar comportamiento: claves i18n muertas `near_of` / `near_of_one` (leftover de «Ver más cercanos»); exportaciones internas sin uso externo; CSS huérfano `#routeActions`; `_strip-comments.mjs` a `scripts/archive/`. Las funciones de cercanos pasaron a `src/lib/nearby.ts` (PlaceDetail ya no importa el módulo de búsqueda/Fuse). Se cortó el ciclo `hash.ts` → `actions.ts` → `tools.ts` → `hash.ts` (hash importa `select`/`deselect` de `selection.ts`). knip `--cycles`: 0. e2e OK. Bundle: los chunks `photo` y `prefetch` se reintegraron en `index.js`; suma inicial 104,06→103,52 kB raw / 42,15→41,77 kB gzip; SW 29→27 archivos. El precache del SW sigue en ~2,4 MB por MapLibre (recomendación, no aplicada). Perf Fast 3G: diferencias dentro del ruido; no se atribuyen a estos cambios.

### Hecho (2026-11-12, ~10:10 America/Costa_Rica) — recomendaciones 1–6 de la revisión 2

Backup: `%TEMP%\cr-mapa-v2-review7b-bak-20261112-094400.zip` (1.105.015 bytes, 09:43 America/Costa_Rica). Informe: box `/workspace/pz-out/review7/REVISION-2.md` §9. Servidor del usuario en localhost:5173 no se tocó. Artefactos: `/workspace/pz-out/review7b/`.

1. **MapLibre fuera del precache del SW (se mantiene).** SHELL 27→24 archivos (~1,67 MB raw de MapLibre salen del `addAll`). Caché runtime `pz-runtime-v1` (cache-first, 30 días) para esos assets. Medición Fast 3G + CPU×4, caché HTTP off, perfil fresco, 3 corridas: 1.ª visita escritorio mapLoad 6672→4558 ms (−31 %), swReady 9708→7612; móvil 5982→5987 (igual). 2.ª visita 1812→1860 / 1210→1304 (rangos que se solapan; no se toma como regresión). Offline tras la 2.ª: lista 31, `mlCached` 3, sin error. e2e `offline_repeat` OK. El cambio se queda porque la 1.ª mejora y las repetidas no empeoran de forma clara.

2. **`nearbyOf` / `nearbyAround`: núcleo común, no fusión de criterio.** En 835 lugares, 0 diferencias de título (8 genéricos). Unificar con el radio 25/50 vaciaría 7 sitios marinos (vecino más cercano 51,7–139 km) y cambiaría 25 listas n=6 y 62 con diversify. Se compartió `nearbyByDistance`; `nearbyOf` sigue sin radio (pozo 40, top-n); `nearbyAround` conserva 25/50/8/30. Tras el refactor: 0 diferencias en of1, of6, of6+diversify y around.

3. **Imports directos** desde `selection` / `tools` / `trip` / `labels`. `openTab` en `store/openTab.ts`. `actions.ts` queda como barrel delgado. `__cract` se asigna en `App.tsx` (si no, el e2e no veía el hook).

4. **`predev`/`prebuild` omiten `build-data`** si el SHA-256 de 17 entradas coincide (`scripts/.data-stamp`). Mensaje: `atlas al día (…), se omite build-data`. Atlas/geoms/share con los mismos hashes. `FORCE_BUILD_DATA=1` fuerza.

5. **`fetch-food-photos`** documentado como herramienta manual (README + `pnpm fetch-food-photos`). No se archivó: todavía escribe `food-photos.json`.

6. **`NEAR_*` en una sola fuente:** `src/lib/near-const.json` (25/50/8/30/6); `scripts/near-const.mjs` lo reexporta; e2e y `nearby.ts` lo usan.

Checks: typecheck 0, lint 0, prettier 0 (sin `--write` de los 4 archivos que ya venían sucios), audit-lang 0, audit-quality 0 (495 missing-media en el box), build 0 (SW 24 archivos), e2e OK (offline + cercanos). Perf general escritorio mapLoad 4501 / móvil 3859, en el ruido de review7.

### Hecho (2026-11-12, ~12:40 America/Costa_Rica) — licencia, CI, Vitest y nombre del paquete

Backup: `%TEMP%\review9-bak-20261112-1228.zip` (211 archivos). Artefactos: box `/workspace/pz-out/review9/`.

- `LICENSE`: MIT © 2026 Ponss17, solo para el código. El README (insignia + sección «Licencia») aclara que fotos, textos y datos de mapas conservan su licencia (CC BY-SA, ODbL, Commons, Esri).
- `.github/workflows/ci.yml` (push y PR): pnpm desde `packageManager`, Node 22, `install --frozen-lockfile`, typecheck, lint, prettier (`src`, `tests`, raíz `*.json`/`*.md`, `eslint.config.js`, `vitest.config.ts`, el YAML), audit-lang, test y build. Sin e2e. `AUDIT_SKIP_MEDIA=1` solo en CI: `audit-quality` no busca `public/media` (ignorado en git); en local sigue igual.
- Vitest 5.1 (`vitest.config.ts`, `tsconfig.test.json` en `tsc -b`). 50 tests en `tests/`, usan `public/data/atlas.json` real; corren en <0,5 s. El agrupado por días de `RoutePane` (dayOf/dayEnd) sigue inline y no se testea directo; sí `setRoute`/`toggleDayStart`/`sleepInTown`/`optimizeRoute`.
- `package.json`: `name` `cr-mapa` → `perezeando`, script `test`, `packageManager`. Las claves de localStorage `crmapa.*` no se tocaron (cambiarlas borraría favoritos y ruta guardados).
- Bundle: `dist` idéntico byte a byte antes/después.

### Hecho (2026-11-12, ~13:15 America/Costa_Rica) — menús de filtros y transición Imperdibles/Todos

- Menús Provincia/Categoría: en el sheet móvil a media altura la lista se cortaba (posición absoluta dentro del panel con `overflow:hidden` y `transform`; a ~430×850 solo se veía «Limón 94»). Ahora el menú se porta al `body` (`position:fixed`), se abre hacia el lado con más espacio, limita su altura y hace scroll interno. Cierra al tocar fuera o al hacer scroll. Targets ≥44 px en puntero grueso / móvil. Paleta, teclado y a11y se mantienen. Capturas before/after: `/workspace/pz-out/review9/`.
- Toggle Imperdibles ↔ Todos: un solo `.browse-ind` se desliza con `transform` (~220 ms). La lista entra en la dirección del cambio con `translateX` + fade (mismos 220 ms, solo transform/opacity). Respeta `prefers-reduced-motion`. E2E comprueba el indicador (fondo no transparente, solapa el botón activo) y que el toggle sigue cambiando la lista (`discover-sec` ↔ secciones).
- E2E menús: las 9 provincias y todas las categorías, cada opción dentro del viewport y clicable; elegir Limón / Playas actualiza el trigger (escritorio, 412×915 y 430×850 a medio sheet).
- Frames (rAF, Chrome móvil CPU 4×): el primer pintado de «Todos» (~120 ítems) ya era el paso caro (pico ~250 ms antes, similar después); los frames siguientes quedan en mediana 16,7 ms, sin jank sostenido.

Archivos: `Select.tsx`, `app.css`, `panel.css`, `ExplorePane.tsx`, `scripts/e2e.mjs`.

### Pendiente próximo (pedido explícito)

1. **Onboarding** (opcional): tour corto primera visita — panel, filtros, ruta, medir; skip + “no volver a mostrar”.
2. Gastro sin foto; dominio custom media; tests de filtros/`visiblePlaces` (hay Vitest y `pnpm e2e`).
4. ~~CORS en R2 y `MEDIA_HOST` del SW~~ — hecho el 2026-11-12 (falta solo el deploy, no pedido).
3. Cola restante de lugares sin `img` (Fase B parcial).

---

## 11. Reglas para el próximo agente

1. **Fuente de verdad = `D:\zpaginas\cr-mapa-v2`**, no zips/v34/v35 del box.
2. No Cursor Cloud Agent salvo que Ponss lo pida; trabajar en su máquina/proyecto.
3. No commit/push/reset sin pedido explícito.
4. No inventar datos de lugares; no re-subir los 360 a R2 sin necesidad.
5. No reintroducir discovery runtime de fotos Wiki/Commons.
6. Secretos R2 solo en env; nunca en frontend ni en markdown con tokens.
7. Español con el usuario (voseo si aplica al tono de Ponss); reportes técnicos claros.
8. Antes de “limpiar” scripts de fetch: son build-time; R2 no los reemplaza.

---

## 12. Archivos clave tocados en esta secuencia R2 / fotos runtime / espejo

- `src/lib/mediaUrl.ts`, `src/lib/photo.ts`, `src/lib/format.ts`
- `scripts/sync-media-r2.mjs`, `scripts/mirror-remote-media.mjs`, `scripts/sw-template.js`, `vite.config.ts`
- `.env.example`, `.env.production` (URL R2 pública), `.env.production.example`, `.gitignore`, `README.md`, `wrangler.toml`
- Datos reescritos por el espejo: `data/places.json`, `places-wd.json`, `places-extra.json`, `places-osm.json`, `fauna-extra.json`, `enrich.json`, `photos.json`, `photos-hand.json`, `public/data/provinces-content.json`, `scripts/data/food-photos.json`
- `package.json` (`aws4fetch`, `sync-media*`, `mirror-media*`)
- Reportes: `perf/mirror-remote-media.json`

Fin del handoff.
