# Handoff — Perezeando (`cr-mapa-v2`)

**Fecha:** 2026-11-09 (America/Costa_Rica)  
**Proyecto en disco (fuente de verdad):** `D:\zpaginas\cr-mapa-v2`  
**Máquina:** Windows del usuario (Ponss), clone GitHub `https://github.com/Ponss17/Perezeando.git` (`origin/main`)  
**Hosting prod:** Cloudflare Worker assets `perezeando` → https://perezeando.lospherris.workers.dev (`wrangler.toml`, SPA `not_found_handling`)  
**Trabajo reciente:** agente en disco local (no Cloud Agent) — CSS modular + mascots empty-state.

Este archivo resume el estado real del repo. **No uses** copias viejas del box (`/workspace/cr-mapa*`, zips v35/v36) para sobrescribir `D:\zpaginas\cr-mapa-v2`.

---

## 1. Objetivo

Atlas interactivo **Perezeando**: mapa de consulta de Costa Rica (territorio + mar), rápido, con datos estáticos en build, fotos optimizadas y contenido citado. Prioridad: rendimiento percibido, media liviana, datos con fuente (sin inventar precios/horarios/teléfonos).

---

## 2. Stack actual (package / source)

| Pieza | Versión / nota |
|--------|----------------|
| Node | `>=22.13` (`engines`) |
| Empaquetado | **pnpm** + Vite **8.3.5** |
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
- **Oleada 2026-11-08 publicada** (filtros/lima/fauna/assetsignore/estadios/Alajuela). `public/media/` sigue gitignored; vive en disco + R2.
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
7. Suite de tests automatizados: **casi no hay**; no asumir cobertura.
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

Archivos: `ExplorePane.tsx`, `LayersPane.tsx`, `mapSync.ts`, `actions.ts`, `sw.ts`, `sw-template.js`, `.env.production`, `wrangler.toml`.

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

**Siguiente (no bloquea):** gastro sin foto; dominio custom media; OG middleware; tests filtros/`visiblePlaces`.

### Hecho (2026-11-09) — CSS split + mascots Perezeando

| Tema | Qué |
|------|-----|
| CSS modular | `app.css` residual; piezas en `panel.css`, `detail.css`, `route.css`, `toolbar.css`, `theme-overrides.css` (wire en `index.css`) |
| Panel / lista | Scroll + sticky heads opacos; item activo con **inset ring** (no borde mitad tapado en móvil); filtros/`sx` z-index por encima del sticky |
| Mascots | Carpeta `public/mascots/` (+ copias `src/mascots/` para `?raw`): `face.svg`, `mono.svg`, `route.svg`, `filters.svg`, `favs.svg`, `face-color.svg`, `full.svg` |
| Empty states | `MascotArt` (route/filters/favs) pinta SVG inline con `fill=currentColor` → `--accent` |
| Header | `BrandLogo` ← `face.svg` raw; blanco sobre barra brand |
| Créditos | `MascotMono` ← `mono.svg` raw; **blanco** en header verde de `#credits` (no `--accent`, se fundía) |
| Overflow | `.slide-pane` con `overflow-x: hidden` (meta-row Llevame/Cerca de mí empujaba ~5px y salía scrollbar horizontal) |
| SW | Precache ya incluye `mascots/` vía filtro vite |

Archivos: `MascotArt.tsx`, `MascotMono.tsx`, `BrandLogo.tsx`, `PlaceItem.tsx` (EmptyState), `Overlays.tsx`, `src/mascots/*`, `public/mascots/*`, estilos panel/detail/theme-overrides.

### Hecho (2026-11-09 noche) — vista inicial Costa Rica

- Primera visita (`crmapa.seen` vacío): **no** restaura `crmapa.view`; abre con `fitBounds(CR_BOUNDS)` (país entero, `maxZoom: 7.4`, márgenes). Opciones = defaults de Zustand si no hay `crmapa.v2`.
- Visitas siguientes: sigue restaurando la última cámara.
- Archivos: `hooks/hash.ts` (`isFirstVisit` / `markSeen`), `controller.ts`, `MapView.tsx`.

### Hecho (2026-11-09) — boot splash + reveal

- Splash Perezeando hasta `map load` + `idle` (mín. 700 ms, máx. 7 s).
- Luego fade del splash y reveal escalonado: mapa → panel → toolbar.
- Archivos: `BootSplash.tsx`, `lib/boot.ts`, `App.tsx`, `MapView.tsx`, `map.css`, i18n `boot_*`.

### Pendiente próximo (pedido explícito)

1. **Onboarding** (opcional): tour corto primera visita — panel, filtros, ruta, medir; skip + “no volver a mostrar”.
2. Gastro sin foto; dominio custom media; OG middleware; tests filtros/`visiblePlaces`.
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
