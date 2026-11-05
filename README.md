# Costa Rica · Atlas interactivo (v2)

Mapa interactivo de Costa Rica: volcanes, parques nacionales, playas, ríos, fauna, historia y mar territorial.
Búsqueda, fichas con Wikipedia, rutas en carro, favoritos, capas, vista 3D con relieve, impresión y exportación.

**Stack:** Vite · React 19 · TypeScript · MapLibre GL JS (un solo motor para 2D y 3D) · Zustand · CSS con variables.
Sin backend y sin base de datos: todo son archivos estáticos.

## Requisitos

- Node.js **20.19 o superior** (probado con Node 20.19.2) y pnpm.

## Instalar y desarrollar

```bash
pnpm install
pnpm run dev        # http://localhost:5173 con recarga en caliente
```

Otros comandos:

```bash
pnpm run build      # revisa tipos (tsc) y genera la carpeta dist/
pnpm run preview    # sirve dist/ en http://localhost:4173 para probar el build
pnpm run lint       # ESLint
pnpm run format     # Prettier
```

> El build usa `base: './'`, así que `dist/` funciona en cualquier subcarpeta.
> Hay que abrirlo desde un servidor (`pnpm run preview`, Cloudflare Pages, GitHub Pages…); con doble clic (`file://`) no carga, porque el navegador bloquea el worker del mapa y los JSON.

## Estructura

```
data/                   lugares y geometría de trabajo (no se publican)
public/data/            atlas.json, geoms.json, provinces-content.json (lo que carga el sitio)
src/
  components/           Panel, barra de herramientas, iconos, avisos, impresión
  features/
    map/                MapView (carga diferida) + MapController (MapLibre, imperativo)
    search/             índice Fuse.js, caja de búsqueda, lista "Explorar"
    route/              cálculo de ruta (OSRM), optimización, GPX/GeoJSON
    favorites/          pestaña de favoritos
    detail/             ficha de lugar y de provincia (Wikipedia)
    layers/             categorías, mapas base y capas extra
  data/                 tipos (Place, Category, Province), configuración y carga
  store/                estado global (Zustand, persistido en localStorage) y acciones
  hooks/                URL compartible (#hash), hoja móvil, ruta, media queries
  i18n/                 español e inglés
  lib/                  utilidades (formato, geo, iconos, Wikipedia…)
  styles/               CSS con variables (diseño "atlas")
```

Para **agregar o editar lugares** basta con modificar `data/places.json` (cada lugar tiene `id`, `name`, `cat`, `prov`, `lat`, `lng`, `desc` y opcionalmente `wiki`, `img`, `geometry`…). `pnpm run dev` y `pnpm run build` rearman `public/data/atlas.json` a partir de esa carpeta.
Las categorías y sus colores están en `src/data/config.ts`.

## Publicar en Cloudflare Pages

En el proyecto de Pages (Workers y Pages):

- Comando de compilación: `pnpm run build`
- Directorio de salida: `dist`
- Variable de entorno `PNPM_VERSION`: `11.13.1` (Pages no lee la versión del lockfile; el valor por defecto es más viejo)
- Node.js: el archivo `.node-version` fija la 20

Las cabeceras salen de `functions/_middleware.js`, que Pages publica junto con `dist`. Conectá el repositorio: si solo subís la carpeta `dist/`, esa función no viaja.

## Publicar en GitHub Pages

1. Subí el proyecto a un repositorio de GitHub (rama `main`).
2. En **Settings → Pages**, elegí **Source: GitHub Actions**.
3. Cada `push` a `main` ejecuta `.github/workflows/pages.yml`, que compila y publica `dist/`.

Como `base` es `./`, funciona igual en `usuario.github.io/repositorio/`.

## Servicios externos (gratuitos, sin clave)

- Mapas base: Esri (satélite, calles, gris oscuro y etiquetas), OpenTopoMap y OpenStreetMap.
- Relieve 3D: Mapzen Terrain Tiles (AWS Open Data).
- Rutas: OSRM público (`router.project-osrm.org`). Si no responde, se muestran distancias en línea recta.
- Textos e imágenes: API REST de Wikipedia.
