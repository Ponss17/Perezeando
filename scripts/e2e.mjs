import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './shared.mjs';
import { NEAR_CAP, NEAR_RADIUS_KM, NEAR_RADIUS_EXPAND_KM } from './near-const.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadPuppeteer() {
  try {
    return (await import('puppeteer-core')).default;
  } catch {
    try {
      const req = createRequire(path.join(process.env.TEMP || '/tmp', 'pz-e2e', 'x.js'));
      return req('puppeteer-core');
    } catch {
      return null;
    }
  }
}

function findChrome() {
  const env = process.env.CHROME_PATH;
  const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  return [
    env,
    path.join(pf, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
    path.join(local, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
    path.join(pf, 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((p) => p && fs.existsSync(p));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function serveDist(dir) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(dir, u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

const puppeteer = await loadPuppeteer();
const chrome = findChrome();
if (!puppeteer || !chrome) {
  console.error(
    !puppeteer
      ? 'Falta puppeteer-core. Ver HANDOFF.md → E2E (npm install --prefix "$env:TEMP\\pz-e2e" puppeteer-core).'
      : 'No encontré Chrome/Edge. Definí CHROME_PATH con la ruta del ejecutable.',
  );
  process.exit(2);
}

const dist = path.join(ROOT, 'dist');
let srv = null;
let BASE = arg('url');
if (!BASE) {
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('No hay dist/. Corré `pnpm build` primero.');
    process.exit(2);
  }
  srv = await serveDist(dist);
  BASE = `http://127.0.0.1:${srv.address().port}/`;
}
const SHOTS = arg('shots');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = (p, name) => (SHOTS ? p.screenshot({ path: path.join(SHOTS, name + '.png') }) : null);

const parseKm = (s) => Number(String(s).replace(/\s*km.*/i, '').replace(',', '.').trim());

async function readNearby(p) {
  return p.evaluate(() => {
    const title = document.querySelector('.result-count')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const items = [...document.querySelectorAll('#resultList .item[data-id]')].map((el) => ({
      id: el.getAttribute('data-id'),
      dist: el.querySelector('.item-dist')?.textContent || '',
    }));
    const wraps = (() => {
      const row = document.querySelector('.meta-row');
      const count = document.querySelector('.result-count');
      if (!row || !count) return null;
      const rs = getComputedStyle(count);
      return {
        title: count.textContent.replace(/\s+/g, ' ').trim(),
        nowrap: rs.whiteSpace === 'nowrap',
        overflow: count.scrollWidth > count.clientWidth + 1,
        rowH: Math.round(row.getBoundingClientRect().height),
        countH: Math.round(count.getBoundingClientRect().height),
      };
    })();
    return { title, items, wraps };
  });
}

function assertNearby(info, { nameRe, radius = NEAR_RADIUS_EXPAND_KM, cap = NEAR_CAP, exact } = {}) {
  if (info.items.length > cap) throw new Error('cap ' + info.items.length);
  if (nameRe && !nameRe.test(info.title)) throw new Error('header=' + info.title);
  if (exact != null && info.items.length !== exact) throw new Error('n=' + info.items.length + ' expected ' + exact);
  const kms = info.items.map((x) => parseKm(x.dist));
  if (kms.some((n) => !Number.isFinite(n))) throw new Error('dist ' + JSON.stringify(info.items.slice(0, 5)));
  const over = kms.filter((n) => n > radius + 0.05);
  if (over.length) throw new Error('over ' + radius + 'km: ' + over.join(','));
  return kms;
}

async function countDetail(page) {
  return page.evaluate(() => ({
    heroes: document.querySelectorAll('.hero').length,
    tops: document.querySelectorAll('.hero-top').length,
    details: document.querySelectorAll('section.detail').length,
    panes: document.querySelectorAll('.detail-pane').length,
    h2: [...document.querySelectorAll('.detail-body h2')].map((e) => e.textContent.trim()),
    nearbyItems: document.querySelectorAll('.nearby .item[data-id]').length,
    nearbyMore: document.querySelector('.nearby-more')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    resultCount: document.querySelector('.result-count')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    inDetail: !!document.querySelector('section.detail'),
  }));
}

function assertOneDetail(info) {
  if (info.details !== 1) throw new Error('details=' + info.details);
  if (info.heroes !== 1) throw new Error('heroes=' + info.heroes + ' h2=' + info.h2);
  if (info.tops !== 1) throw new Error('tops=' + info.tops);
  if (info.panes !== 1) throw new Error('panes=' + info.panes);
  if (info.h2.length !== 1) throw new Error('h2=' + JSON.stringify(info.h2));
}

async function readMeta(p) {
  return p.evaluate(() => {
    const row = document.querySelector('.meta-row');
    if (!row) return null;
    const kids = [
      ...row.querySelectorAll(
        '.browse-mode-btn, .result-count, .hidden-cats, .meta-actions .text-btn, .result-meta > b',
      ),
    ];
    const boxes = kids.map((k) => {
      const b = k.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, h: b.height };
    });
    const minTop = Math.min(...boxes.map((b) => b.top));
    const maxBottom = Math.max(...boxes.map((b) => b.bottom));
    const maxH = Math.max(...boxes.map((b) => b.h));
    const active = row.querySelector('.browse-mode-btn[aria-pressed="true"]');
    const bg = (e) => (e ? getComputedStyle(e).backgroundColor : null);
    const labels = [...row.querySelectorAll('.meta-actions .text-btn.icon-only')].map(
      (e) => e.getAttribute('aria-label') || '',
    );
    const ind = row.querySelector('.browse-ind');
    const ir = ind?.getBoundingClientRect();
    const ar = active?.getBoundingClientRect();
    let indOver = false;
    if (ir && ar) {
      const cx = (ar.left + ar.right) / 2;
      const cy = (ar.top + ar.bottom) / 2;
      indOver = cx >= ir.left - 1 && cx <= ir.right + 1 && cy >= ir.top - 1 && cy <= ir.bottom + 1;
    }
    return {
      wrap: maxBottom - minTop > maxH + 8,
      flexWrap: getComputedStyle(row).flexWrap,
      rowH: Math.round(row.getBoundingClientRect().height),
      text: row.innerText.replace(/\s+/g, ' ').trim(),
      indBg: bg(ind),
      hasInd: !!ind,
      indOver,
      hasToggle: !!active,
      labels,
    };
  });
}

function assertMeta(info, { toggle = true, label = 'meta-row' } = {}) {
  if (!info) throw new Error(label + ' ausente');
  if (info.flexWrap !== 'nowrap') throw new Error(label + ' wrap=' + info.flexWrap);
  if (info.wrap) throw new Error(label + ' se parte: ' + info.text + ' h=' + info.rowH);
  if (info.labels.length < 2 || info.labels.some((x) => !x))
    throw new Error(label + ' sin aria-label de acciones');
  if (toggle) {
    if (!info.hasToggle) throw new Error(label + ' sin toggle');
    const clear = (c) => !c || c === 'transparent' || /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(c);
    if (!info.hasInd || clear(info.indBg) || !info.indOver)
      throw new Error(label + ' sin indicador: ' + info.indBg + ' over=' + info.indOver);
  }
  return `${info.text} h=${info.rowH}`;
}


async function checkBrowseToggle(p) {
  const read = () =>
    p.evaluate(() => ({
      pressed:
        document.querySelector('.browse-mode-btn[aria-pressed="true"]')?.textContent.replace(/\s+/g, ' ').trim() || '',
      disc: !!document.querySelector('.discover-sec'),
      dataAll: document.querySelector('.browse-mode')?.hasAttribute('data-all') || false,
      heads: [...document.querySelectorAll('#resultList .list-head')].map((e) => e.textContent.trim()).slice(0, 3),
    }));
  const a = await read();
  if (!/Imperdibles/i.test(a.pressed) || !a.disc || a.dataAll) throw new Error('inicio ' + JSON.stringify(a));
  await p.click('.browse-mode-btn[aria-pressed="false"]');
  await sleep(450);
  const b = await read();
  if (!/Todos/i.test(b.pressed) || b.disc || !b.dataAll) throw new Error('todos ' + JSON.stringify(b));
  await p.click('.browse-mode-btn[aria-pressed="false"]');
  await sleep(450);
  const c = await read();
  if (!/Imperdibles/i.test(c.pressed) || !c.disc || c.dataAll) throw new Error('vuelta ' + JSON.stringify(c));
  return `Imperdibles ↔ Todos (${b.heads[0] || 'ok'})`;
}

async function checkMenus(p, { minOptH = 0 } = {}) {
  const probe = () =>
    p.evaluate(async () => {
      const ul = document.querySelector('.sx-list');
      if (!ul) return { open: false };
      const opts = [...ul.querySelectorAll('[role=option]')];
      let vis = 0;
      const bad = [];
      for (const o of opts) {
        o.scrollIntoView({ block: 'nearest' });
        await new Promise((res) => requestAnimationFrame(() => res()));
        const b = o.getBoundingClientRect();
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        const inVp = b.top >= 0 && b.bottom <= innerHeight + 0.5 && b.left >= 0 && b.right <= innerWidth + 0.5;
        const hit = document.elementFromPoint(cx, cy);
        if (inVp && hit && o.contains(hit)) vis++;
        else bad.push(o.textContent.trim().slice(0, 24));
      }
      const hs = opts.map((o) => o.getBoundingClientRect().height);
      return { open: true, total: opts.length, visible: vis, bad, minOptH: Math.min(...hs) };
    });
  const run = async (idx, pick) => {
    const sel = `.filters .field:nth-child(${idx + 1}) .sx-trigger`;
    const el = await p.$(sel);
    const tb = el && (await el.boundingBox());
    if (!tb) throw new Error('sin trigger ' + idx);
    await p.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await sleep(400);
    const info = await probe();
    if (!info.open) throw new Error('menú no abrió ' + idx);
    if (info.visible !== info.total)
      throw new Error(`menú ${idx}: ${info.visible}/${info.total} ${info.bad.join(',')}`);
    if (minOptH && info.minOptH < minOptH - 0.5) throw new Error('optH=' + info.minOptH);
    const opt = await p.evaluateHandle(
      (t) => [...document.querySelectorAll('.sx-list [role=option]')].find((o) => o.textContent.includes(t)),
      pick,
    );
    if (!(await opt.evaluate((o) => !!o))) throw new Error('no está ' + pick);
    await opt.evaluate((o) => o.scrollIntoView({ block: 'nearest' }));
    await sleep(80);
    const ob = await opt.boundingBox();
    if (!ob) throw new Error('sin caja ' + pick);
    await p.mouse.click(ob.x + ob.width / 2, ob.y + ob.height / 2);
    await sleep(400);
    const label = await p.$eval(sel, (e) => e.textContent.trim());
    if (!label.includes(pick)) throw new Error(`pick ${pick} → "${label}"`);
    if (await p.$('.sx-list')) throw new Error('no cerró tras pick');
    return { ...info, picked: label };
  };
  const prov = await run(0, 'Limón');
  await p.evaluate(() => {
    __cract.setProv('all');
    __cract.setCat('all');
  });
  await sleep(300);
  const cat = await run(1, 'Playas');
  const t0 = await (await p.$('.filters .field:nth-child(1) .sx-trigger')).boundingBox();
  await p.mouse.click(t0.x + t0.width / 2, t0.y + t0.height / 2);
  await sleep(300);
  if (!(await p.$('.sx-list'))) throw new Error('no reabrió');
  await p.mouse.click(10, 10);
  await sleep(250);
  if (await p.$('.sx-list')) throw new Error('no cerró al tocar fuera');
  await p.evaluate(() => {
    __cract.setProv('all');
    __cract.setCat('all');
  });
  await sleep(300);
  return `prov ${prov.visible}/${prov.total} “${prov.picked}” | cat ${cat.visible}/${cat.total} “${cat.picked}”`;
}

const NOISE = /cloudflareinsights|ERR_|Failed to load resource/;

const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
const res = {};
let failed = 0;
const step = async (name, fn) => {
  try {
    const v = await fn();
    res[name] = v === undefined ? 'ok' : v;
  } catch (e) {
    failed++;
    res[name] = 'FAIL: ' + String(e.message).slice(0, 160);
  }
};

async function open(vp, opt = {}) {
  const ctx = await b.createBrowserContext();
  const origin = new URL(BASE).origin;
  if (opt.denyGeo) await ctx.overridePermissions(origin, []);
  else if (opt.geo) await ctx.overridePermissions(origin, ['geolocation']);
  const p = await ctx.newPage();
  if (opt.denyGeo) {
    await p.evaluateOnNewDocument(() => {
      const err = Object.assign(new Error('User denied Geolocation'), { code: 1, PERMISSION_DENIED: 1 });
      navigator.geolocation.getCurrentPosition = (_s, e) => e && e(err);
      navigator.geolocation.watchPosition = (_s, e) => e && e(err);
      const orig = navigator.permissions?.query?.bind(navigator.permissions);
      if (orig) {
        navigator.permissions.query = (q) =>
          q && q.name === 'geolocation' ? Promise.resolve({ state: 'denied', onchange: null }) : orig(q);
      }
    });
  }
  if (opt.geo) await p.setGeolocation(opt.geo);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !NOISE.test(m.text()) && errs.push(m.text().slice(0, 200)));
  await p.setViewport(vp);
  await p.goto(BASE + '?e2e', { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => window.__crmap && window.__crmap.loaded() && window.__cract, { timeout: 90000 });
  await p.waitForFunction(() => !document.querySelector('.boot-splash'), { timeout: 30000 }).catch(() => {});
  await sleep(1500);
  return { ctx, p, errs };
}

try {
  {
    const { ctx, p, errs } = await open({ width: 1440, height: 900 });
    await shot(p, 'desktop-home');
    await step('meta_row', async () => {
      const home = assertMeta(await readMeta(p), { label: 'escritorio home' });
      await p.evaluate(() => __cract.setProv('alajuela'));
      await sleep(600);
      const prov = assertMeta(await readMeta(p), { toggle: false, label: 'escritorio filtro' });
      await p.evaluate(() => __cract.setProv('all'));
      await sleep(400);
      await p.click('.browse-mode-btn[aria-pressed="false"]');
      await sleep(400);
      const all = assertMeta(await readMeta(p), { label: 'escritorio todos' });
      await p.click('.browse-mode-btn[aria-pressed="false"]');
      await sleep(200);
      return `${home} | ${prov} | ${all}`;
    });
    await step('browse_toggle', async () => checkBrowseToggle(p));
    await step('filters_menu', async () => checkMenus(p));
    await step('search', async () => {
      const i = await p.$('.search input, input[type=search]');
      await i.click();
      await i.type('arenal', { delay: 40 });
      await sleep(900);
      const n = await p.$$eval('#resultList .item', (x) => x.length);
      await shot(p, 'desktop-search');
      await p.keyboard.press('Escape');
      await i.click({ clickCount: 3 });
      await p.keyboard.press('Backspace');
      await sleep(500);
      const left = await i.evaluate((x) => x.value);
      if (left) throw new Error(`la búsqueda no se limpió ("${left}")`);
      if (!n) throw new Error('0 resultados');
      return `${n} resultados`;
    });
    await step('filter_fauna', async () => {
      const count = () => p.$$eval('#resultList .item', (x) => x.length);
      await p.evaluate(() => __cract.setCat('faunaTerrestre'));
      await sleep(700);
      const a = await count();
      await p.evaluate(() => __cract.setCat('fauna'));
      await sleep(500);
      const m = await count();
      await p.evaluate(() => __cract.setProv('limon'));
      await sleep(700);
      const l = await count();
      await shot(p, 'desktop-filter');
      await p.evaluate(() => {
        __cract.setCat('all');
        __cract.setProv('all');
      });
      await sleep(500);
      if (!a || !m) throw new Error(`terrestre ${a} marina ${m}`);
      return `terrestre ${a}, marina ${m}, marina+limón ${l}`;
    });
    await step('place_detail', async () => {
      await p.evaluate(() => __cract.select('vol-volcan-arenal'));
      await p.waitForSelector('.detail-body h2', { timeout: 15000 });
      await p.waitForSelector('.hero.loaded .hero-img', { timeout: 20000 });
      await sleep(500);
      await shot(p, 'desktop-place');
      return 'hero ok';
    });
    await step('fav_route', async () => {
      const q = await p.$$('.detail-body .quick .qa');
      await q[1].click();
      await sleep(200);
      await q[2].click();
      await sleep(400);
      const on = await p.$$eval('.detail-body .quick .qa', (x) => x.map((e) => e.getAttribute('aria-pressed')));
      if (on[1] !== 'true' || on[2] !== 'true') throw new Error(on.join(','));
      return 'ok';
    });
    await step('no_photo', async () => {
      await p.evaluate(() => __cract.deselect());
      await sleep(300);
      const id = await p.evaluate(async () => {
        const a = await (await fetch('data/atlas.json')).json();
        return a.places.find((x) => !x.img && x.cat !== 'gastronomia').id;
      });
      await p.evaluate((i) => __cract.select(i), id);
      await p.waitForSelector('.hero.noimg', { timeout: 10000 });
      return id;
    });
    await step('province_tabs', async () => {
      await p.evaluate(() => __cract.showProvince('limon'));
      await p.waitForSelector('.ptab-bar', { timeout: 15000 });
      for (const t of ['data', 'food', 'culture', 'sports', 'activities']) {
        await p.click(`[data-ptab="${t}"]`);
        await sleep(600);
        if ((await p.$eval(`[data-ptab="${t}"]`, (x) => x.getAttribute('aria-selected'))) !== 'true')
          throw new Error(t);
        if (t === 'culture') await shot(p, 'desktop-province-culture');
      }
      return '5/5';
    });
    await step('cluster_menu', async () => {
      await p.evaluate(() => __cract.deselect());
      await sleep(500);
      await p.evaluate(() => __crmap.jumpTo({ center: [-84.08, 9.93], zoom: 7.6 }));
      await sleep(2000);
      const pt = await p.evaluate(() => {
        const fs = __crmap.queryRenderedFeatures({ layers: ['clusters'] });
        fs.sort((a, b) => a.properties.point_count - b.properties.point_count);
        const f = fs[0];
        if (!f) return null;
        const q = __crmap.project(f.geometry.coordinates);
        const r = __crmap.getCanvas().getBoundingClientRect();
        return [q.x + r.left, q.y + r.top];
      });
      if (!pt) throw new Error('sin grupos');
      const z0 = await p.evaluate(() => __crmap.getZoom());
      await p.mouse.click(pt[0], pt[1]);
      await sleep(1200);
      if (await p.$('.cl-pop')) {
        await shot(p, 'desktop-cluster');
        const n = await p.$$eval('.cl-pop .cl-item', (x) => x.length);
        await p.keyboard.press('Escape');
        return `menú (${n})`;
      }
      if ((await p.evaluate(() => __crmap.getZoom())) > z0 + 0.05) return 'acercó';
      throw new Error('no pasó nada');
    });
    await step('route_favs_tabs', async () => {
      const tabs = await p.$$('.tabs [role=tab]');
      await tabs[2].click();
      await sleep(1000);
      const stops = await p.$$eval('.stop', (x) => x.length).catch(() => 0);
      await shot(p, 'desktop-route');
      await tabs[3].click();
      await sleep(700);
      const favs = await p.$$eval('.tab-pane.active .item', (x) => x.length);
      if (!stops || !favs) throw new Error(`paradas ${stops} favs ${favs}`);
      return `${stops} paradas, ${favs} favoritos`;
    });
    await step('credits_policies', async () => {
      let ok = false;
      for (const x of await p.$$('.link-btn')) {
        await x.click();
        await sleep(400);
        if (await p.$('#credits[open]')) {
          ok = true;
          break;
        }
      }
      if (!ok) throw new Error('créditos no abre');
      await shot(p, 'desktop-credits');
      await p.click('#credits .close');
      await sleep(300);
      await p.evaluate(() => {
        history.pushState(null, '', location.pathname + '?e2e&politicas=1' + location.hash);
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await p.waitForSelector('#policies[open]', { timeout: 5000 });
      await shot(p, 'desktop-policies');
      await p.click('#policies .close');
      await sleep(300);
      if ((await p.$('#credits[open]')) || (await p.$('#policies[open]'))) throw new Error('no cierra');
      return 'ok';
    });
    await step('locate_near', async () => {
      const SJ = { latitude: 9.9281, longitude: -84.0907, accuracy: 40 };
      await ctx.overridePermissions(new URL(BASE).origin, ['geolocation']);
      await p.setGeolocation(SJ);
      await p.evaluate(() => __cract.locate(true));
      await p.waitForFunction(() => document.querySelector('.me-pin') && document.querySelector('.item-dist'), {
        timeout: 15000,
      });
      const info = await readNearby(p);
      const pin = await p.evaluate(() => {
        const el = document.querySelector('.me-pin');
        return { ok: !!el, title: el?.title || '' };
      });
      const kms = assertNearby(info, { nameRe: /lugares cerca de mí|places near me/, radius: NEAR_RADIUS_KM });
      await shot(p, 'desktop-locate');
      if (!pin.ok) throw new Error('sin marcador');
      return `${info.items.length} distancias ≤${NEAR_RADIUS_KM} km (máx ${kms.at(-1)}), pin=${pin.title}, “${info.title}”`;
    });
    await step('nearby_inline', async () => {
      await p.evaluate(() => __cract.select('wd-volcan-tortuguero'));
      await p.waitForSelector('.nearby', { timeout: 15000 });
      await sleep(500);
      const before = await countDetail(p);
      if (!before.inDetail) throw new Error('salió del detalle');
      if (before.resultCount) throw new Error('abrió explore: ' + before.resultCount);
      if (before.nearbyItems > 6) throw new Error('preview ' + before.nearbyItems);
      if (!before.nearbyMore) throw new Error('sin botón ver más');
      await p.click('.nearby-more');
      await sleep(500);
      const after = await p.evaluate(() => {
        const items = [...document.querySelectorAll('.nearby .item[data-id]')].map((el) => ({
          id: el.getAttribute('data-id'),
          dist: el.querySelector('.item-dist')?.textContent || '',
        }));
        return {
          n: items.length,
          items,
          inDetail: !!document.querySelector('section.detail'),
          heroes: document.querySelectorAll('.hero').length,
          h2: document.querySelector('.detail-body h2')?.textContent?.trim(),
          resultCount: document.querySelector('.result-count')?.textContent || '',
          btn: document.querySelector('.nearby-more')?.textContent?.replace(/\s+/g, ' ').trim(),
        };
      });
      if (!after.inDetail) throw new Error('salió al expandir');
      if (after.resultCount) throw new Error('explore ' + after.resultCount);
      if (after.heroes !== 1) throw new Error('heroes=' + after.heroes);
      if (after.n <= before.nearbyItems) throw new Error('no expandió ' + after.n);
      if (after.n > NEAR_CAP) throw new Error('cap ' + after.n);
      const kms = after.items.map((x) => parseKm(x.dist));
      if (kms.some((k) => !Number.isFinite(k) || k > NEAR_RADIUS_KM + 0.05))
        throw new Error('radio ' + kms.join(','));
      if (after.n !== 15) throw new Error('n=' + after.n);
      await shot(p, 'desktop-nearby-inline');
      return `${before.nearbyItems} → ${after.n} en ficha “${after.h2}”, “${after.btn}”`;
    });
    await step('detail_no_stack', async () => {
      const ids = [
        'wd-volcan-tortuguero',
        'aer-aerodromo-de-tortuguero',
        'par-p-n-tortuguero',
        'ciu-tortuguero',
        'wd-rio-tortuguero',
        'par-p-n-manuel-antonio',
        'vol-volcan-arenal',
      ];
      for (const id of ids) {
        await p.evaluate((id) => __cract.select(id), id);
        await sleep(40);
      }
      await sleep(500);
      assertOneDetail(await countDetail(p));
      await shot(p, 'desktop-detail-rapid');
      await p.evaluate(() => __cract.deselect());
      await p.waitForSelector('#resultList .item[data-id]', { timeout: 10000 });
      const listIds = await p.$$eval('#resultList .item[data-id]', (els) =>
        els.slice(0, 6).map((e) => e.getAttribute('data-id')),
      );
      for (const id of listIds) {
        await p.waitForSelector(`#resultList .item[data-id="${id}"]`, { timeout: 10000 });
        await p.click(`#resultList .item[data-id="${id}"]`);
        await sleep(80);
        assertOneDetail(await countDetail(p));
        await p.evaluate(() => __cract.deselect());
        await sleep(80);
        await p.waitForSelector('#resultList .item[data-id]', { timeout: 10000 });
      }
      await p.evaluate(() => __cract.select('wd-volcan-tortuguero'));
      await p.waitForSelector('.nearby .item[data-id]', { timeout: 10000 });
      const more = await p.$('.nearby-more');
      if (more) await more.click();
      await sleep(200);
      const nearIds = await p.$$eval('.nearby .item[data-id]', (els) =>
        els.slice(0, 6).map((e) => e.getAttribute('data-id')),
      );
      for (const id of nearIds) {
        await p.click(`.nearby .item[data-id="${id}"]`);
        await sleep(60);
        assertOneDetail(await countDetail(p));
      }
      await shot(p, 'desktop-detail-nearby-clicks');
      await p.evaluate(() => history.back());
      await sleep(500);
      const back = await countDetail(p);
      if (back.heroes > 1 || back.details > 1) throw new Error('back ' + JSON.stringify(back));
      await p.evaluate(() => history.forward());
      await sleep(500);
      const fwd = await countDetail(p);
      if (fwd.heroes > 1 || fwd.details > 1) throw new Error('fwd ' + JSON.stringify(fwd));
      if (fwd.details === 1) assertOneDetail(fwd);
      await shot(p, 'desktop-detail-history');
      return `1 ficha tras ${ids.length} selects, lista, cercanos, atrás/adelante`;
    });
    res.desktop_errors = errs;
    if (errs.length) failed++;
    await ctx.close();
  }
  {
    await step('locate_denied', async () => {
      const { ctx, p, errs } = await open({ width: 1440, height: 900 }, { denyGeo: true });
      try {
        await p.evaluate(() => __cract.locate(true));
        await p.waitForSelector('.notice', { timeout: 10000 });
        const txt = await p.$eval('.notice', (x) => x.textContent);
        await shot(p, 'desktop-locate-denied');
        if (!/permiso|blocked|bloqueado|ubicación/i.test(txt)) throw new Error(txt.slice(0, 120));
        if (await p.$('.me-pin')) throw new Error('marcador con permiso denegado');
        res.locate_denied = 'ok: ' + txt.replace(/\s+/g, ' ').trim().slice(0, 80);
        if (errs.length) {
          failed++;
          res.locate_denied_errors = errs;
        }
        return res.locate_denied;
      } finally {
        await ctx.close();
      }
    });
  }
  {
    await step('offline_repeat', async () => {
      const { ctx, p, errs } = await open({ width: 1440, height: 900 });
      try {
        await p.evaluate(() => navigator.serviceWorker.ready);
        await sleep(4000);
        const firstN = await p.$$eval('#resultList .item, #resultList li', (x) => x.length);
        if (!firstN) throw new Error('primera visita sin lista');
        await p.close();

        const p2 = await ctx.newPage();
        p2.setDefaultTimeout(90000);
        await p2.setViewport({ width: 1440, height: 900 });
        await p2.goto(BASE + '?e2e', { waitUntil: 'load', timeout: 90000 });
        await p2.waitForFunction(() => window.__crmap && window.__crmap.loaded() && window.__cract, { timeout: 90000 });
        await sleep(2000);
        const mlCached = await p2.evaluate(async () => {
          let n = 0;
          for (const name of await caches.keys()) {
            const ks = await (await caches.open(name)).keys();
            n += ks.filter((r) => /maplibre/i.test(r.url)).length;
          }
          return n;
        });
        if (mlCached < 1) throw new Error('MapLibre no quedó en caché tras la 2ª visita');
        await p2.close();

        const p3 = await ctx.newPage();
        p3.setDefaultTimeout(90000);
        await p3.setViewport({ width: 1440, height: 900 });
        await p3.setOfflineMode(true);
        await p3.goto(BASE + '?e2e', { waitUntil: 'domcontentloaded', timeout: 90000 });
        await p3.waitForFunction(() => window.__crmap && window.__crmap.loaded() && window.__cract, { timeout: 90000 });
        await sleep(1500);
        const listN = await p3.$$eval('#resultList .item, #resultList li', (x) => x.length);
        if (!listN) throw new Error('offline sin lista');
        await p3.evaluate(() => __cract.select('wd-volcan-tortuguero'));
        await p3.waitForSelector('.nearby .item[data-id]', { timeout: 15000 });
        const nearN = await p3.$$eval('.nearby .item[data-id]', (els) => els.length);
        if (!nearN) throw new Error('offline sin cercanos');
        await shot(p3, 'desktop-offline-repeat');
        const h2 = await p3.$eval('.detail-body h2', (e) => e.textContent.trim());
        if (errs.length) throw new Error('js ' + errs[0]);
        return `offline lista ${listN}, cercanos ${nearN}, mlCached ${mlCached}, “${h2}”`;
      } finally {
        await ctx.close();
      }
    });
  }
  {
    const vp = { width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 };
    const { ctx, p, errs } = await open(vp, {
      geo: { latitude: 9.9281, longitude: -84.0907, accuracy: 40 },
    });
    await shot(p, 'mobile-home');
    await step('m_meta_row', async () => {
      await p.click('.tabs [role=tab]').catch(() => {});
      await sleep(400);
      const home = assertMeta(await readMeta(p), { label: 'móvil home' });
      await p.evaluate(() => __cract.setProv('alajuela'));
      await sleep(600);
      const prov = assertMeta(await readMeta(p), { toggle: false, label: 'móvil filtro' });
      await p.evaluate(() => __cract.setProv('all'));
      await sleep(400);
      await p.click('.browse-mode-btn[aria-pressed="false"]');
      await sleep(400);
      const all = assertMeta(await readMeta(p), { label: 'móvil todos' });
      await p.click('.browse-mode-btn[aria-pressed="false"]');
      await sleep(200);
      return `${home} | ${prov} | ${all}`;
    });
    await step('m_browse_toggle', async () => checkBrowseToggle(p));
    await step('m_filters_menu', async () => checkMenus(p, { minOptH: 44 }));
    await step('m_filters_menu_short', async () => {
      const p2 = await ctx.newPage();
      p2.setDefaultTimeout(90000);
      try {
        await p2.setViewport({ width: 430, height: 850, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        await p2.goto(BASE + '?e2e', { waitUntil: 'load', timeout: 90000 });
        await p2.waitForFunction(() => window.__crmap && window.__crmap.loaded() && window.__cract, {
          timeout: 90000,
        });
        await p2.waitForFunction(() => !document.querySelector('.boot-splash'), { timeout: 30000 }).catch(() => {});
        await sleep(1500);
        await p2.click('.tabs [role=tab]').catch(() => {});
        await sleep(700);
        const sh = await p2.$eval('#panel', (e) => e.dataset.sheet);
        if (sh !== 'half' && sh !== 'full') throw new Error('sheet=' + sh);
        const out = await checkMenus(p2, { minOptH: 44 });
        return `sheet=${sh} ${out}`;
      } finally {
        await p2.close();
      }
    });
    await step('m_locate', async () => {
      await p.evaluate(() => __cract.locate(true));
      await p.waitForFunction(() => document.querySelector('.me-pin'), { timeout: 15000 });
      await sleep(800);
      await shot(p, 'mobile-locate');
      const info = await readNearby(p);
      assertNearby(info, { nameRe: /cerca de mí|near me/, radius: NEAR_RADIUS_KM });
      const dist = await p.$('.item-dist');
      if (!dist) throw new Error('sin distancias en móvil');
      return info.title;
    });
    await step('m_nearby_inline', async () => {
      await p.evaluate(() => __cract.select('wd-volcan-tortuguero'));
      await p.waitForSelector('.nearby', { timeout: 15000 });
      await sleep(600);
      const before = await countDetail(p);
      if (!before.inDetail) throw new Error('salió del detalle');
      if (before.resultCount) throw new Error('explore ' + before.resultCount);
      await p.click('.nearby-more');
      await sleep(500);
      const after = await countDetail(p);
      if (!after.inDetail) throw new Error('salió al expandir');
      if (after.heroes !== 1) throw new Error('heroes=' + after.heroes);
      if (after.nearbyItems !== 15) throw new Error('n=' + after.nearbyItems);
      if (after.resultCount) throw new Error('explore ' + after.resultCount);
      await shot(p, 'mobile-nearby-inline');
      return `${before.nearbyItems} → ${after.nearbyItems} “${after.h2[0]}”`;
    });
    await step('m_detail_no_stack', async () => {
      const ids = [
        'wd-volcan-tortuguero',
        'aer-aerodromo-de-tortuguero',
        'par-p-n-tortuguero',
        'ciu-tortuguero',
        'wd-rio-tortuguero',
        'par-p-n-manuel-antonio',
      ];
      for (const id of ids) {
        await p.evaluate((id) => __cract.select(id), id);
        await sleep(40);
      }
      await sleep(500);
      assertOneDetail(await countDetail(p));
      await shot(p, 'mobile-detail-rapid');
      await p.evaluate(() => __cract.select('wd-volcan-tortuguero'));
      await p.waitForSelector('.nearby .item[data-id]', { timeout: 10000 });
      const more = await p.$('.nearby-more');
      if (more) await more.click();
      await sleep(200);
      const nearIds = await p.$$eval('.nearby .item[data-id]', (els) =>
        els.slice(0, 5).map((e) => e.getAttribute('data-id')),
      );
      for (const id of nearIds) {
        await p.click(`.nearby .item[data-id="${id}"]`);
        await sleep(80);
        assertOneDetail(await countDetail(p));
      }
      await shot(p, 'mobile-detail-nearby-clicks');
      await p.evaluate(() => history.back());
      await sleep(400);
      const back = await countDetail(p);
      if (back.heroes > 1 || back.details > 1) throw new Error('back ' + JSON.stringify(back));
      await p.evaluate(() => history.forward());
      await sleep(400);
      const fwd = await countDetail(p);
      if (fwd.heroes > 1 || fwd.details > 1) throw new Error('fwd');
      if (fwd.details === 1) assertOneDetail(fwd);
      return '1 ficha en móvil tras selects, cercanos, atrás/adelante';
    });
    await step('m_sheet_place', async () => {
      await p.evaluate(() => __cract.select('par-p-n-manuel-antonio'));
      await p.waitForSelector('.detail-body h2', { timeout: 15000 });
      await sleep(1500);
      const sh = await p.$eval('.panel', (x) => x.dataset.sheet);
      await shot(p, 'mobile-place');
      if (sh !== 'half') throw new Error('sheet=' + sh);
      return 'sheet=half';
    });
    await step('m_province', async () => {
      await p.evaluate(() => __cract.showProvince('guanacaste'));
      await p.waitForSelector('.ptab-bar', { timeout: 15000 });
      await p.click('[data-ptab="food"]');
      await sleep(900);
      await shot(p, 'mobile-province-food');
    });
    await step('m_landscape', async () => {
      await p.evaluate(() => __cract.deselect());
      await p.setViewport({ ...vp, width: 915, height: 412 });
      await sleep(1500);
      const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await shot(p, 'mobile-landscape');
      if (over) throw new Error('scroll horizontal');
    });
    await step('m_deeplink_ficha', async () => {
      const p2 = await ctx.newPage();
      p2.setDefaultTimeout(90000);
      try {
        await p2.setViewport(vp);
        await p2.goto(BASE + '?e2e&lugar=refugio-de-vida-silvestre-archie-carr', {
          waitUntil: 'load',
          timeout: 90000,
        });
        await p2.waitForFunction(() => window.__crmap && window.__crmap.loaded() && window.__cract, {
          timeout: 90000,
        });
        await p2.waitForSelector('.detail-body h2', { timeout: 20000 });
        await sleep(800);
        const info = await p2.evaluate(() => ({
          h2: document.querySelector('.detail-body h2')?.textContent?.trim() || '',
          details: document.querySelectorAll('section.detail').length,
          listN: document.querySelectorAll('#resultList .item').length,
        }));
        if (info.details !== 1) throw new Error('details=' + info.details);
        if (!/archie carr/i.test(info.h2)) throw new Error('h2=' + info.h2);
        if (info.listN) throw new Error('lista visible ' + info.listN);
        return info.h2;
      } finally {
        await p2.close();
      }
    });
    res.mobile_errors = errs;
    if (errs.length) failed++;
    await ctx.close();
  }
} finally {
  await b.close();
  srv?.close();
}

console.log(JSON.stringify(res, null, 1));
console.log(failed ? `\ne2e: ${failed} fallo(s)` : '\ne2e: OK');
process.exit(failed ? 1 : 0);
