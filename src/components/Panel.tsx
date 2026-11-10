import { BrandLogo } from './BrandLogo';
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../store/useApp';
import { useT } from '../i18n';
import type { Tab } from '../data/types';
import { openTab, togglePanel } from '../store/actions';
import { useSheet } from '../hooks/useSheet';
import { SearchBox } from '../features/search/SearchBox';
import ExplorePane from '../features/search/ExplorePane';
import { Icon } from './Icon';
import { SlideTrack } from './SlideTrack';
import { watchFitSlide } from '../lib/fitSlide';

const LayersPane = lazy(() => import('../features/layers/LayersPane'));
const RoutePane = lazy(() => import('../features/route/RoutePane'));
const FavsPane = lazy(() => import('../features/favorites/FavsPane'));
const PlaceDetail = lazy(() => import('../features/detail/PlaceDetail'));
const ProvinceDetail = lazy(() => import('../features/detail/ProvinceDetail'));

const TABS: [Tab, string, 'tab_explore' | 'tab_layers' | 'tab_route' | 'tab_favs'][] = [
  ['explore', 'compass', 'tab_explore'],
  ['layers', 'sliders-horizontal', 'tab_layers'],
  ['route', 'route', 'tab_route'],
  ['favs', 'bookmark', 'tab_favs'],
];

const PaneFallback = () => (
  <div className="pane-loading">
    <span className="spinner" />
  </div>
);

/** Panel lateral (escritorio) / hoja inferior (móvil) */
export function Panel() {
  const { t } = useT();
  const ref = useRef<HTMLElement>(null);
  const tab = useApp((s) => s.tab);
  const [armed, setArmed] = useState(false);
  const side = armed || tab !== 'explore';
  const sel = useApp((s) => s.sel);
  const detailOpen = useApp((s) => s.detailOpen);
  const panelOpen = useApp((s) => s.panelOpen);
  const sheet = useApp((s) => s.sheet);
  const nRoute = useApp((s) => s.route.length);
  const nFavs = useApp((s) => s.favs.length);
  useSheet(ref);
  useEffect(() => {
    return watchFitSlide(document.body);
  }, []);

  const showDetail = detailOpen && sel;
  const badges: Partial<Record<Tab, number>> = { route: nRoute, favs: nFavs };
  const tabIndex = Math.max(
    0,
    TABS.findIndex(([id]) => id === tab),
  );

  return (
    <aside
      id="panel"
      ref={ref}
      className={'panel' + (panelOpen ? '' : ' collapsed')}
      data-sheet={sheet}
      aria-label="Panel"
      aria-hidden={!panelOpen || undefined}
      inert={!panelOpen ? true : undefined}
    >
      <div className="sheet-handle" aria-hidden="true">
        <span />
      </div>
      <header className="panel-head">
        <div className="brand">
          <BrandLogo />
          <div className="brand-text">
            <span className="brand-kicker">{t('brand_kicker')}</span>
            <h1>{t('brand_name')}</h1>
          </div>
          <button
            className="icon-btn collapse-btn"
            aria-label={t('panel_hide')}
            title={t('panel_hide')}
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel(false);
            }}
          >
            <Icon name="panel-left-close" />
          </button>
        </div>
        <SearchBox />
        <nav
          className={'tabs' + (showDetail ? ' in-detail' : '')}
          role="tablist"
          style={{ '--i': tabIndex } as CSSProperties}
        >
          {TABS.map(([id, icon, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id && !showDetail}
              className={tab === id && !showDetail ? 'active' : ''}
              onPointerEnter={() => id !== 'explore' && setArmed(true)}
              onFocus={() => id !== 'explore' && setArmed(true)}
              onClick={() => openTab(id)}
            >
              <Icon name={icon} />
              <b>{t(label)}</b>
              {!!badges[id] && <i className="badge">{badges[id]}</i>}
            </button>
          ))}
          <span className="tab-slide" aria-hidden="true" />
        </nav>
      </header>
      <div className="panel-body" id="panelBody">
        {showDetail ? (
          <div className="detail-pane">
            <Suspense fallback={<PaneFallback />}>
              {sel.kind === 'place' ? <PlaceDetail id={sel.id} /> : <ProvinceDetail id={sel.id} />}
            </Suspense>
          </div>
        ) : (
          <SlideTrack fill index={tabIndex} onIndex={(i) => openTab(TABS[i][0])}>
            <ExplorePane />
            {side ? (
              <Suspense fallback={<PaneFallback />}>
                <LayersPane />
              </Suspense>
            ) : (
              <span />
            )}
            {side ? (
              <Suspense fallback={<PaneFallback />}>
                <RoutePane />
              </Suspense>
            ) : (
              <span />
            )}
            {side ? (
              <Suspense fallback={<PaneFallback />}>
                <FavsPane />
              </Suspense>
            ) : (
              <span />
            )}
          </SlideTrack>
        )}
      </div>
      <footer className="panel-foot">
        <button className="link-btn" onClick={() => useApp.setState({ creditsOpen: true })}>
          <Icon name="info" /> <span>{t('credits')}</span>
        </button>
      </footer>
    </aside>
  );
}

/** Botón flotante para volver a abrir el panel (solo escritorio, cuando está oculto) */
export function PanelOpenButton() {
  const { t } = useT();
  const open = useApp((s) => s.panelOpen);
  const hasPlace = useApp((s) => s.sel?.kind === 'place');
  const cta = hasPlace ? t('view_detail') : t('tab_explore');
  return (
    <button
      className={'panel-open-btn' + (open ? '' : ' show')}
      aria-label={t('panel_show')}
      tabIndex={open ? -1 : 0}
      aria-hidden={open || undefined}
      onClick={(e) => {
        e.currentTarget.blur();
        togglePanel(true);
      }}
    >
      <BrandLogo as="span" />
      <span className="pob-text">
        <b>{t('brand_name')}</b>
      </span>
      <span className="pob-cta">
        <Icon name={hasPlace ? 'panel-left-open' : 'compass'} />
        <span>{cta}</span>
      </span>
    </button>
  );
}

export function MobileTitle() {
  const { t } = useT();
  return (
    <div id="mobileTitle">
      <BrandLogo />
      <div className="mt-text">
        <small>{t('brand_kicker')}</small>
        <b>{t('brand_name')}</b>
      </div>
    </div>
  );
}
