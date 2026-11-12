import { Fragment, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store/useApp';
import { useData } from '../../data/load';
import { useT } from '../../i18n';
import type { Place } from '../../data/types';
import { CATEGORIES } from '../../data/config';
import { catOne, provName } from '../../store/labels';
import { select } from '../../store/selection';
import {
  exportGpx,
  fitRoute,
  moveStop,
  optimizeRoute,
  setRoute,
  sleepInTown,
  toggleDayStart,
  toggleRoute,
} from '../../store/trip';
import { fmtDur, fmtKm } from '../../lib/format';
import { haversine, ll } from '../../lib/geo';
import { Icon } from '../../components/Icon';
import { EmptyState, PlaceItem } from '../../components/PlaceItem';
import { searchPlaces, subscribeSearch } from '../search/searchIndex';
import { gmapsRouteUrl, routeKey } from './routing';

export default function RoutePane() {
  const { t, L, lang } = useT();
  const data = useData((s) => s.data)!;
  const route = useApp((s) => s.route);
  const dayStarts = useApp((s) => s.dayStarts);
  const rd = useApp((s) => s.routeData);
  const loading = useApp((s) => s.routeLoading);
  const [q, setQ] = useState('');
  const [searchTick, setSearchTick] = useState(0);
  useEffect(() => subscribeSearch(() => setSearchTick((n) => n + 1)), []);

  const stops = route.map((id) => data.byId.get(id)).filter(Boolean) as Place[];
  const starts = new Set(dayStarts);
  const routeData = rd && rd.key === routeKey(route) ? rd : null;
  const dayOf = (i: number) => {
    let n = 1;
    for (let k = 1; k <= i; k++) if (starts.has(stops[k].id)) n++;
    return n;
  };
  const dayEnd = (i: number) => {
    for (let k = i + 1; k < stops.length; k++) if (starts.has(stops[k].id)) return k;
    return stops.length;
  };
  const dayStats = (a: number, b: number) => {
    if (!routeData) return null;
    let d = 0;
    let tm = 0;
    const from = a === 0 ? 0 : a - 1;
    for (let k = from; k < b - 1 && k < routeData.legs.length; k++) {
      d += routeData.legs[k].d;
      tm += routeData.legs[k].t;
    }
    return { d, t: tm };
  };
  const nightTown = (endStop: number) => {
    const here = stops[endStop];
    if (!here || here.cat === 'ciudades') return null;
    let best: Place | null = null;
    let bd = 45;
    for (const p of data.places) {
      if (p.cat !== 'ciudades' || route.includes(p.id)) continue;
      const dist = haversine(ll(here), ll(p));
      if (dist < bd) {
        bd = dist;
        best = p;
      }
    }
    return best;
  };
  const sugg = useMemo(() => {
    void searchTick;
    return q.trim().length >= 2
      ? searchPlaces(data, q.trim())
          .filter((p) => !route.includes(p.id))
          .slice(0, 6)
      : [];
  }, [q, data, route, searchTick]);

  const add = (p: Place) => {
    toggleRoute(p.id);
    setQ('');
    setTimeout(fitRoute, 60);
  };

  return (
    <section className="tab-pane active" data-pane="route">
      <div className="search small-search">
        <span className="search-ico">
          <Icon name="plus" />
        </span>
        <input
          id="routeSearch"
          type="search"
          autoComplete="off"
          placeholder={t('route_search_ph')}
          aria-label={t('route_search_ph')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && sugg[0]) add(sugg[0]);
            if (e.key === 'Escape') setQ('');
          }}
        />
      </div>
      <ul className="list compact" id="routeSuggest">
        {sugg.map((p) => (
          <PlaceItem
            key={p.id}
            p={p}
            q={q}
            onClick={() => add(p)}
            right={<Icon name="plus" className="add-ico" />}
          />
        ))}
      </ul>

      <div className="route-summary">
        {stops.length >= 2 &&
          (loading || !routeData ? (
            <div className="route-card loading">
              <span className="spinner" />
              {t('route_calc')}
            </div>
          ) : (
            <>
              <div className="route-card">
                <div className="stat">
                  <small>{t('route_distance')}</small>
                  <b>{fmtKm(lang, routeData.distance)}</b>
                </div>
                <div className="stat">
                  <small>{t('route_time')}</small>
                  <b>{fmtDur(lang, routeData.duration)}</b>
                </div>
                <div className="stat">
                  <small>{t('stops_lbl')}</small>
                  <b>{stops.length}</b>
                </div>
              </div>
              {routeData.mode === 'fallback' ? (
                <div className="note">
                  <Icon name="info" />
                  {t('route_fallback')}
                </div>
              ) : (
                <div className="src-note">{t('source')}: OSRM · © OpenStreetMap</div>
              )}
            </>
          ))}
      </div>

      <ol className="stops" id="routeStops">
        {stops.length ? (
          stops.map((p, i) => {
            const leg = i > 0 ? routeData?.legs[i - 1] : undefined;
            const fresh = i > 0 && starts.has(p.id);
            const showDay = i === 0 ? starts.size > 0 : fresh;
            const end = showDay ? dayEnd(i) : i;
            const stats = showDay ? dayStats(i, end) : null;
            const town = showDay ? nightTown(end - 1) : null;
            return (
              <Fragment key={p.id}>
                {showDay && (
                  <li className="day-head">
                    <b>
                      {t('day')} {dayOf(i)}
                    </b>
                    {stats && (
                      <small>
                        {fmtKm(lang, stats.d)} · {fmtDur(lang, stats.t)}
                      </small>
                    )}
                    {fresh && (
                      <button type="button" className="text-btn" onClick={() => toggleDayStart(p.id)}>
                        {t('day_join')}
                      </button>
                    )}
                    {town && (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => sleepInTown(town.id, stops[end - 1].id)}
                      >
                        {t('sleep_at')}: {L(town.name)}
                      </button>
                    )}
                  </li>
                )}
                {i > 0 &&
                  (leg ? (
                    <li className="leg">
                      <Icon name="car" />
                      <span>
                        {fmtKm(lang, leg.d)} · {fmtDur(lang, leg.t)}
                      </span>
                      {!fresh && (
                        <button type="button" className="text-btn" onClick={() => toggleDayStart(p.id)}>
                          {t('day_new')}
                        </button>
                      )}
                    </li>
                  ) : (
                    <li className="leg empty-leg" />
                  ))}
                {stopRow(p, i, stops.length, !!routeData?.offroad?.[i])}
              </Fragment>
            );
          })
        ) : (
          <EmptyState icon="route" mascot="route" title={t('route_empty_title')} text={t('route_empty')} />
        )}
      </ol>

      {stops.length > 0 && (
        <div className="pane-actions wrap">
          <a className="pill primary wide" href={gmapsRouteUrl(stops)} target="_blank" rel="noopener">
            <Icon name="navigation" />
            <span>{t('route_gmaps')}</span>
          </a>
          {stops.length >= 3 && (
            <button className="pill" onClick={optimizeRoute}>
              <Icon name="sliders-horizontal" />
              <span>{t('route_optimize')}</span>
            </button>
          )}
          <button className="pill" onClick={exportGpx}>
            <Icon name="download" />
            <span>{t('export_gpx')}</span>
          </button>
          <button className="pill ghost danger" onClick={() => setRoute([])}>
            <Icon name="trash-2" />
            <span>{t('route_clear')}</span>
          </button>
        </div>
      )}
    </section>
  );

  function stopRow(p: Place, i: number, n: number, offroad: boolean) {
    return (
      <>
        <li className="stop" data-id={p.id}>
          <span className="num">{i + 1}</span>
          <div className="item-text" onClick={() => select(p.id)}>
            <div className="item-title">{L(p.name)}</div>
            <div className="item-sub">
              <i className="cdot" style={{ '--c': CATEGORIES[p.cat].color } as React.CSSProperties} />
              {catOne(p.cat)}
              <span className="sep">·</span>
              {provName(p.prov)}
            </div>
            {offroad && (
              <div className="warn">
                <Icon name="info" />
                {t('route_offroad')}
              </div>
            )}
          </div>
          <div className="ctrls">
            <button
              className="icon-btn small"
              aria-label={t('up')}
              title={t('up')}
              disabled={i === 0}
              onClick={() => moveStop(i, -1)}
            >
              <Icon name="chevron-up" />
            </button>
            <button
              className="icon-btn small"
              aria-label={t('down')}
              title={t('down')}
              disabled={i === n - 1}
              onClick={() => moveStop(i, 1)}
            >
              <Icon name="chevron-down" />
            </button>
            <button
              className="icon-btn small"
              aria-label={t('remove')}
              title={t('remove')}
              onClick={() => setRoute(route.filter((x) => x !== p.id))}
            >
              <Icon name="x" />
            </button>
          </div>
        </li>
      </>
    );
  }
}
