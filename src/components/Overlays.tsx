import { useEffect, useRef } from 'react';
import { MascotMono } from './MascotMono';
import { useShallow } from 'zustand/react/shallow';
import { useApp, setApp } from '../store/useApp';
import { useData } from '../data/load';
import { locale, useT } from '../i18n';
import { CATEGORIES, CATEGORY_ORDER } from '../data/config';
import { catName, dismissNotice, provName, retryLocate } from '../store/actions';
import { visiblePlaces } from '../lib/selectors';
import { Icon } from './Icon';

export function Toast() {
  const toast = useApp((s) => s.toast);
  return (
    <div className={'toast' + (toast ? ' show' : '')} role="status" aria-live="polite">
      {toast?.msg}
    </div>
  );
}

const NOTICE_KEYS = {
  denied: ['geo_denied_t', 'geo_denied_d', 'shield'],
  unavailable: ['geo_unavail_t', 'geo_unavail_d', 'locate'],
  timeout: ['geo_timeout_t', 'geo_timeout_d', 'clock'],
  insecure: ['geo_insecure_t', 'geo_insecure_d', 'shield'],
  unsupported: ['geo_unsupported_t', 'geo_unsupported_d', 'info'],
  outside: ['geo_outside_t', 'geo_outside_d', 'info'],
} as const;

/** Aviso con acciones (ubicación): discreto, se cierra con ✕ o Esc */
export function Notice() {
  const { t } = useT();
  const n = useApp((s) => s.notice);
  useEffect(() => {
    if (!n) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && dismissNotice();
    document.addEventListener('keydown', k);
    // el aviso informativo se va solo
    const tm = n.code === 'outside' ? setTimeout(dismissNotice, 7000) : undefined;
    return () => {
      document.removeEventListener('keydown', k);
      clearTimeout(tm);
    };
  }, [n]);
  if (!n) return null;
  const [tk, dk, ico] = NOTICE_KEYS[n.code];
  const canRetry = n.code === 'denied' || n.code === 'unavailable' || n.code === 'timeout';
  return (
    <div className={'notice' + (n.code === 'outside' ? ' info' : '')} role="status" aria-live="polite" key={n.n}>
      <span className="notice-ico" aria-hidden="true">
        <Icon name={ico} />
      </span>
      <div className="notice-text">
        <b>{t(tk)}</b>
        <p>{t(dk)}</p>
        {canRetry && (
          <button type="button" className="notice-act" onClick={retryLocate}>
            {t('retry')}
          </button>
        )}
      </div>
      <button type="button" className="notice-x" aria-label={t('dismiss')} onClick={dismissNotice}>
        <Icon name="x" />
      </button>
    </div>
  );
}

export function CreditsDialog() {
  const { t, lang } = useT();
  const open = useApp((s) => s.creditsOpen);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const es = lang === 'es';
  return (
    <dialog
      id="credits"
      ref={ref}
      onClose={() => setApp({ creditsOpen: false })}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <button className="icon-btn close" aria-label={t('close')} onClick={() => ref.current?.close()}>
        <Icon name="x" />
      </button>
      {open && (
        <div>
          <MascotMono className="credits-mascot" size={96} />
          <h2>{t('credits')}</h2>
          <p>
            {es
              ? 'Mapa hecho con software libre y datos abiertos. Las descripciones son originales; la selección de lugares y categorías se inspiró en el mapa de Esencial Costa Rica.'
              : 'Built with open-source software and open data. Descriptions are original; the selection of places and categories was inspired by the Esencial Costa Rica map.'}
          </p>
          <ul>
            <li>
              <b>{es ? 'Límites provinciales' : 'Province boundaries'}:</b>{' '}
              <a href="https://www.geoboundaries.org" target="_blank" rel="noopener">
                geoBoundaries
              </a>{' '}
              (gbOpen CRI ADM1, {es ? 'derivado de' : 'derived from'} OpenStreetMap · ODbL 1.0)
            </li>
            <li>
              <b>{es ? 'Fotos y resúmenes' : 'Photos & summaries'}:</b> Wikipedia / Wikimedia Commons —{' '}
              {es ? 'autor y licencia en cada foto' : 'author and license on each photo'}
            </li>
            <li>
              <b>{es ? 'Mapas base' : 'Base maps'}:</b> © OpenStreetMap contributors, Esri World Imagery /
              Street / Canvas, OpenTopoMap (CC-BY-SA)
            </li>
            <li>
              <b>3D {es ? 'y relieve' : '& hillshade'}:</b> {es ? 'elevación' : 'elevation'} Mapzen Terrain
              Tiles (AWS Open Data)
            </li>
            <li>
              <b>{es ? 'Surf, gastronomía, cataratas, miradores y sitios arqueológicos' : 'Surf, food, waterfalls, viewpoints & archaeological sites'}:</b>{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
                © OpenStreetMap contributors
              </a>{' '}
              · ODbL 1.0 ({es ? 'extracto de' : 'extract from'}{' '}
              <a href="https://download.geofabrik.de" target="_blank" rel="noopener">
                Geofabrik
              </a>
              )
            </li>
            <li>
              <b>{es ? 'Rutas' : 'Routing'}:</b> OSRM (router.project-osrm.org) · © OpenStreetMap
            </li>
            <li>
              <b>{es ? 'Librerías' : 'Libraries'}:</b> MapLibre GL JS (BSD-3), React (MIT), Zustand (MIT),
              Fuse.js (Apache-2.0), Lucide icons (ISC)
            </li>
          </ul>
          <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>
            {es
              ? 'Distancias y tiempos son estimaciones. Verificá el estado de carreteras y accesos antes de viajar.'
              : 'Distances and times are estimates. Check road and access conditions before travelling.'}
          </p>
        </div>
      )}
    </dialog>
  );
}

/** Encabezado, imagen y leyenda que solo se ven al imprimir */
export function PrintParts() {
  const { t, lang } = useT();
  const s = useApp(useShallow((x) => ({ active: x.active, prov: x.prov, cat: x.cat, route: x.route })));
  const data = useData((x) => x.data);
  if (!data) return null;
  const n = visiblePlaces(s, data.places).length;
  const parts = [
    s.prov === 'all' ? t('all_provinces') : provName(s.prov),
    s.cat === 'all' ? t('all_categories') : catName(s.cat),
  ];
  if (s.route.length >= 2) {
    const a = data.byId.get(s.route[0]);
    const b = data.byId.get(s.route[s.route.length - 1]);
    if (a && b) parts.push(`${t('tab_route')}: ${a.name[lang]} → ${b.name[lang]}`);
  }
  const cats = CATEGORY_ORDER.filter((c) => s.active.includes(c) && (s.cat === 'all' || c === s.cat));
  return (
    <>
      <div className="print-header">
        <h1>{t('title')}</h1>
        <p>{parts.join(' · ')}</p>
        <p>
          {n} {t('count_places')} · {t('printed')} {new Date().toLocaleDateString(locale(lang))}
        </p>
      </div>
      <img id="printImg" className="print-img" alt="" />
      <div className="legend">
        <b>{t('legend')}:</b>{' '}
        {cats.map((c) => (
          <span key={c}>
            <i style={{ background: CATEGORIES[c].color }} />
            {catName(c)}
          </span>
        ))}
      </div>
    </>
  );
}
