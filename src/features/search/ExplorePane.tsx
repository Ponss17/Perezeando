import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../store/useApp';
import { useData } from '../../data/load';
import { useT } from '../../i18n';
import { CATEGORIES, CATEGORY_ORDER, GROUPS, PROVINCE_IDS } from '../../data/config';
import type { CategoryId, ProvinceFilter, ProvinceId } from '../../data/types';
import {
  catName,
  clearFilters,
  layersAll,
  locate,
  setCat,
  setProv,
  setTab,
  showProvince,
  surprise,
} from '../../store/actions';
import { fmtNum, thumbUrl } from '../../lib/format';
import { Icon } from '../../components/Icon';
import { Select, type SelectOption } from '../../components/Select';
import { EmptyState, PlaceItem } from '../../components/PlaceItem';
import { inCat } from '../../lib/selectors';
import { computeResults, useKb } from './results';
import { subscribeSearch } from './searchIndex';
import { DISCOVER_SECTIONS } from '../../data/discover';

export default function ExplorePane() {
  const { t, L, lang } = useT();
  const data = useData((s) => s.data)!;
  const query = useApp((s) => s.query);
  const prov = useApp((s) => s.prov);
  const cat = useApp((s) => s.cat);
  const active = useApp((s) => s.active);
  const near = useApp((s) => s.near);
  const nearPlace = useApp((s) => s.nearPlace);
  const me = useApp((s) => s.me);
  const locating = useApp((s) => s.locating);
  const kb = useKb((s) => s.i);
  const [searchTick, setSearchTick] = useState(0);
  useEffect(() => subscribeSearch(() => setSearchTick((n) => n + 1)), []);

  const r = useMemo(() => {
    void searchTick; // invalida cuando el índice Fuse termina de cargar
    return computeResults({ query, prov, cat, active, near, nearPlace, me, lang }, data);
  }, [query, prov, cat, active, near, nearPlace, me, lang, data, searchTick]);
  const filtered = prov !== 'all' || cat !== 'all' || near || !!nearPlace;
  const showDiscover = !filtered && query.trim().length < 2;
  const hidden = CATEGORY_ORDER.length - active.length;
  const allHidden = active.length === 0;
  const counts = useMemo(() => {
    const m = new Map<CategoryId, number>();
    r.list.forEach((p) => m.set(p.cat, (m.get(p.cat) ?? 0) + 1));
    return m;
  }, [r.list]);

  const tallies = useMemo(() => {
    const byProv = new Map<string, number>();
    const byCat = new Map<string, number>();
    for (const p of data.places) {
      // provincias: respetan la categoría elegida
      if (cat === 'all' || inCat(p, cat)) {
        byProv.set(p.prov, (byProv.get(p.prov) ?? 0) + 1);
      }
      // categorías: respetan la provincia elegida
      if (prov !== 'all' && p.prov !== prov) continue;
      byCat.set(p.cat, (byCat.get(p.cat) ?? 0) + 1);
      for (const c of p.also ?? []) if (c !== p.cat) byCat.set(c, (byCat.get(c) ?? 0) + 1);
    }
    return { prov: byProv, cat: byCat };
  }, [data, prov, cat]);

  const provOpts = useMemo<SelectOption[]>(() => {
    return [
      { value: 'all', label: t('all_provinces') },
      ...PROVINCE_IDS.map((id) => ({
        value: id,
        label: data.provById.get(id)?.name ?? id,
        count: tallies.prov.get(id) ?? 0,
      })),
      { value: 'mar', label: t('marine'), count: tallies.prov.get('mar') ?? 0 },
    ];
  }, [data, t, tallies]);
  const catOpts = useMemo<SelectOption[]>(() => {
    const rows = GROUPS.flatMap((g) =>
      g.cats
        .map((c) => ({
          value: c,
          label: catName(c),
          group: L(g.label),
          color: CATEGORIES[c].color,
          icon: CATEGORIES[c].icon,
          count: tallies.cat.get(c) ?? 0,
        }))
        // con provincia: ocultar categorías vacías (salvo la ya seleccionada)
        .filter((o) => prov === 'all' || o.count > 0 || o.value === cat),
    );
    return [{ value: 'all', label: t('all_categories') }, ...rows];
  }, [t, L, tallies, prov, cat]);
  // renderizado progresivo: con ~1000 lugares solo se montan los primeros N y se amplía al acercarse al final
  const STEP = 24;
  const [lim, setLim] = useState(STEP);
  const [limFor, setLimFor] = useState(r);
  if (r !== limFor) {
    setLimFor(r);
    setLim(STEP);
  }
  const kbLim = kb >= 0 ? Math.max(STEP, Math.ceil((kb + 6) / STEP) * STEP) : STEP;
  const shown = Math.max(lim, kbLim);
  const sentinel = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const root = el.closest('.slide-pane, .detail-pane, .panel-body');
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setLim((l) => l + STEP), {
      root,
      rootMargin: '400px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, r]);
  const lead = r.grouped && prov !== 'all' && prov !== 'mar' ? <ProvinceLead id={prov} /> : null;
  type Sec = { cat: CategoryId | null; key: string; items: ReactNode[] };
  const secs: Sec[] = [];
  let cur: Sec | null = null;
  r.list.slice(0, shown).forEach((p, i) => {
    const cat = r.grouped ? p.cat : null;
    if (!cur || cur.cat !== cat) {
      cur = { cat, key: cat ? 's-' + cat : 's-all', items: [] };
      secs.push(cur);
    }
    cur.items.push(<PlaceItem key={p.id} p={p} q={r.q} dist={r.dists?.get(p.id)} kb={i === kb} />);
  });

  const nearLabel = nearPlace ? data.byId.get(nearPlace)?.name[lang] : near && me ? t('near_me') : '';

  return (
    <section className="tab-pane active" data-pane="explore">
      <div className="filters">
        <div className="field">
          <span className="field-lbl">{t('province_lbl')}</span>
          <Select
            ariaLabel={t('province')}
            value={prov}
            options={provOpts}
            onChange={(v) => setProv(v as ProvinceFilter, true)}
          />
        </div>
        <div className="field">
          <span className="field-lbl">{t('category_lbl')}</span>
          <Select
            ariaLabel={t('category')}
            value={cat}
            options={catOpts}
            onChange={(v) => setCat(v as CategoryId | 'all')}
          />
        </div>
      </div>
      <div className="meta-row">
        <div className="result-meta">
          {showDiscover ? (
            <b>{t('discover_must')}</b>
          ) : (
            <>
              <b>{fmtNum(lang, r.list.length)}</b> {t('places_lbl')}
            </>
          )}
          {nearLabel ? ` · ${nearLabel}` : ''}
          {hidden > 0 && (
            <button
              className="text-btn inline hidden-cats"
              title={allHidden ? t('show_all') : t('hidden_tip')}
              aria-label={allHidden ? t('show_all') : t('hidden_tip')}
              onClick={() => (allHidden ? layersAll() : setTab('layers'))}
            >
              <Icon name="eye-off" />
              {allHidden
                ? t('all_hidden_meta')
                : `${hidden} ${t(hidden === 1 ? 'hidden_one' : 'hidden_many')}`}
            </button>
          )}
          {filtered && (
            <button className="text-btn inline" onClick={clearFilters}>
              {t('clear')}
            </button>
          )}
        </div>
        <button className="text-btn" onClick={surprise}>
          <Icon name="sparkles" />
          <span>{t('surprise')}</span>
        </button>
        <button className={'text-btn' + (locating ? ' busy' : '')} onClick={() => locate(true)}>
          <Icon name="locate-fixed" />
          <span>{t('near_me')}</span>
        </button>
      </div>
      <ul className="list" id="resultList">
        {allHidden ? (
          <EmptyState
            icon="eye-off"
            mascot="filters"
            title={t('all_hidden_title')}
            text={t('all_hidden_text')}
          >
            <span className="empty-actions">
              <button className="pill sm primary" onClick={layersAll}>
                <Icon name="eye" />
                {t('show_all')}
              </button>
              <button className="pill sm" onClick={() => setTab('layers')}>
                {t('go_filters')}
              </button>
            </span>
          </EmptyState>
        ) : showDiscover ? (
          <DiscoverHome />
        ) : (
          <>
            {lead}
            {r.list.length ? (
              <>
                {secs.map((s) => (
                  <li className="list-sec" key={s.key}>
                    {s.cat && (
                      <div className="list-head">
                        <i
                          className="cdot"
                          style={{ '--c': CATEGORIES[s.cat].color } as React.CSSProperties}
                        />
                        {catName(s.cat)}
                        <span>{counts.get(s.cat)}</span>
                      </div>
                    )}
                    <ul className="list-sec-items">{s.items}</ul>
                  </li>
                ))}
                {r.list.length > shown && (
                  <li key="more" ref={sentinel} className="list-more" aria-hidden="true" />
                )}
              </>
            ) : (
              <EmptyState icon="search" mascot="filters" title={t('no_results_title')} text={t('no_results')}>
                {filtered && (
                  <button className="pill sm" onClick={clearFilters}>
                    {t('clear_filters')}
                  </button>
                )}
              </EmptyState>
            )}
          </>
        )}
      </ul>
    </section>
  );
}

function DiscoverHome() {
  const { t } = useT();
  const data = useData((s) => s.data)!;
  return (
    <>
      {DISCOVER_SECTIONS.map((sec) => {
        const places = sec.ids.map((id) => data.byId.get(id)).filter(Boolean);
        if (!places.length) return null;
        return (
          <li className="list-sec discover-sec" key={sec.id}>
            <div className="list-head discover-head">{t(sec.labelKey as 'discover_must')}</div>
            <ul className="list-sec-items">
              {places.map((p) => (
                <PlaceItem key={p!.id} p={p!} />
              ))}
            </ul>
          </li>
        );
      })}
    </>
  );
}

function ProvinceLead({ id }: { id: ProvinceId }) {
  const { t } = useT();
  const pp = useData((s) => s.data)!.provById.get(id)!;
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState(false);
  const img = pp.img && !err;
  const open = () => showProvince(id);
  return (
    <li
      className="item"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <div
        className={'thumb' + (img && ok ? ' has-img' : '')}
        style={{ '--c': pp.color || '#386641' } as React.CSSProperties}
      >
        <Icon name="map" />
        {img && (
          <img
            src={thumbUrl(pp.img!.src)}
            alt=""
            loading="lazy"
            decoding="async"
            className={ok ? 'ok' : undefined}
            onLoad={(e) => {
              const im = e.currentTarget;
              (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).finally(() => setOk(true));
            }}
            onError={() => setErr(true)}
          />
        )}
      </div>
      <div className="item-text">
        <div className="item-title">
          {t('province_of')} {pp.name}
        </div>
        <div className="item-sub">Costa Rica</div>
      </div>
    </li>
  );
}
