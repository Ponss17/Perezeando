import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const mediaHostFromEnv = () => {
  const raw = (process.env.VITE_MEDIA_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  try {
    return new URL(raw).hostname;
  } catch {
    return '';
  }
};

const sha = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

/**
 * Genera dist/sw.js desde scripts/sw-template.js: lista de precache (app) y hash de cada
 * archivo de datos. La versión es el hash de todo eso, así que cualquier cambio en el build
 * instala un SW nuevo (y nada más cambia si el build es idéntico).
 */
function writeServiceWorker(out: string, root: string) {
  const rel = (f: string) => path.relative(out, f).split(path.sep).join('/');
  const files = walk(out).filter((f) => !/\.(br|gz)$/.test(f)).map(rel);
  const shell = files
    .filter((f) => f === 'index.html' || f === 'manifest.webmanifest' || /^(assets|fonts|icons|mascots)\//.test(f) || /^(favicon[^/]*|apple-touch-icon\.png)$/.test(f))
    .sort();
  const dataFiles = ['atlas.json', 'geoms.json', 'provinces-content.json'];
  const data: Record<string, string> = {};
  for (const d of dataFiles) {
    const p = path.join(out, 'data', d);
    if (fs.existsSync(p)) data['data/' + d] = sha(fs.readFileSync(p));
  }
  const tpl = fs.readFileSync(path.join(root, 'scripts/sw-template.js'), 'utf8');
  // la versión cambia si cambia la app, los datos o el propio service worker
  const version = sha(shell.map((f) => f + sha(fs.readFileSync(path.join(out, f)))).join() + JSON.stringify(data) + tpl);
  fs.writeFileSync(
    path.join(out, 'sw.js'),
    tpl
      .replace("= '__VERSION__'", `= '${version}'`)
      .replace('= __SHELL__;', `= ${JSON.stringify(shell)};`)
      .replace('= __DATA__;', `= ${JSON.stringify(data)};`)
      .replace("= '__MEDIA_HOST__'", `= '${mediaHostFromEnv()}'`),
  );
  console.log(`sw.js ${version}: ${shell.length} archivos de la app, ${Object.keys(data).length} de datos`);
}


/** En dev, Vite devuelve index.html para cualquier ruta. Esos archivos no existen y en producción responden 404. */
function devMissingFiles(): Plugin {
  const missing = new Set(['/.well-known/ai-catalog.json', '/ai-catalog.json', '/.well-known/ard.json']);
  return {
    name: 'dev-missing-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!missing.has(url)) return next();
        res.statusCode = 404;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end('Not found');
      });
    },
  };
}

/** Escribe dist/sw.js al terminar el build. Cloudflare comprime en el borde, así que no hace falta dejar .br ni .gz. */
function serviceWorker(): Plugin {
  let out = 'dist';
  let root = '.';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(c) {
      out = path.resolve(c.root, c.build.outDir);
      root = c.root;
    },
    closeBundle() {
      writeServiceWorker(out, root);
      // R2 sirve /media; no subir WebP al Worker (SPA devolvería HTML si faltan)
      fs.writeFileSync(path.join(out, '.assetsignore'), 'media/**\n');
    },
  };
}

// base './' => funciona en la raíz (Cloudflare Pages) y también en una subcarpeta
export default defineConfig({
  base: './',
  resolve: {
    // un .js emitido junto al .ts no debe ganar: sería otra copia del store, vacía
    extensions: ['.mjs', '.mts', '.ts', '.tsx', '.jsx', '.js', '.json'],
  },
  plugins: [devMissingFiles(), react(), serviceWorker()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // MapLibre en su propio archivo: cambia poco, así queda en caché entre versiones de la app
        manualChunks(id: string) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler') || id.includes('node_modules/zustand')) return 'react';
        },
      },
    },
  },
  server: { port: 5173 },
});
