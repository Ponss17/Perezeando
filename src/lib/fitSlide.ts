const HOST = '.item, .stop, .cl-item, .ic, .sx-trigger, .layer, .sel-label, .qa';

function shiftOf(el: HTMLElement) {
  const box = el.clientWidth;
  if (box <= 0) return 0;
  const mq = el.classList.contains('mq');
  const prev = el.style.maxWidth;
  if (mq) el.style.maxWidth = 'none';
  const text = Math.max(el.scrollWidth, textWidth(el));
  if (mq) el.style.maxWidth = prev;
  return Math.ceil(text - box);
}

function textWidth(el: HTMLElement) {
  if (!el.childNodes.length) return 0;
  const range = document.createRange();
  range.selectNodeContents(el);
  return Math.ceil(range.getBoundingClientRect().width);
}

function linesOf(host: HTMLElement) {
  const hits: { el: HTMLElement; shift: number }[] = [];
  for (const el of [host, ...host.querySelectorAll<HTMLElement>('*')]) {
    if (el instanceof SVGElement || el.clientWidth < 12) continue;
    const cs = getComputedStyle(el);
    const clips = cs.textOverflow === 'ellipsis' || (cs.whiteSpace === 'nowrap' && cs.overflowX !== 'visible');
    if (!clips) continue;
    const shift = shiftOf(el);
    if (shift > 1) hits.push({ el, shift });
  }
  return hits;
}

export function watchFitSlide(root: HTMLElement) {
  let timer = 0;
  let host: HTMLElement | null = null;
  let lines: HTMLElement[] = [];
  const stop = () => {
    window.clearTimeout(timer);
    lines.forEach((el) => {
      el.classList.remove('slide', 'slide-x');
      el.style.removeProperty('--shift');
      el.style.removeProperty('--dur');
    });
    host = null;
    lines = [];
  };
  const over = (e: Event) => {
    const next = (e.target as HTMLElement | null)?.closest?.(HOST) as HTMLElement | null;
    if (!next || next === host) return;
    stop();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    host = next;
    timer = window.setTimeout(() => {
      if (host !== next) return;
      const found = linesOf(next);
      lines = found.map((h) => h.el);
      found.forEach(({ el, shift }) => {
        const flex = getComputedStyle(el).display.includes('flex');
        el.style.setProperty('--shift', `${shift + 16}px`);
        el.style.setProperty('--dur', `${Math.min(9, Math.max(2.8, (shift + 16) / 28)).toFixed(2)}s`);
        el.classList.add('slide');
        if (flex) el.classList.add('slide-x');
      });
    }, 400);
  };
  const out = (e: PointerEvent) => {
    if (!host) return;
    const to = e.relatedTarget;
    if (to instanceof Node && host.contains(to)) return;
    stop();
  };
  root.addEventListener('pointerover', over);
  root.addEventListener('pointerout', out);
  return () => {
    stop();
    root.removeEventListener('pointerover', over);
    root.removeEventListener('pointerout', out);
  };
}
