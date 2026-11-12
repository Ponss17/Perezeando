import type { CategoryId, Lang, Place } from '../../data/types';
import { CATEGORIES } from '../../data/config';
import { pick, translate } from '../../i18n';
import { ICONS, iconSvg } from '../../lib/icons';

export const ZOOM_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>';

export function clusterHeader(segs: { color: string; n: number }[], n: number, title: string) {
  const bar = document.createElement('div');
  bar.className = 'ct-bar';
  segs.forEach((seg) => {
    const s = document.createElement('i');
    s.style.width = (seg.n / n) * 100 + '%';
    s.style.background = seg.color;
    bar.appendChild(s);
  });
  const head = document.createElement('div');
  head.className = 'ct-head';
  const badge = document.createElement('b');
  badge.className = 'ct-n';
  badge.textContent = String(n);
  const text = document.createElement('span');
  const b = document.createElement('b');
  b.textContent = title;
  text.appendChild(b);
  head.append(badge, text);
  return { bar, head, text };
}

export function clusterSummary(parts: [CategoryId, number][], lang: Lang) {
  const n = parts.reduce((a, [, v]) => a + v, 0);
  const el = document.createElement('div');
  el.className = 'tip-card cluster-tip';
  const title = translate(lang, n === 1 ? 'cl_grouped_one' : 'cl_grouped_many');
  const { bar, head, text } = clusterHeader(
    parts.map(([c, v]) => ({ color: CATEGORIES[c].color, n: v })),
    n,
    title,
  );
  const hint = document.createElement('small');
  hint.innerHTML = ZOOM_SVG;
  hint.append(translate(lang, 'cl_click_zoom'));
  text.append(hint);

  const ul = document.createElement('ul');
  parts.slice(0, 5).forEach(([c, v]) => {
    const li = document.createElement('li');
    const cat = CATEGORIES[c];
    li.style.setProperty('--c', cat.color);
    const i = document.createElement('i');
    i.innerHTML = iconSvg(cat.icon, { size: 12, color: '#fff', stroke: 2.4 });
    const span = document.createElement('span');
    span.textContent = pick(lang, v === 1 ? cat.one : cat.name);
    const em = document.createElement('em');
    em.textContent = String(v);
    li.append(i, span, em);
    ul.appendChild(li);
  });
  if (parts.length > 5) {
    const li = document.createElement('li');
    li.className = 'more';
    const extra = parts.length - 5;
    li.textContent = `+ ${extra} ${translate(lang, extra === 1 ? 'cl_more_cat_one' : 'cl_more_cat_many')}`;
    ul.appendChild(li);
  }
  el.append(bar, head, ul);
  return el;
}

export function placeTip(p: Place, lang: Lang) {
  const el = document.createElement('div');
  el.className = 'tip-name';
  el.style.setProperty('--c', CATEGORIES[p.cat].color);
  el.innerHTML = '<i aria-hidden="true"></i><b></b>';
  el.querySelector('b')!.textContent = pick(lang, p.name);
  return el;
}

export function plainTip(cat: string, name: string, color?: string) {
  const el = document.createElement('div');
  el.className = 'tip-card';
  const sm = document.createElement('small');
  sm.className = 'tip-cat';
  sm.textContent = cat;
  if (color) sm.style.setProperty('--c', color);
  const b = document.createElement('b');
  b.textContent = name;
  el.append(sm, b);
  return el;
}

interface LabelOpts {
  fav: boolean;
  animate: boolean;
  onOpen(): void;
}

export function buildPlaceLabel(p: Place, lang: Lang, o: LabelOpts) {
  const c = CATEGORIES[p.cat];
  const el = document.createElement('div');
  el.className = 'sel-mk' + (o.animate ? '' : ' no-anim');
  el.style.setProperty('--c', c.color);
  el.innerHTML = `
<button type="button" class="sel-label"><span></span><i class="sl-arrow" aria-hidden="true"></i></button>
<div class="sel-pin">
  <svg viewBox="0 0 40 50" width="40" height="50" aria-hidden="true">
    <path d="M20 48.5c-1.1 0-2-.8-2.6-1.8C12.4 38 4 31.6 4 19.8 4 10.9 11.2 3.5 20 3.5s16 7.4 16 16.3c0 11.8-8.4 18.2-13.4 26.9-.6 1-1.5 1.8-2.6 1.8z" fill="#386641" stroke="#fff" stroke-width="2.5"/>
    <circle cx="20" cy="19.8" r="12.2" fill="none" stroke="#a7c957" stroke-width="1.8"/>
    <svg x="11" y="10.8" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${ICONS[c.icon] ?? ''}</svg>
    ${o.fav ? '<circle cx="33" cy="8" r="5" fill="#b08968" stroke="#fff" stroke-width="1.8"/>' : ''}
  </svg>
</div>
<span class="sel-pulse"></span>`;
  const name = pick(lang, p.name);
  const lb = el.querySelector<HTMLElement>('.sel-label')!;
  lb.querySelector('span')!.textContent = name;
  lb.setAttribute('aria-label', `${name} · ${translate(lang, 'details')}`);
  el.style.setProperty('--dx', '0px');

  const stop = (e: Event) => e.stopPropagation();
  ['click', 'dblclick', 'mousedown', 'touchstart', 'pointerdown'].forEach((t) =>
    el.addEventListener(t, stop, { passive: true }),
  );
  el.addEventListener('click', () => o.onOpen());
  return el;
}
