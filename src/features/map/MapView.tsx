import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import { getApp, useApp } from '../../store/useApp';
import { getData, loadGeoms, useGeoms } from '../../data/load';
import { emitMapMove, registerMap } from '../../lib/mapBus';
import { isMobile } from '../../lib/selectors';
import { select, setSheet } from '../../store/actions';
import type { ProvinceId } from '../../data/types';
import { MapController } from './controller';
import { ProvincePopup } from './ProvincePopup';
import { useT } from '../../i18n';

/**
 * Desplaza el mapa lo justo para que un popup no quede tapado por la barra de
 * herramientas (derecha), el panel (izquierda) o el borde superior.
 */
function keepClear(map: maplibregl.Map, popup: maplibregl.Popup) {
  const el = popup.getElement();
  if (!el) return;
  const p = el.getBoundingClientRect();
  const m = map.getContainer().getBoundingClientRect();
  const tb = document.getElementById('toolbar')?.getBoundingClientRect();
  const panel = document.querySelector('.panel');
  const pr = panel && !isMobile() ? panel.getBoundingClientRect() : null;
  const M = 12;
  let dx = 0;
  let dy = 0;
  const right = tb && p.top < tb.bottom + M && p.bottom > tb.top - M ? tb.left - M : m.right - M;
  if (p.right > right) dx = p.right - right;
  const left = pr && pr.right > m.left ? pr.right + M : m.left + M;
  if (p.left - dx < left) dx = p.left - left;
  if (p.top < m.top + M) dy = p.top - (m.top + M);
  if (dx || dy) map.panBy([dx, dy], { duration: 300 });
}

/** Mapa MapLibre (2D + 3D). Se carga como chunk aparte. */
export default function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<{ id: ProvinceId; el: HTMLElement } | null>(null);
  const [tip3d, setTip3d] = useState(false);
  const { t } = useT();

  useEffect(() => {
    const data = getData();
    if (!ref.current || !data) return;
    let popup: maplibregl.Popup | null = null;
    const closePopup = () => {
      popup?.remove();
      popup = null;
    };
    let ctrlRef: MapController | null = null;
    const ctrl = new MapController(ref.current, getApp(), data, {
      selectPlace: (id, fly) => {
        closePopup();
        select(id, { noFly: !fly, fromMap: true });
      },
      provinceClick: (id, lngLat) => {
        closePopup();
        ctrl.closePopups();
        const el = document.createElement('div');
        popup = new maplibregl.Popup({ maxWidth: '330px', offset: 10, focusAfterOpen: false, className: 'prov-pop' })
          .setLngLat(lngLat)
          .setDOMContent(el)
          .addTo(ctrl.map);
        // una sola tarjeta a la vez: el rótulo del seleccionado se oculta mientras está abierta
        ctrl.setOverlay(true);
        const mine = popup;
        popup.on('close', () => {
          if (!popup || popup === mine) ctrlRef?.setOverlay(false);
          setPop((cur) => (cur?.el === el ? null : cur));
        });
        setPop({ id, el });
        const opened = popup;
        // tras renderizar el contenido, correr el mapa si la tarjeta queda bajo la barra de herramientas
        requestAnimationFrame(() => requestAnimationFrame(() => popup === opened && keepClear(ctrl.map, opened)));
      },
      emptyClick: () => {
        closePopup();
        if (isMobile() && getApp().sheet !== 'peek') setSheet('peek');
      },
      moved: emitMapMove,
      overlayOpened: () => closePopup(),
    });
    ctrlRef = ctrl;
    registerMap(ctrl);
    // los trazados (rutas, áreas) llegan después del primer pintado del mapa
    const unGeoms = useGeoms.subscribe((g) => g.ready && ctrl.refreshPlaces());
    ctrl.map.once('idle', () => {
      void loadGeoms();
    });
    let tipT: ReturnType<typeof setTimeout> | undefined;
    const unsub = useApp.subscribe((s, prev) => {
      ctrl.update(s);
      if (s.is3d && !prev.is3d) {
        setTip3d(true);
        clearTimeout(tipT);
        tipT = setTimeout(() => setTip3d(false), 5000);
      } else if (!s.is3d && prev.is3d) setTip3d(false);
      if (s.sheet !== prev.sheet && isMobile()) ctrl.applyPadding(true);
      // abrir el popover de estilo cierra las tarjetas del mapa para que no queden debajo
      if (s.basemapPop && !prev.basemapPop) {
        closePopup();
        ctrl.closePopups();
      }
    });
    const onResize = () => ctrl.resize();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(tipT);
      unsub();
      unGeoms();
      window.removeEventListener('resize', onResize);
      closePopup();
      registerMap(null);
      ctrl.destroy();
    };
  }, []);

  return (
    <>
      <div id="map" ref={ref} aria-label="Mapa" />
      {pop && createPortal(<ProvincePopup key={pop.id} id={pop.id} />, pop.el)}
      {tip3d && <div className="tip3d">{t('tip3d')}</div>}
    </>
  );
}
