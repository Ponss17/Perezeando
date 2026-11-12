import { memo, useState, type ReactNode } from 'react';
import type { Place } from '../data/types';
import { CATEGORIES } from '../data/config';
import { MascotMono } from './MascotMono';
import { MascotArt, type MascotKind } from './MascotArt';
import { Icon } from './Icon';
import { useT } from '../i18n';
import { fmtKm } from '../lib/format';
import { useApp } from '../store/useApp';
import { catOne, provName } from '../store/labels';
import { nearbyOf, select } from '../store/selection';
import { placeThumb, prefetchPhoto } from '../lib/photo';
import { prefetchDetails } from '../lib/prefetch';
import { Highlight } from '../features/search/Highlight';
import { withMap } from '../lib/mapBus';
import { genericLabel, isGenericName } from '../lib/names';

export function ThumbBox({
  src,
  color,
  icon,
}: {
  src: string | null | undefined;
  color: string;
  icon: string;
}) {
  const [err, setErr] = useState(false);
  const [ok, setOk] = useState(false);
  const pic = err ? null : src;
  return (
    <div className={'thumb' + (pic && ok ? ' has-img' : '')} style={{ '--c': color } as React.CSSProperties}>
      <Icon name={icon} />
      {pic && (
        <img
          src={pic}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          referrerPolicy="no-referrer"
          className={ok ? 'ok' : undefined}
          onLoad={(e) => {
            const im = e.currentTarget;
            (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).finally(() => setOk(true));
          }}
          onError={() => setErr(true)}
        />
      )}
    </div>
  );
}

export function Thumb({ p }: { p: Place }) {
  const c = CATEGORIES[p.cat];
  return <ThumbBox src={placeThumb(p)} color={c.color} icon={c.icon} />;
}

interface Props {
  p: Place;
  q?: string;
  dist?: number | null;
  right?: ReactNode;
  kb?: boolean;
  onClick?: () => void;
}

export const PlaceItem = memo(function PlaceItem({ p, q, dist, right, kb, onClick }: Props) {
  const { t, L, lang } = useT();
  const on = useApp((s) => s.sel?.kind === 'place' && s.sel.id === p.id);
  const open = onClick ?? (() => select(p.id));
  const generic = isGenericName(p, lang);
  const title = generic ? genericLabel(p, lang, nearbyOf(p.id, 1)[0]?.[0]) : L(p.name);
  return (
    <li
      className={'item' + (on ? ' active' : '') + (kb ? ' kb' : '') + (generic ? ' is-generic' : '')}
      aria-selected={on || undefined}
      data-id={p.id}
      tabIndex={0}
      onClick={open}
      onPointerEnter={(e) => {
        prefetchPhoto(p);
        prefetchDetails();
        if (e.pointerType === 'mouse') withMap((m) => m.highlightPlace(p.id));
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') withMap((m) => m.highlightPlace(null));
      }}
      onFocus={() => {
        prefetchPhoto(p);
        prefetchDetails();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <Thumb p={p} />
      <div className="item-text">
        <div className="item-title" title={title}>
          <Highlight text={title} q={q} />
        </div>
        <div className="item-sub">
          <i className="cdot" style={{ '--c': CATEGORIES[p.cat].color } as React.CSSProperties} />
          {catOne(p.cat)}
          {p.facts?.capital && (
            <>
              <span className="sep">·</span>
              {t('capital')}
            </>
          )}
          <span className="sep">·</span>
          {provName(p.prov)}
        </div>
      </div>
      {right ?? (dist != null ? <span className="item-dist">{fmtKm(lang, dist)}</span> : null)}
    </li>
  );
});

export function EmptyState({
  icon,
  title,
  text,
  children,
  mascot,
}: {
  icon: string;
  title: string;
  text: string;
  children?: ReactNode;
  mascot?: boolean | MascotKind;
}) {
  const fig: MascotKind | 'mono' | null =
    mascot === 'route' || mascot === 'filters' || mascot === 'favs' ? mascot : mascot ? 'mono' : null;
  return (
    <li className={fig ? 'empty has-mascot' : 'empty'}>
      {fig === 'route' || fig === 'filters' || fig === 'favs' ? (
        <MascotArt kind={fig} className="empty-mascot" size={112} />
      ) : fig === 'mono' ? (
        <MascotMono className="empty-mascot" size={112} />
      ) : (
        <span className="empty-ico">
          <Icon name={icon} />
        </span>
      )}
      <b>{title}</b>
      <p>{text}</p>
      {children}
    </li>
  );
}
