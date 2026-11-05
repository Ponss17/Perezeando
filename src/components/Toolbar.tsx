import { useEffect, useRef } from 'react';
import { useApp, setApp } from '../store/useApp';
import { useT } from '../i18n';
import { doPrint, exportGeojson, locate, share, toggle3d, toggleMeasure, toggleNight, toggleOv } from '../store/actions';
import { haversine } from '../lib/geo';
import { BasemapGrid } from '../features/layers/BasemapGrid';
import { LayerRow } from '../features/layers/LayerRow';
import type { Overlays } from '../data/types';
import { Icon } from './Icon';

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
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pop) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setApp({ basemapPop: false });
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setApp({ basemapPop: false });
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pop]);

  return (
    <div className="toolbar" id="toolbar">
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
          onClick={() => toggle3d()}
        >
          <em>3D</em>
        </button>
      </div>
      <div className="tool-group">
        <button
          className={'tool' + (locating ? ' busy' : '')}
          title={t('locate')}
          aria-label={t('locate')}
          onClick={() => locate(false)}
        >
          <Icon name="locate" />
        </button>
        <button
          className={'tool' + (measure ? ' active' : '')}
          title={km != null ? `${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(km < 10 ? 1 : 0) + ' km'}` : t('measure_hint')}
          aria-label={t('measure')}
          aria-pressed={measure}
          onClick={() => toggleMeasure()}
        >
          <Icon name="ruler" />
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
          onClick={() => share(sel?.kind === 'place' ? sel.id : null)}
        >
          <Icon name="share-2" />
        </button>
        <button className="tool hide-m" title={t('print')} aria-label={t('print')} onClick={doPrint}>
          <Icon name="printer" />
        </button>
        <button
          className="tool hide-m"
          title={t('export_geojson')}
          aria-label={t('export_geojson')}
          onClick={exportGeojson}
        >
          <Icon name="download" />
        </button>
        <button
          className={'tool' + (night ? ' active' : '')}
          title={t('night')}
          aria-label={t('night')}
          aria-pressed={night}
          onClick={() => toggleNight()}
        >
          <Icon name={night ? 'sun' : 'moon'} />
        </button>
        <button
          className="tool txt lang"
          title={t('language')}
          aria-label={t('language')}
          onClick={() => setApp({ lang: lang === 'es' ? 'en' : 'es' })}
        >
          <em>{lang === 'es' ? 'EN' : 'ES'}</em>
        </button>
      </div>
    </div>
  );
}
