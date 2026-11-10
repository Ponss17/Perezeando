import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { getApp, setApp, useApp } from '../store/useApp';
import { isMobile } from '../lib/selectors';
import type { SheetState } from '../data/types';

/** Mide la altura "peek" (asa + encabezado) y la publica en --peek */
function measurePeek(panel: HTMLElement | null) {
  if (!panel || !isMobile()) return;
  const h = panel.querySelector<HTMLElement>('.sheet-handle');
  const head = panel.querySelector<HTMLElement>('.panel-head');
  if (!h || !head) return;
  document.documentElement.style.setProperty('--peek', h.offsetHeight + head.offsetHeight + 6 + 'px');
  document.documentElement.style.setProperty('--sheet-h', panel.offsetHeight + 'px');
}

/** Arrastre de la hoja inferior en móvil (peek / half / full) con inercia */
export function useSheet(ref: RefObject<HTMLElement | null>) {
  const lang = useApp((s) => s.lang);
  useLayoutEffect(() => {
    measurePeek(ref.current);
  }, [ref, lang]);

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const handle = panel.querySelector<HTMLElement>('.sheet-handle')!;
    const head = panel.querySelector<HTMLElement>('.panel-head')!;
    let startY = 0,
      startT = 0,
      lastY = 0,
      lastT = 0,
      vel = 0;
    let dragging = false,
      down = false,
      suppress = false;
    const curT = () => new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42;
    const onDown = (e: PointerEvent) => {
      if (!isMobile() || (e.target as HTMLElement).closest('input,select,button')) return;
      down = true;
      dragging = false;
      startY = lastY = e.clientY;
      startT = curT();
      lastT = performance.now();
      vel = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dy) > 8) {
        dragging = true;
        panel.classList.add('dragging');
      }
      if (!dragging) return;
      const now = performance.now();
      vel = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY;
      lastT = now;
      const h = panel.offsetHeight;
      const peek = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek')) || 178;
      panel.style.transform = `translateY(${Math.min(h - peek, Math.max(0, startT + dy))}px)`;
      if (e.cancelable) e.preventDefault();
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('dragging');
      const y = curT();
      const h = panel.offsetHeight;
      panel.style.transform = '';
      let st: SheetState;
      if (vel > 0.5) st = y < h * 0.3 ? 'half' : 'peek';
      else if (vel < -0.5) st = y > h * 0.5 ? 'half' : 'full';
      else st = y < h * 0.24 ? 'full' : y < h * 0.7 ? 'half' : 'peek';
      setApp({ sheet: st });
      suppress = true;
      setTimeout(() => (suppress = false), 60);
    };
    const onClickCapture = (e: MouseEvent) => {
      if (suppress) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const onHandleClick = () => {
      const s = getApp().sheet;
      setApp({ sheet: s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek' });
    };
    const onResize = () => measurePeek(panel);
    handle.addEventListener('pointerdown', onDown);
    head.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    panel.addEventListener('click', onClickCapture, true);
    handle.addEventListener('click', onHandleClick);
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(onResize);
    const t = setTimeout(onResize, 300);
    return () => {
      clearTimeout(t);
      handle.removeEventListener('pointerdown', onDown);
      head.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      panel.removeEventListener('click', onClickCapture, true);
      handle.removeEventListener('click', onHandleClick);
      window.removeEventListener('resize', onResize);
    };
  }, [ref]);
}
