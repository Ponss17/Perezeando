import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireSharp, ROOT, sleep, writeWebpVariants } from './shared.mjs';


const sharp = requireSharp();
const MEDIA = path.join(ROOT, 'public', 'media', 'places');
fs.mkdirSync(MEDIA, { recursive: true });
const CACHE_PATH = path.join(ROOT, 'scripts', 'data', 'fauna-fetch-cache.json');
const cache = fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : {};

async function wikiPageImage(title, lang = 'es') {
  const key = lang + ':' + title;
  if (cache[key]) return cache[key];
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|pageprops&piprop=original|name&pilicense=any&titles=` +
    encodeURIComponent(title) +
    '&origin=*';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PerezeandoMap/1.0 (local build; fauna media; contact: local)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error('wiki ' + res.status);
  const data = await res.json();
  const page = Object.values(data.query?.pages || {})[0];
  const out = {
    file: page?.pageimage || null,
    original: page?.original?.source || null,
  };
  cache[key] = out;
  return out;
}

async function commonsInfo(file) {
  const key = 'commons:' + file;
  if (cache[key]?.artist) return cache[key];
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=1280&titles=' +
    encodeURIComponent('File:' + file) +
    '&origin=*';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PerezeandoMap/1.0 (local build; fauna media)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error('commons ' + res.status);
  const data = await res.json();
  const page = Object.values(data.query?.pages || {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const md = ii.extmetadata || {};
  const artist = (md.Artist?.value || '').replace(/<[^>]+>/g, '').slice(0, 120);
  const license = (md.LicenseShortName?.value || md.License?.value || '').slice(0, 80);
  const out = {
    thumb: ii.thumburl || ii.url,
    url: ii.url,
    artist,
    license,
    page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_')),
    mime: ii.mime,
  };
  cache[key] = out;
  return out;
}

async function saveWebp(buf, baseId) {
  const bytes800 = await writeWebpVariants(sharp, buf, MEDIA, baseId, 6);
  return { local: `/media/places/${baseId}-800.webp`, bytes: bytes800 };
}

const faunaExtra = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fauna-extra.json'), 'utf8'));
const places = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'places.json'), 'utf8'));
const photosPath = path.join(ROOT, 'data', 'photos.json');
const photos = fs.existsSync(photosPath) ? JSON.parse(fs.readFileSync(photosPath, 'utf8')) : { found: {} };
photos.found = photos.found || {};

const allFauna = [
  ...places.filter((p) => p.cat === 'fauna' || p.cat === 'faunaTerrestre'),
  ...faunaExtra,
];

let ok = 0, skip = 0, fail = 0;
for (const p of allFauna) {
  const existing = photos.found[p.id]?.src || p.img?.src || '';
  if (typeof existing === 'string' && existing.startsWith('/media/')) {
    skip++;
    continue;
  }
  const baseId = crypto.createHash('sha1').update('fauna:' + p.id).digest('hex').slice(0, 10);
  if (fs.existsSync(path.join(MEDIA, `${baseId}-800.webp`))) {
    const local = `/media/places/${baseId}-800.webp`;
    const img = {
      src: local,
      page: photos.found[p.id]?.page || p.img?.page,
      artist: photos.found[p.id]?.artist || p.img?.artist,
      license: photos.found[p.id]?.license || p.img?.license,
      remote: typeof existing === 'string' && existing.startsWith('http') ? existing : undefined,
    };
    photos.found[p.id] = img;
    if (!p.img || !String(p.img.src || '').startsWith('/media/')) {
      const fe = faunaExtra.find((x) => x.id === p.id);
      if (fe) fe.img = img;
    }
    skip++;
    continue;
  }

  const remote = (typeof existing === 'string' && existing.startsWith('http')) ? existing
    : (p.img?.src?.startsWith('http') ? p.img.src : null);
  if (remote && !/\.svg(\?|$)/i.test(remote)) {
    try {
      await sleep(3200);
      const res = await fetch(remote, {
        headers: { 'User-Agent': 'PerezeandoMap/1.0 (local build; fauna media)' },
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error('dl ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) throw new Error('tiny');
      const saved = await saveWebp(buf, baseId);
      const img = {
        src: saved.local,
        page: p.img?.page,
        artist: p.img?.artist || 'Wikimedia Commons',
        license: p.img?.license || 'see Commons',
        remote,
      };
      photos.found[p.id] = img;
      const fe = faunaExtra.find((x) => x.id === p.id);
      if (fe) fe.img = { src: img.src, page: img.page, artist: img.artist, license: img.license };
      const pl = places.find((x) => x.id === p.id);
      if (pl) pl.img = { src: img.src, page: img.page, artist: img.artist, license: img.license };
      console.log('OK-remote', p.id, saved.bytes);
      ok++;
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
      continue;
    } catch (e) {
      console.warn('remote-fail', p.id, e.message);
    }
  }
  const title = p.wiki?.es || p.wiki?.en;
  if (!title) {
    fail++;
    console.warn('sin wiki', p.id);
    continue;
  }
  try {
    await sleep(3200);
    let info = await wikiPageImage(title, 'es');
    if (!info.file && !info.original) {
      await sleep(3200);
      info = await wikiPageImage(p.wiki?.en || title, 'en');
    }
    let file = info.file;
    let downloadUrl = info.original;
    if (file && /\.svg$/i.test(file)) { file = null; downloadUrl = null; }
    if (file) {
      await sleep(3200);
      const c = await commonsInfo(file);
      if (c) {
        downloadUrl = c.thumb || c.url;
        const res = await fetch(downloadUrl, {
          headers: { 'User-Agent': 'PerezeandoMap/1.0 (local build; fauna media)' },
          signal: AbortSignal.timeout(60000),
        });
        if (!res.ok) throw new Error('dl ' + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) throw new Error('tiny');
        const saved = await saveWebp(buf, baseId);
        const img = {
          src: saved.local,
          page: c.page,
          artist: c.artist || 'Wikimedia Commons',
          license: c.license || 'see Commons',
          remote: c.url,
        };
        photos.found[p.id] = img;
        const fe = faunaExtra.find((x) => x.id === p.id);
        if (fe) fe.img = { src: img.src, page: img.page, artist: img.artist, license: img.license };
        const pl = places.find((x) => x.id === p.id);
        if (pl) pl.img = { src: img.src, page: img.page, artist: img.artist, license: img.license };
        console.log('OK', p.id, saved.bytes, file);
        ok++;
      } else {
        fail++;
        console.warn('no commons', p.id, file);
      }
    } else if (downloadUrl) {
      const res = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'PerezeandoMap/1.0 (local build; fauna media)' },
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error('dl ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      const saved = await saveWebp(buf, baseId);
      const img = { src: saved.local, page: p.img?.page, artist: p.img?.artist, license: p.img?.license, remote: downloadUrl };
      photos.found[p.id] = img;
      const fe = faunaExtra.find((x) => x.id === p.id);
      if (fe) fe.img = img;
      console.log('OK-orig', p.id, saved.bytes);
      ok++;
    } else {
      fail++;
      console.warn('sin imagen', p.id, title);
    }
  } catch (e) {
    fail++;
    console.warn('FAIL', p.id, e.message);
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2));
fs.writeFileSync(path.join(ROOT, 'data', 'fauna-extra.json'), JSON.stringify(faunaExtra, null, 2));
fs.writeFileSync(path.join(ROOT, 'data', 'places.json'), JSON.stringify(places, null, 2));
console.log({ ok, skip, fail, mediaDir: MEDIA });
