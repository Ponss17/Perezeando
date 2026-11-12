import { lazy, Suspense, useEffect, useState } from 'react';
import { getApp, setApp, useApp } from './store/useApp';
import { loadData, useData } from './data/load';
import { useT } from './i18n';
import { readHash, useHashSync } from './hooks/hash';
import { useRouteCompute } from './hooks/useRouteCompute';
import { deselect, select, setCat, setProv, showProvince } from './store/selection';
import { locate, setBase } from './store/tools';

if (typeof location !== 'undefined' && location.search.includes('e2e'))
  (window as unknown as { __cract: unknown }).__cract = {
    showProvince,
    select,
    setCat,
    setProv,
    deselect,
    setBase,
    locate,
  };
import { Panel, PanelOpenButton, MobileTitle } from './components/Panel';
import { Toolbar } from './components/Toolbar';
import { AppStatus } from './components/AppStatus';
import { CreditsDialog } from './components/CreditsDialog';
import { PrintParts } from './components/PrintParts';
import { Toast } from './components/Toast';
import { Notice } from './components/Notice';
import { SelectionChip } from './components/SelectionChip';
import { PoliciesPage } from './components/PoliciesPage';
import { BootSplash } from './components/BootSplash';
import { policiesInUrl } from './lib/policies';
import { onMapReady } from './lib/boot';
import { withMap } from './lib/mapBus';

const MapView = lazy(() => import('./features/map/MapView'));

const BOOT_MIN_MS = 800;
const BOOT_MAX_MS = 16000;
const BOOT_FADE_MS = 520;

export default function App() {
  const { t, lang } = useT();
  const data = useData((s) => s.data);
  const error = useData((s) => s.error);
  const panelOpen = useApp((s) => s.panelOpen);
  const night = useApp((s) => s.night);
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [reveal, setReveal] = useState(false);

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
    if (!ready || !data || error) return;
    const started = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, BOOT_MIN_MS - (performance.now() - started));
      window.setTimeout(() => {
        setLeaving(true);
        setReveal(true);
        withMap((m) => {
          m.resize();
          m.revealContent();
        });
        window.setTimeout(() => setSplash(false), BOOT_FADE_MS);
        window.setTimeout(() => setReveal(false), BOOT_FADE_MS + 800);
      }, wait);
    };
    const off = onMapReady(finish);
    const maxT = window.setTimeout(finish, BOOT_MAX_MS);
    return () => {
      off();
      clearTimeout(maxT);
    };
  }, [ready, data, error]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      if (e.key === 'Escape' && !/INPUT|SELECT|TEXTAREA/.test(a?.tagName ?? '')) {
        const s = getApp();
        if (s.policiesOpen || s.basemapPop || s.creditsOpen) return;
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

  const bootClass = splash && !reveal ? ' boot-hold' : reveal ? ' boot-reveal' : '';

  return (
    <div id="app" className={(panelOpen ? '' : 'panel-closed') + bootClass}>
      {ready && data ? (
        <Suspense fallback={null}>
          <MapView />
        </Suspense>
      ) : null}
      <MobileTitle />
      <PanelOpenButton />
      {ready && data && <SelectionChip />}
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
      {splash && <BootSplash leaving={leaving} error={error} />}
    </div>
  );
}
