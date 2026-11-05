import { lazy, Suspense, useEffect, useState } from 'react';
import { getApp, setApp, useApp } from './store/useApp';
import { loadData, useData } from './data/load';
import { useT } from './i18n';
import { readHash, useHashSync } from './hooks/hash';
import { useRouteCompute } from './hooks/useRouteCompute';
import { deselect, select } from './store/actions';
import { Panel, PanelOpenButton, MobileTitle } from './components/Panel';
import { Toolbar } from './components/Toolbar';
import { AppStatus } from './components/AppStatus';
import { CreditsDialog, PrintParts, Toast, Notice } from './components/Overlays';
import { PoliciesPage } from './components/PoliciesPage';
import { closePolicies, policiesInUrl } from './lib/policies';

const MapView = lazy(() => import('./features/map/MapView'));

export default function App() {
  const { t, lang } = useT();
  const data = useData((s) => s.data);
  const error = useData((s) => s.error);
  const panelOpen = useApp((s) => s.panelOpen);
  const night = useApp((s) => s.night);
  const [ready, setReady] = useState(false);

  // 1) datos (JSON perezoso) → 2) estado desde la URL → 3) mapa
  useEffect(() => {
    loadData().then(() => {
      const patch = readHash();
      const sel = patch.sel;
      delete patch.sel;
      delete patch.detailOpen;
      setApp(patch);
      if (sel?.kind === 'place') select(sel.id, { noFly: !!patch.initialView });
      setReady(true);
    });
  }, []);

  useHashSync(ready);
  useRouteCompute();

  useEffect(() => {
    document.title = t('title');
    document.documentElement.lang = lang;
  }, [t, lang]);

  useEffect(() => {
    document.body.classList.toggle('night', night);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', night ? '#0e1f14' : '#386641');
  }, [night]);

  // atajos globales
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      if (e.key === 'Escape' && !/INPUT|SELECT|TEXTAREA/.test(a?.tagName ?? '')) {
        const s = getApp();
        if (s.policiesOpen) {
          closePolicies();
          return;
        }
        if (s.basemapPop || s.creditsOpen) return;
        if (s.detailOpen) deselect();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const sync = () => setApp({ policiesOpen: policiesInUrl() });
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  return (
    <div id="app" className={panelOpen ? '' : 'panel-closed'}>
      {ready && data ? (
        <Suspense
          fallback={
            <div className="map-loading">
              <span className="spinner" />
            </div>
          }
        >
          <MapView />
        </Suspense>
      ) : (
        <div className="map-loading">{error ? error : <span className="spinner" />}</div>
      )}
      <MobileTitle />
      <PanelOpenButton />
      {ready && data && (
        <>
          <Panel />
          <Toolbar />
          <PrintParts />
        </>
      )}
      <Toast />
      <AppStatus />
      <Notice />
      <CreditsDialog />
      <PoliciesPage />
    </div>
  );
}
