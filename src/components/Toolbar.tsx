import { useEffect, useRef, useState } from 'react';
import { useApp, setApp } from '../store/useApp';
import { useT } from '../i18n';
import {
  doPrint,
  exportGeojson,
  locate,
  share,
  toggle3d,
  toggleMeasure,
  toggleNight,
  toggleOv,
} from '../store/actions';
import { haversine } from '../lib/geo';
import { BasemapGrid } from '../features/layers/BasemapGrid';
import { LayerRow } from '../features/layers/LayerRow';
import type { Overlays } from '../data/types';
import { Icon } from './Icon';
import { isMobile } from '../lib/selectors';

/** Capas de referencia: todas viven en el popover de estilo del mapa */
const OVERLAY_ITEMS: [keyof Overlays, string, 'ov_provinces' | 'ov_eez' | 'ov_hillshade' | 'ov_cluster'][] = [
  ['prov', 'map', 'ov_provinces'],
  ['eez', 'compass', 'ov_eez'],
  ['hill', 'mountain-snow', 'ov_hillshade'],
  ['cluster', 'layers', 'ov_cluster'],
];

/** Herramientas flotantes del mapa (derecha) */
export function Toolbar() {
  const { t } = useT();
  const pop = useApp((s) => s.basemapPop);
  const is3d = useApp((s) => s.is3d);
  const ov = useApp((s) => s.ov);
  const lang = useApp((s) => s.lang);
  const locating = useApp((s) => s.locating);
  const night = useApp((s) => s.night);
  const measure = useApp((s) => s.measure);
  const measurePts = useApp((s) => s.measurePts);
  const km =
    measurePts.length === 2
      ? haversine([measurePts[0][1], measurePts[0][0]], [measurePts[1][1], measurePts[1][0]])
      : null;
  const sel = useApp((s) => s.sel);
  const bar = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');
  const phaseRef = useRef<'closed' | 'open' | 'closing'>('closed');
  const closeTimer = useRef(0);

  const shut = () => {
    if (!isMobile()) {
      phaseRef.current = 'closed';
      setPhase('closed');
      setApp({ basemapPop: false });
      return;
    }
    if (phaseRef.current !== 'open') return;
    phaseRef.current = 'closing';
    setPhase('closing');
    setApp({ basemapPop: false });
    window.clearTimeout(closeTimer.current);
    const wait = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500;
    closeTimer.current = window.setTimeout(() => {
      phaseRef.current = 'closed';
      setPhase('closed');
    }, wait);
  };

  const openMenu = () => {
    window.clearTimeout(closeTimer.current);
    phaseRef.current = 'open';
    setPhase('open');
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!pop && phase !== 'open') return;
    const onDown = (e: PointerEvent) => {
      const node = e.target as Node;
      if (pop && wrap.current && !wrap.current.contains(node) && !isMobile()) setApp({ basemapPop: false });
      if (phase === 'open' && bar.current && !bar.current.contains(node)) shut();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (phase === 'open') shut();
      else if (pop) setApp({ basemapPop: false });
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pop, phase]);

  const done = (fn: () => void) => () => {
    fn();
    if (isMobile()) shut();
  };

  return (
    <div
      className={'toolbar' + (phase !== 'closed' ? ' menu-on' : '') + (phase === 'open' ? ' menu-open' : '')}
      id="toolbar"
      ref={bar}
    >
      <button
        type="button"
        className={'tool-menu' + (phase === 'closed' && (is3d || night || measure) ? ' active' : '')}
        title={t('tools_menu')}
        aria-label={t('tools_menu')}
        aria-expanded={phase === 'open'}
        onClick={() => (phase === 'open' ? shut() : openMenu())}
      >
        <Icon name={phase === 'closed' ? 'sliders-horizontal' : 'x'} />
      </button>
      <div className="tool-drawer">
        <div className="tool-group">
          <div className="tool-wrap" ref={wrap}>
            <button
              className={'tool' + (pop ? ' active' : '')}
              title={t('map_style')}
              aria-label={t('map_style')}
              aria-expanded={pop}
              onClick={() => setApp({ basemapPop: !pop })}
            >
              <Icon name="layers" />
              <span className="tool-label">{t('map_style')}</span>
            </button>
            <div className={'popover' + (pop ? ' open' : '')}>
              {pop && (
                <>
                  <div className="pop-title">{t('basemap')}</div>
                  <BasemapGrid />
                  <div className="pop-title pop-sub">{t('overlays')}</div>
                  <div className="toggles pop-toggles">
                    {OVERLAY_ITEMS.map(([k, icon, label]) => (
                      <LayerRow key={k} icon={icon} name={t(label)} on={ov[k]} onToggle={() => toggleOv(k)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <button
            className={'tool txt' + (is3d ? ' active' : '')}
            title={is3d ? t('exit3d') : t('view3d')}
            aria-label={is3d ? t('exit3d') : t('view3d')}
            aria-pressed={is3d}
            onClick={done(() => toggle3d())}
          >
            <em>3D</em>
            <span className="tool-label">{is3d ? t('exit3d') : t('view3d')}</span>
          </button>
        </div>
        <div className="tool-group">
          <button
            className={'tool' + (locating ? ' busy' : '')}
            title={t('locate')}
            aria-label={t('locate')}
            onClick={done(() => locate(false))}
          >
            <Icon name="locate" />
            <span className="tool-label">{t('locate')}</span>
          </button>
          <button
            className={'tool' + (measure ? ' active' : '')}
            title={
              km != null
                ? `${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(km < 10 ? 1 : 0) + ' km'}`
                : t('measure_hint')
            }
            aria-label={t('measure')}
            aria-pressed={measure}
            onClick={done(() => toggleMeasure())}
          >
            <Icon name="ruler" />
            <span className="tool-label">{t('measure')}</span>
          </button>
          {measure && (
            <span className="measure-readout" role="status">
              {km != null
                ? km < 1
                  ? Math.round(km * 1000) + ' m'
                  : km.toFixed(km < 10 ? 1 : 0) + ' km'
                : t('measure_hint')}
            </span>
          )}
        </div>
        <div className="tool-group secondary">
          <button
            className="tool"
            title={t('share')}
            aria-label={t('share')}
            onClick={done(() => share(sel?.kind === 'place' ? sel.id : null))}
          >
            <Icon name="share-2" />
            <span className="tool-label">{t('share')}</span>
          </button>
          <button className="tool hide-m" title={t('print')} aria-label={t('print')} onClick={doPrint}>
            <Icon name="printer" />
            <span className="tool-label">{t('print')}</span>
          </button>
          <button
            className="tool hide-m"
            title={t('export_geojson')}
            aria-label={t('export_geojson')}
            onClick={exportGeojson}
          >
            <Icon name="download" />
            <span className="tool-label">{t('export_geojson')}</span>
          </button>
          <button
            className={'tool' + (night ? ' active' : '')}
            title={t('night')}
            aria-label={t('night')}
            aria-pressed={night}
            onClick={done(() => toggleNight())}
          >
            <Icon name={night ? 'sun' : 'moon'} />
            <span className="tool-label">{t('night')}</span>
          </button>
          <button
            className="tool txt lang"
            title={t('language')}
            aria-label={t('language')}
            onClick={done(() => setApp({ lang: lang === 'es' ? 'en' : 'es' }))}
          >
            <em>{lang === 'es' ? 'EN' : 'ES'}</em>
            <span className="tool-label">{t('language')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
