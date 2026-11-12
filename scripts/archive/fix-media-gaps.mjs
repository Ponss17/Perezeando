#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { requireSharp, ROOT, writeWebpVariants } from '../shared.mjs';

const sharp = requireSharp();
const UA = 'PerezeandoContentBot/1.0 (https://perezeando.com; mapa de Costa Rica; build-time)';
const MEDIA = path.join(ROOT, 'public', 'media', 'places');
fs.mkdirSync(MEDIA, { recursive: true });

async function api(host, params) {
  const r = await fetch(`https://${host}/w/api.php?` + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params }), {
    headers: { 'User-Agent': UA, 'Api-User-Agent': UA },
  });
  return r.json();
}

async function commonsMeta(file) {
  const d = await api('commons.wikimedia.org', {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '1280',
    iiextmetadatafilter: 'Artist|LicenseShortName',
    titles: file.startsWith('File:') ? file : 'File:' + file,
  });
  const pg = d.query?.pages?.[0];
  const ii = pg?.imageinfo?.[0];
  if (!ii || !/jpeg|png|webp/i.test(ii.mime || '')) return null;
  const lic = String(ii.extmetadata?.LicenseShortName?.value || '').replace(/<[^>]+>/g, ' ').trim();
  const artist = String(ii.extmetadata?.Artist?.value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return { src: ii.thumburl || ii.url, page: ii.descriptionurl, artist: artist || undefined, license: lic || undefined };
}

async function save(id, meta) {
  const baseId = createHash('sha1').update(id).digest('hex').slice(0, 10);
  const r = await fetch(meta.src, { headers: { 'User-Agent': UA, Accept: 'image/*,*/*' }, signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('dl ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  await writeWebpVariants(sharp, buf, MEDIA, baseId);
  return {
    src: `/media/places/${baseId}-800.webp`,
    page: meta.page,
    artist: meta.artist,
    license: meta.license,
    remote: meta.src,
  };
}

const JOBS = [
  {
    id: 'fau-lapa-roja',
    file: 'Scarlet macaw in Costa Rica.jpg',
    where: 'fauna',
  },
  {
    id: 'fau-ballena-piloto',
    file: 'Short-finned pilot whale.jpg',
    where: 'fauna',
  },
  {
    id: 'wd-estadio-jose-angel-lito-monge',
    where: 'wd',
    search: 'Estadio Lito Monge',
    wiki: 'Estadio José Ángel Lito Monge',
  },
];

const fauna = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fauna-extra.json'), 'utf8'));
const places = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/places.json'), 'utf8'));
const wd = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/places-wd.json'), 'utf8'));
const photos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/photos.json'), 'utf8'));
photos.found ||= {};

for (const job of JOBS) {
  let meta = null;
  try {
    if (job.file) meta = await commonsMeta(job.file);
    if (!meta && job.wiki) {
      const d = await api('es.wikipedia.org', { action: 'query', prop: 'pageimages', piprop: 'name', redirects: '1', titles: job.wiki });
      const file = d.query?.pages?.[0]?.pageimage?.replace(/_/g, ' ');
      if (file) meta = await commonsMeta(file);
    }
    if (!meta && job.search) {
      const d = await api('commons.wikimedia.org', {
        action: 'query',
        generator: 'search',
        gsrsearch: job.search,
        gsrnamespace: '6',
        gsrlimit: '8',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|mime',
        iiurlwidth: '1280',
        iiextmetadatafilter: 'Artist|LicenseShortName',
      });
      for (const pg of d.query?.pages || []) {
        const file = (pg.title || '').replace(/^File:/, '');
        const ii = pg.imageinfo?.[0];
        const lic = String(ii?.extmetadata?.LicenseShortName?.value || '');
        if (!ii || !/jpeg|png|webp/i.test(ii.mime || '')) continue;
        if (!/cc0|cc[- ]by|public domain|pd\b/i.test(lic) || /nc|nd/i.test(lic)) continue;
        if (!/estadio|monge|desamparad/i.test(file)) continue;
        meta = {
          src: ii.thumburl || ii.url,
          page: ii.descriptionurl,
          artist: String(ii.extmetadata?.Artist?.value || '')
            .replace(/<[^>]+>/g, ' ')
            .trim()
            .slice(0, 80),
          license: lic,
        };
        break;
      }
    }
    if (!meta) {
      console.log('MISS', job.id);
      continue;
    }
    const img = await save(job.id, meta);
    delete img.allowRemote;
    photos.found[job.id] = { ...img, how: 'fix-gap' };
    if (job.where === 'fauna') {
      const p = fauna.find((x) => x.id === job.id);
      if (p) p.img = { ...img };
      const pl = places.find((x) => x.id === job.id);
      if (pl) pl.img = { ...img };
    }
    if (job.where === 'wd') {
      const p = wd.find((x) => x.id === job.id);
      if (p) {
        p.img = { ...img };
        if (!p.desc?.es) {
          p.desc = {
            es: 'Estadio de fútbol en Desamparados, sede histórica asociada a equipos de la zona sur de San José.',
            en: 'Football stadium in Desamparados, a historic venue linked to clubs in southern San José.',
          };
        }
      }
    }
    console.log('OK', job.id, '->', img.src);
  } catch (e) {
    console.log('ERR', job.id, e.message);
  }
}

fs.writeFileSync(path.join(ROOT, 'data/fauna-extra.json'), JSON.stringify(fauna));
fs.writeFileSync(path.join(ROOT, 'data/places.json'), JSON.stringify(places));
fs.writeFileSync(path.join(ROOT, 'data/places-wd.json'), JSON.stringify(wd));
fs.writeFileSync(path.join(ROOT, 'data/photos.json'), JSON.stringify(photos));
console.log('done');
