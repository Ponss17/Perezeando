import { MascotMono } from './MascotMono';
import { setApp, useApp } from '../store/useApp';
import { useT } from '../i18n';
import { openPolicies } from '../lib/policies';
import { Icon } from './Icon';
import { useModalDialog } from '../hooks/useModalDialog';

export function CreditsDialog() {
  const { t, lang } = useT();
  const open = useApp((s) => s.creditsOpen);
  const ref = useModalDialog(open);
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
