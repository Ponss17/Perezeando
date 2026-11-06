# Perezeando

Atlas interactivo de Costa Rica.

Perezeando reúne en un mapa de consulta pública el territorio continental y el mar territorial. Cubre volcanes, cerros, parques nacionales, bosques, cataratas, ríos, islas, playas, fauna terrestre y marina, centros de población, sitios históricos, gastronomía, deporte y hitos oceánicos. La interfaz está en español y en inglés.

## Contenido

Cada lugar tiene ficha: nombre, categoría, provincia, coordenadas y descripción. Si hay una fotografía del sitio, o una referencia en Wikipedia, la ficha la incluye junto con un extracto.

La consulta es por nombre, por provincia o por categoría. El color del punto indica el grupo: naturaleza, fauna, cultura e historia, mar territorial, deporte, gastronomía o transporte.

## Consulta

La búsqueda abre la ficha del lugar. Al reducir la escala, los puntos próximos se agrupan; al aumentarla, cada lugar vuelve a mostrarse por separado.

Se puede trazar una ruta por carretera entre varios destinos, conservarla y exportarla. Los favoritos se guardan en el navegador de quien consulta. El mapa permite medir una distancia, cambiar el fondo (imagen satelital, calles o relieve) y activar una vista tridimensional del terreno.

Cada lugar tiene un enlace propio. Quien lo abre llega a esa ficha, con el nombre y la descripción del sitio. En pantallas pequeñas la ficha se presenta sobre el mapa. El atlas tiene un tema claro y un tema nocturno.

## Uso

Perezeando es un atlas de consulta. No es un sitio oficial ni administra los lugares que muestra. Los mapas, las fotografías y los textos de terceros conservan la licencia de su autor. El sitio publica sus políticas de uso y la lista de créditos.

## Fuentes

- Cartografía: Esri, OpenTopoMap y OpenStreetMap.
- Relieve: Mapzen Terrain Tiles (AWS Open Data).
- Rutas: OSRM (`router.project-osrm.org`). Si el servicio no responde, el trazado se calcula en línea recta.
- Textos e imágenes complementarios: Wikipedia y Wikimedia Commons.

## Medios (local y Cloudflare R2)

Las fotos optimizadas viven en `public/media/` (`media/places/*` y `media/food/*`), en tres tamaños WebP (`-120`, `-320`, `-800`). Los JSON siguen guardando rutas canónicas `/media/...`.

### Desarrollo local

Por defecto no hace falta nada: Vite sirve `/media` desde `public/media`. Dejá `VITE_MEDIA_BASE_URL` vacío (o sin definir).

```bash
pnpm dev
```

### Producción con R2 (opt-in)

Definí el prefijo público en el entorno de build (nunca pongas secretos en el frontend):

```bash
# .env.production (no se versiona; hay ejemplo en .env.production.example)
VITE_MEDIA_BASE_URL=https://pub-409cfb54b50741928198b4469fad8d4e.r2.dev
```

Ese valor es el dominio público gestionado actual del bucket `perezeando`. Sirve para pruebas. **Antes de un sitio en vivo**, conviene un dominio propio (p. ej. `https://media.tudominio.com`) apuntando al bucket y usarlo como `VITE_MEDIA_BASE_URL`.

Con la variable definida, `sizedThumb` / `thumbUrl` anteponen esa base a las rutas `/media/...`. Las tres variantes usan el mismo path relativo.

### Runtime vs build-time

En el navegador la foto de un lugar sale solo de `p.img` curado en los datos (`/media/...` local o R2, o un remoto verificado ya grabado en JSON). No hay busqueda en vivo a Wikipedia/Commons para llenar la portada; el texto de Wikipedia en la ficha si puede pedirse. Los scripts `fetch-photos`, `fetch-fauna-media`, `fetch-media-v36`, `optimize-media` y `sync-media` siguen siendo herramientas de build/actualizacion.

Las 2 especies aun sin WebP local (`fau-lapa-roja`, `fau-ballena-piloto`) llevan `allowRemote: true` en su `img` hasta migrarlas.

### Generar / optimizar WebP

```bash
node scripts/optimize-media.mjs
```

### Sincronizar a R2

Script: `scripts/sync-media-r2.mjs` (API S3 de R2 vía `aws4fetch`). **Por defecto es dry-run** (no sube). No borra objetos remotos. Credenciales solo por entorno (nunca en archivos del repo):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` (por defecto `perezeando`)

```bash
pnpm sync-media              # dry-run: cuenta archivos
pnpm sync-media:upload       # sube WebP con Content-Type image/webp y Cache-Control immutable
```

Opcional: `--prefix=media/places` para limitar el alcance.

