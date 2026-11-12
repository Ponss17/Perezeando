import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../store/useApp';
import { useData } from '../../data/load';
import { useT } from '../../i18n';
import { CATEGORIES, CATEGORY_ORDER, GROUPS, PROVINCE_IDS } from '../../data/config';
import type { CategoryId, ProvinceFilter, ProvinceId } from '../../data/types';
import { catName } from '../../store/labels';
import {
  clearFilters,
  layersAll,
  setCat,
  setProv,
  setTab,
  showProvince,
  surprise,
} from '../../store/selection';
import { locate } from '../../store/tools';
import { fmtNum, thumbUrl } from '../../lib/format';
import { Icon } from '../../components/Icon';
import { Select, type SelectOption } from '../../components/Select';
import { EmptyState, PlaceItem, ThumbBox } from '../../components/PlaceItem';
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
  const me = useApp((s) => s.me);
  const locating = useApp((s) => s.locating);
  const kb = useKb((s) => s.i);
  const [searchTick, setSearchTick] = useState(0);
  const [browseAll, setBrowseAll] = useState(false);
  const [slide, setSlide] = useState<'next' | 'prev' | null>(null);
  const browse = (all: boolean) => {
    if (all === browseAll) return;
    setSlide(all ? 'next' : 'prev');
    setBrowseAll(all);
  };
  useEffect(() => subscribeSearch(() => setSearchTick((n) => n + 1)), []);

  const r = useMemo(() => {
    void searchTick; // invalida cuando el índice Fuse termina de cargar
    return computeResults({ query, prov, cat, active, near, me, lang }, data);
  }, [query, prov, cat, active, near, me, lang, data, searchTick]);
  const filtered = prov !== 'all' || cat !== 'all' || near;
  const homeMode = !filtered && query.trim().length < 2;
  const showDiscover = homeMode && !browseAll;
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
      if (cat === 'all' || inCat(p, cat)) {
        byProv.set(p.prov, (byProv.get(p.prov) ?? 0) + 1);
      }
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
        .filter((o) => prov === 'all' || o.count > 0 || o.value === cat),
    );
    return [{ value: 'all', label: t('all_categories') }, ...rows];
  }, [t, L, tallies, prov, cat]);
  const STEP = 24;
  const startLim = r.dists ? r.list.length || STEP : homeMode && browseAll ? 120 : STEP;
  const [lim, setLim] = useState(startLim);
  const [limKey, setLimKey] = useState(r);
  const [limStart, setLimStart] = useState(startLim);
  if (r !== limKey || startLim !== limStart) {
    setLimKey(r);
    setLimStart(startLim);
    setLim(startLim);
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

  const nearMe = near && !!me;
  const nearPhrase = nearMe ? t(r.list.length === 1 ? 'near_of_me_one' : 'near_of_me') : '';
  const nearTitle = nearPhrase ? `${fmtNum(lang, r.list.length)} ${nearPhrase}` : '';
  const hiddenLbl = `${hidden} ${t(hidden === 1 ? 'hidden_one' : 'hidden_many')}`;

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
          {homeMode ? (
            <div
              className="browse-mode"
              role="group"
              aria-label={t('discover_must')}
              data-all={browseAll || undefined}
            >
              <span className="browse-ind" aria-hidden="true" />
              <button
                type="button"
                className="browse-mode-btn"
                aria-pressed={!browseAll}
                onClick={() => browse(false)}
              >
                {t('discover_must')}
              </button>
              <button
                type="button"
                className="browse-mode-btn"
                aria-pressed={browseAll}
                onClick={() => browse(true)}
              >
                {t('discover_all')}
                <span className="browse-n">{fmtNum(lang, r.list.length)}</span>
              </button>
            </div>
          ) : nearTitle ? (
            <span className="result-count" title={nearTitle}>
              <b>{fmtNum(lang, r.list.length)}</b> {nearPhrase}
            </span>
          ) : (
            <>
              <b>{fmtNum(lang, r.list.length)}</b> {t('places_lbl')}
            </>
          )}
          {hidden > 0 && (
            <button
              className="text-btn inline hidden-cats"
              title={allHidden ? t('show_all') : `${hiddenLbl} · ${t('hidden_tip')}`}
              aria-label={allHidden ? t('show_all') : `${hiddenLbl} · ${t('hidden_tip')}`}
              onClick={() => (allHidden ? layersAll() : setTab('layers'))}
            >
              <Icon name="eye-off" />
              {allHidden ? t('all_hidden_meta') : <span className="hidden-n">{hidden}</span>}
            </button>
          )}
        </div>
        <div className="meta-actions">
          {filtered && (
            <button className="text-btn inline" onClick={clearFilters}>
              {t('clear')}
            </button>
          )}
          <button
            className="text-btn icon-only"
            title={t('surprise')}
            aria-label={t('surprise')}
            onClick={surprise}
          >
            <Icon name="sparkles" />
          </button>
          <button
            className={'text-btn icon-only' + (locating ? ' busy' : '')}
            title={t('near_me')}
            aria-label={t('near_me')}
            aria-busy={locating || undefined}
            onClick={() => locate(true)}
          >
            <Icon name="locate-fixed" />
          </button>
        </div>
      </div>
      <ul
        className={'list' + (slide && homeMode ? ' browse-in-' + slide : '')}
        id="resultList"
        onAnimationEnd={(e) => e.target === e.currentTarget && setSlide(null)}
      >
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
            <div className="list-head discover-head">{t(sec.labelKey)}</div>
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
      <ThumbBox src={pp.img && thumbUrl(pp.img.src)} color={pp.color || '#386641'} icon="map" />
      <div className="item-text">
        <div className="item-title">
          {t('province_of')} {pp.name}
        </div>
        <div className="item-sub">Costa Rica</div>
      </div>
    </li>
  );
}
