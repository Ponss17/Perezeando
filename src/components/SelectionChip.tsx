import type { CSSProperties } from 'react';
import { useApp } from '../store/useApp';
import { useData } from '../data/load';
import { useT } from '../i18n';
import { CATEGORIES } from '../data/config';
import { catOne, nearbyOf, togglePanel } from '../store/actions';
import { directionsUrl } from '../features/route/routing';
import { Icon } from './Icon';
import { MiniMarker } from './MiniMarker';
import { genericLabel, isGenericName } from '../lib/names';

/** Mini tarjeta flotante cuando el panel está cerrado y hay un lugar seleccionado */
export function SelectionChip() {
  const { t, lang } = useT();
  const open = useApp((s) => s.panelOpen);
  const sel = useApp((s) => s.sel);
  const p = useData((s) => (sel?.kind === 'place' ? s.data?.byId.get(sel.id) : null));
  if (!p) return null;
  const show = !open;
  const near = isGenericName(p, lang) ? nearbyOf(p.id, 1)[0]?.[0] : null;
  const name = genericLabel(p, lang, near);
  const c = CATEGORIES[p.cat];
  return (
    <div className={'sel-chip' + (show ? ' show' : '')} role="status" aria-hidden={!show || undefined}>
      <button
        type="button"
        className="sel-chip-main"
        onClick={() => togglePanel(true)}
        tabIndex={show ? 0 : -1}
      >
        <MiniMarker cat={p.cat} size={22} />
        <span className="sel-chip-text">
          <b>{name}</b>
          <small style={{ '--c': c.color } as CSSProperties}>{catOne(p.cat)}</small>
        </span>
      </button>
      <a
        className="sel-chip-go"
        href={directionsUrl(p)}
        target="_blank"
        rel="noopener"
        title={t('directions')}
        tabIndex={show ? 0 : -1}
      >
        <Icon name="navigation" />
        <span>{t('directions')}</span>
      </a>
    </div>
  );
}
