import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hostOf = (raw: string) => {
  const u = String(raw || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  try {
    const h = new URL(u).hostname;
    return /^[a-z0-9.-]+$/i.test(h) ? h : '';
  } catch {
    return '';
  }
};

const sha = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

function writeServiceWorker(out: string, root: string, mediaHost: string) {
  const rel = (f: string) => path.relative(out, f).split(path.sep).join('/');
  const files = walk(out).filter((f) => !/\.(br|gz)$/.test(f)).map(rel);
  const shell = files
    .filter((f) => (f === 'index.html' || f === 'manifest.webmanifest' || /^(assets|fonts|icons|mascots)\//.test(f) || /^(favicon[^/]*|apple-touch-icon\.png)$/.test(f)) && !/maplibre/i.test(f))
    .sort();
  const dataFiles = ['atlas.json', 'geoms.json', 'provinces-content.json'];
  const data: Record<string, string> = {};
  for (const d of dataFiles) {
    const p = path.join(out, 'data', d);
    if (fs.existsSync(p)) data['data/' + d] = sha(fs.readFileSync(p));
  }
  const tpl = fs.readFileSync(path.join(root, 'scripts/sw-template.js'), 'utf8');
  const version = sha(shell.map((f) => f + sha(fs.readFileSync(path.join(out, f)))).join() + JSON.stringify(data) + tpl);
  fs.writeFileSync(
    path.join(out, 'sw.js'),
    tpl
      .replace("= '__VERSION__'", `= '${version}'`)
      .replace('= __SHELL__;', `= ${JSON.stringify(shell)};`)
      .replace('= __DATA__;', `= ${JSON.stringify(data)};`)
      .replace("= '__MEDIA_HOST__'", `= '${mediaHost}'`),
  );
  console.log(`sw.js ${version}: ${shell.length} archivos de la app, ${Object.keys(data).length} de datos`);
}

function finalizeData(out: string, media: string) {
  let saved = 0;
  for (const name of ['atlas.json', 'provinces-content.json']) {
    const file = path.join(out, 'data', name);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    const next = JSON.stringify(JSON.parse(raw, (k, v) => (k === 'remote' ? undefined : v)));
    if (next.length >= raw.length) continue;
    fs.writeFileSync(file, next);
    saved += raw.length - next.length;
  }
  if (saved) console.log(`data: -${(saved / 1024).toFixed(1)} KB de img.remote`);
  const shareFile = path.join(out, 'data', 'share.json');
  if (media && fs.existsSync(shareFile)) {
    const share: Record<string, { i?: string }> = JSON.parse(fs.readFileSync(shareFile, 'utf8'));
    for (const card of Object.values(share)) if (card.i?.startsWith('/media/')) card.i = media + card.i;
    fs.writeFileSync(shareFile, JSON.stringify(share));
  }
}

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

function serviceWorker(): Plugin {
  let out = 'dist';
  let root = '.';
  let media = '';
  return {
    name: 'service-worker',
    apply: 'build',
    configResolved(c) {
      out = path.resolve(c.root, c.build.outDir);
      root = c.root;
      const env = { ...loadEnv(c.mode, c.root, 'VITE_'), ...c.env };
      media = String(env.VITE_MEDIA_BASE_URL || process.env.VITE_MEDIA_BASE_URL || '')
        .trim()
        .replace(/\/+$/, '');
    },
    closeBundle() {
      finalizeData(out, media);
      writeServiceWorker(out, root, hostOf(media));
      fs.writeFileSync(path.join(out, '.assetsignore'), 'media/**\n');
    },
  };
}

export default defineConfig({
  base: './',
  resolve: {
    extensions: ['.mjs', '.mts', '.ts', '.tsx', '.jsx', '.js', '.json'],
  },
  plugins: [devMissingFiles(), react(), serviceWorker()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler') || id.includes('node_modules/zustand')) return 'react';
        },
      },
    },
  },
  server: { port: 5173 },
});
