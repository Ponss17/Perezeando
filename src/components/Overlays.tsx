import { useEffect, useRef } from 'react';
import { BrandLogo } from './BrandLogo';
import { MascotMono } from './MascotMono';
import { useShallow } from 'zustand/react/shallow';
import { useApp, setApp } from '../store/useApp';
import { useData } from '../data/load';
import { locale, useT } from '../i18n';
import { CATEGORIES, CATEGORY_ORDER } from '../data/config';
import { catName, dismissNotice, provName, retryLocate } from '../store/actions';
import { visiblePlaces } from '../lib/selectors';
import { openPolicies } from '../lib/policies';
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
    <div
      className={'notice' + (n.code === 'outside' ? ' info' : '')}
      role="status"
      aria-live="polite"
      key={n.n}
    >
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
    d.setAttribute('closedby', 'none');
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const es = lang === 'es';
  return (
    <dialog
      id="credits"
      ref={ref}
      aria-labelledby="credits-title"
      onCancel={(e) => e.preventDefault()}
      onClose={() => setApp({ creditsOpen: false })}
    >
      {open && (
        <>
          <header className="credits-head">
            <MascotMono className="credits-mascot" size={64} />
            <div className="credits-title">
              <p className="brand-kicker">Perezeando</p>
              <h2 id="credits-title">{t('credits')}</h2>
            </div>
            <button className="icon-btn close" aria-label={t('close')} onClick={() => ref.current?.close()}>
              <Icon name="x" />
            </button>
          </header>
          <div className="credits-body">
            <p className="credits-lede">
              {es
                ? 'Atlas de consulta, hecho con software libre y datos abiertos. Los mapas, las fotos y los textos de otras personas conservan la licencia de su autor.'
                : 'A reference atlas, built with open-source software and open data. Maps, photos, and text from other people keep their authors’ license.'}
            </p>
            <ul className="credits-list">
              <li>
                <b>{es ? 'Límites provinciales' : 'Province boundaries'}</b>
                <span>
                  <a href="https://www.geoboundaries.org" target="_blank" rel="noopener">
                    geoBoundaries
                  </a>{' '}
                  (gbOpen CRI ADM1, {es ? 'derivado de' : 'derived from'} OpenStreetMap · ODbL 1.0)
                </span>
              </li>
              <li>
                <b>{es ? 'Fotos y resúmenes' : 'Photos & summaries'}</b>
                <span>
                  Wikipedia / Wikimedia Commons —{' '}
                  {es ? 'autor y licencia en cada foto' : 'author and license on each photo'}
                </span>
              </li>
              <li>
                <b>{es ? 'Mapas base' : 'Base maps'}</b>
                <span>
                  © OpenStreetMap contributors, Esri World Imagery / Street / Canvas, OpenTopoMap (CC-BY-SA)
                </span>
              </li>
              <li>
                <b>3D {es ? 'y relieve' : '& hillshade'}</b>
                <span>{es ? 'elevación' : 'elevation'} Mapzen Terrain Tiles (AWS Open Data)</span>
              </li>
              <li>
                <b>
                  {es
                    ? 'Surf, gastronomía, cataratas, miradores y sitios arqueológicos'
                    : 'Surf, food, waterfalls, viewpoints & archaeological sites'}
                </b>
                <span>
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
                    © OpenStreetMap contributors
                  </a>{' '}
                  · ODbL 1.0 ({es ? 'extracto de' : 'extract from'}{' '}
                  <a href="https://download.geofabrik.de" target="_blank" rel="noopener">
                    Geofabrik
                  </a>
                  )
                </span>
              </li>
              <li>
                <b>{es ? 'Rutas' : 'Routing'}</b>
                <span>OSRM (router.project-osrm.org) · © OpenStreetMap</span>
              </li>
              <li>
                <b>{es ? 'Librerías' : 'Libraries'}</b>
                <span>
                  MapLibre GL JS (BSD-3), React (MIT), Zustand (MIT), Fuse.js (Apache-2.0), Lucide icons (ISC)
                </span>
              </li>
            </ul>
            <p className="credits-note">
              {es
                ? 'Distancias y tiempos son estimaciones. Verificá el estado de carreteras y accesos antes de viajar.'
                : 'Distances and times are estimates. Check road and access conditions before travelling.'}
            </p>
            <button type="button" className="policies-jump" onClick={openPolicies}>
              {t('policies_open')}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}

/** Hoja de atlas: solo visible al imprimir */
export function PrintParts() {
  const { t, lang } = useT();
  const s = useApp(
    useShallow((x) => ({
      active: x.active,
      prov: x.prov,
      cat: x.cat,
      route: x.route,
      sel: x.sel,
    })),
  );
  const data = useData((x) => x.data);
  if (!data) return null;
  const n = visiblePlaces(s, data.places).length;
  const focus = s.sel?.kind === 'place' ? data.byId.get(s.sel.id) : null;
  const scope = [
    s.prov === 'all' ? t('all_provinces') : provName(s.prov),
    s.cat === 'all' ? t('all_categories') : catName(s.cat),
  ];
  if (s.route.length >= 2) {
    const a = data.byId.get(s.route[0]);
    const b = data.byId.get(s.route[s.route.length - 1]);
    if (a && b) scope.push(`${t('tab_route')}: ${a.name[lang]} → ${b.name[lang]}`);
  }
  const cats = CATEGORY_ORDER.filter((c) => s.active.includes(c) && (s.cat === 'all' || c === s.cat));
  const when = new Date().toLocaleDateString(locale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="print-sheet" aria-hidden="true">
      <header className="print-head">
        <div className="print-brand">
          <BrandLogo />
          <div className="print-brand-text">
            <p className="print-kicker">{t('brand_kicker')}</p>
            <p className="print-name">{t('brand_name')}</p>
          </div>
        </div>
        <div className="print-meta">
          <h1>{focus ? focus.name[lang] : t('title')}</h1>
          <p className="print-scope">
            {focus ? `${catName(focus.cat)} · ` : ''}
            {scope.join(' · ')}
          </p>
          <p className="print-stats">
            {n} {t('count_places')} · {t('printed')} {when}
          </p>
        </div>
      </header>
      <figure className="print-figure">
        <img id="printImg" className="print-img" alt="" />
      </figure>
      {cats.length > 0 && (
        <section className="print-legend">
          <h2>{t('legend_title')}</h2>
          <ul>
            {cats.map((c) => (
              <li key={c}>
                <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
                  <circle cx="5.5" cy="5.5" r="5" fill={CATEGORIES[c].color} />
                </svg>
                <span>{catName(c)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="print-foot">
        <span>{t('print_foot')}</span>
        <span>{t('print_sources')}</span>
      </footer>
    </div>
  );
}
