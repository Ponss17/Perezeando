/**
 * Sincroniza public/media → Cloudflare R2 (API S3).
 * Por defecto es --dry-run (no sube). Para subir: --upload
 * No borra objetos remotos.
 *
 * Env (solo en máquina local / CI; nunca en el frontend):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET=perezeando
 *
 * Uso:
 *   node scripts/sync-media-r2.mjs
 *   node scripts/sync-media-r2.mjs --upload
 *   node scripts/sync-media-r2.mjs --upload --prefix=media/places
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BASE = process.cwd();
const MEDIA_ROOT = path.join(BASE, 'public', 'media');
const doUpload = process.argv.includes('--upload');
const dryRun = !doUpload;
const prefixArg = (process.argv.find((a) => a.startsWith('--prefix=')) || '').slice('--prefix='.length);

const ACCOUNT = process.env.R2_ACCOUNT_ID || '';
const KEY = process.env.R2_ACCESS_KEY_ID || '';
const SECRET = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET = process.env.R2_BUCKET || 'perezeando';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.webp$/i.test(e.name)) out.push(p);
  }
  return out;
}

function objectKey(abs) {
  const rel = path.relative(path.join(BASE, 'public'), abs).split(path.sep).join('/');
  return rel; // media/places/….webp
}

const files = walk(MEDIA_ROOT)
  .map((f) => ({ abs: f, key: objectKey(f), bytes: fs.statSync(f).size }))
  .filter((f) => !prefixArg || f.key.startsWith(prefixArg.replace(/^\//, '')))
  .sort((a, b) => a.key.localeCompare(b.key));

console.log(
  JSON.stringify(
    {
      mode: dryRun ? 'dry-run' : 'upload',
      bucket: BUCKET,
      accountSet: Boolean(ACCOUNT),
      keySet: Boolean(KEY),
      secretSet: Boolean(SECRET),
      files: files.length,
      bytes: files.reduce((s, f) => s + f.bytes, 0),
      sample: files.slice(0, 5).map((f) => f.key),
    },
    null,
    2,
  ),
);

if (dryRun) {
  console.log('Dry-run: no se subió nada. Pasá --upload para sincronizar.');
  process.exit(0);
}

if (!ACCOUNT || !KEY || !SECRET) {
  console.error('Faltan R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY en el entorno.');
  process.exit(1);
}

let AwsClient, AwsV4Signer;
try {
  ({ AwsClient, AwsV4Signer } = require('aws4fetch'));
} catch {
  console.error('Instalá aws4fetch: pnpm add -D aws4fetch');
  process.exit(1);
}

const endpoint = `https://${ACCOUNT}.r2.cloudflarestorage.com`;
const client = new AwsClient({
  accessKeyId: KEY,
  secretAccessKey: SECRET,
  service: 's3',
  region: 'auto',
});

let ok = 0,
  fail = 0,
  skipped = 0;
for (const f of files) {
  const url = `${endpoint}/${BUCKET}/${f.key}`;
  try {
    // HEAD first — skip if same size (cheap)
    const head = await client.fetch(url, { method: 'HEAD' });
    if (head.ok) {
      const cl = Number(head.headers.get('content-length') || 0);
      if (cl === f.bytes) {
        skipped++;
        continue;
      }
    }
    const body = fs.readFileSync(f.abs);
    const res = await client.fetch(url, {
      method: 'PUT',
      body,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
    if (!res.ok) {
      fail++;
      console.error('FAIL', f.key, res.status);
    } else {
      ok++;
      if (ok % 25 === 0) console.log('uploaded', ok, '/', files.length);
    }
  } catch (e) {
    fail++;
    console.error('FAIL', f.key, e.message);
  }
}

console.log(JSON.stringify({ uploaded: ok, skippedSameSize: skipped, failed: fail, total: files.length }));
