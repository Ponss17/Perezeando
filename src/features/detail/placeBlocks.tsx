import { useEffect, useState, type RefObject } from 'react';
import { useData } from '../../data/load';
import { useT } from '../../i18n';
import type { Place } from '../../data/types';
import { PlaceItem, Thumb } from '../../components/PlaceItem';
import { Facts } from './parts';

export function StickyTitle({
  p,
  name,
  hostRef,
}: {
  p: Place;
  name: string;
  hostRef: RefObject<HTMLElement | null>;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const root = hostRef.current?.closest('.detail-pane, .panel-body') as HTMLElement | null;
    const title = hostRef.current?.querySelector('.detail-body h2') as HTMLElement | null;
    if (!root || !title) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), {
      root,
      threshold: 0,
      rootMargin: '-56px 0px 0px 0px',
    });
    io.observe(title);
    return () => io.disconnect();
  }, [hostRef]);
  return (
    <div className="detail-sticky-host" aria-hidden="true">
      <div className={'detail-sticky' + (show ? ' show' : '')}>
        <Thumb p={p} />
        <b>{name}</b>
      </div>
    </div>
  );
}

export function VisitBlock({ v }: { v: NonNullable<Place['visit']> }) {
  const { t, lang } = useT();
  const L = (x?: { es?: string; en?: string } | string) => {
    if (!x) return '';
    if (typeof x === 'string') return x;
    return (lang === 'es' ? x.es : x.en) || x.es || x.en || '';
  };
  const rows: [string, string][] = [];
  if (v.access) rows.push([t('visit_access'), L(v.access)]);
  if (v.activities) rows.push([t('visit_activities'), L(v.activities)]);
  if (v.difficulty) rows.push([t('visit_difficulty'), L(v.difficulty)]);
  if (v.note) rows.push([t('visit_note'), L(v.note)]);
  if (!rows.length) return null;
  return (
    <div className="visit-block">
      <Facts rows={rows} />
      {v.src?.url && (
        <p className="muted small">
          <a href={v.src.url} target="_blank" rel="noopener">
            {v.src.name || t('sources_more')}
          </a>
          {v.src.license ? ` · ${v.src.license}` : ''}
        </p>
      )}
    </div>
  );
}

export function TipsBlock({ tips }: { tips: NonNullable<Place['tips']> }) {
  const { t, lang } = useT();
  const L = (x?: { es?: string; en?: string }) =>
    x ? (lang === 'es' ? x.es : x.en) || x.es || x.en || '' : '';
  const rows: [string, string][] = [];
  if (tips.view) rows.push([t('fauna_view_tip'), L(tips.view)]);
  if (tips.care) rows.push([t('fauna_care_tip'), L(tips.care)]);
  if (!rows.length) return null;
  return <Facts rows={rows} />;
}

export function RelatedBlock({ ids, title }: { ids: string[]; title: string }) {
  const places = useData((s) => s.data?.byId);
  const list = ids.map((id) => places?.get(id)).filter(Boolean) as Place[];
  if (!list.length) return null;
  return (
    <div className="related-block">
      <h3 className="section-title">{title}</h3>
      <ul className="list compact">
        {list.slice(0, 8).map((q) => (
          <PlaceItem key={q.id} p={q} />
        ))}
      </ul>
    </div>
  );
}
