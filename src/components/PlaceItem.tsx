import { memo, useState, type ReactNode } from 'react';
import type { Place } from '../data/types';
import { CATEGORIES } from '../data/config';
import { MascotMono } from './MascotMono';
import { Icon } from './Icon';
import { useT } from '../i18n';
import { fmtKm } from '../lib/format';
import { useApp } from '../store/useApp';
import { catOne, provName, select } from '../store/actions';
import { placePicture, prefetchPhoto } from '../lib/photo';
import { prefetchDetails } from '../lib/prefetch';
import { Highlight } from '../features/search/Highlight';

export function Thumb({ p }: { p: Place }) {
  const c = CATEGORIES[p.cat];
  const [err, setErr] = useState(false);
  const [ok, setOk] = useState(false);
  const pic = !err ? placePicture(p) : null;
  return (
    <div
      className={'thumb' + (pic && ok ? ' has-img' : '')}
      style={{ '--c': c.color } as React.CSSProperties}
    >
      <Icon name={c.icon} />
      {pic && (
        <img
          src={pic.src}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          referrerPolicy="no-referrer"
          className={ok ? 'ok' : ''}
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

interface Props {
  p: Place;
  q?: string;
  dist?: number | null;
  right?: ReactNode;
  kb?: boolean;
  onClick?: () => void;
}

/** Fila de lista para un lugar */
export const PlaceItem = memo(function PlaceItem({ p, q, dist, right, kb, onClick }: Props) {
  const { t, L, lang } = useT();
  const on = useApp((s) => s.sel?.kind === 'place' && s.sel.id === p.id);
  const open = onClick ?? (() => select(p.id));
  return (
    <li
      className={'item' + (on ? ' active' : '') + (kb ? ' kb' : '')}
      aria-selected={on || undefined}
      data-id={p.id}
      tabIndex={0}
      onClick={open}
      onPointerEnter={() => {
        prefetchPhoto(p, lang);
        prefetchDetails();
      }}
      onFocus={() => {
        prefetchPhoto(p, lang);
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
        <div className="item-title">
          <Highlight text={L(p.name)} q={q} />
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
  mascot?: boolean;
}) {
  return (
    <li className={mascot ? 'empty has-mascot' : 'empty'}>
      {mascot ? (
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
