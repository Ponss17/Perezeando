import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../store/useApp';
import { useData } from '../../data/load';
import { useT } from '../../i18n';
import { CATEGORIES } from '../../data/config';
import type { Place } from '../../data/types';
import { catOne, nearbyOf, provName, share, toggleFav, toggleRoute } from '../../store/actions';
import { fmt } from '../../lib/format';
import { fetchWikiSummary, wikiTarget, wikiUrl } from '../../lib/wiki';
import {
  HERO_W,
  isImageReady,
  knownPhoto,
  prefetchPhoto,
  preloadImage,
  resolvePhoto,
  satelliteSnapshot,
  sizedThumb,
  type PlacePhoto,
} from '../../lib/photo';
import { iconSvg } from '../../lib/icons';
import { directionsUrl } from '../route/routing';
import { Icon } from '../../components/Icon';
import { PlaceItem } from '../../components/PlaceItem';
import { Attrib, Facts, HeroTop, NickSub, Qa, SourceBox, nickRow } from './parts';
import { altName } from '../../lib/names';
import { MiniMarker } from '../../components/MiniMarker';

/** Ficha de un lugar (cargada bajo demanda) */
export default function PlaceDetail({ id }: { id: string }) {
  const { t, L, lang } = useT();
  const p = useData((s) => s.data!.byId.get(id)) as Place;
  const fav = useApp((s) => s.favs.includes(id));
  const inRoute = useApp((s) => s.route.includes(id));
  const w = wikiTarget(lang, p.wiki);
  const wkey = w ? w.lang + ':' + w.title : '';
  const [wiki, setWiki] = useState<{ key: string; ex?: string; failed?: boolean } | null>(null);
  const pkey = id + ':' + lang;
  const [photo, setPhoto] = useState<{ key: string; ph: PlacePhoto | null } | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.closest('.detail-pane, .panel-body')?.scrollTo({ top: 0 });
  }, [id]);

  useEffect(() => {
    if (!w) return;
    let live = true;
    fetchWikiSummary(w)
      .then((d) => live && setWiki({ key: wkey, ex: d.extract ?? '' }))
      .catch(() => live && setWiki({ key: wkey, failed: true }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wkey]);

  useEffect(() => {
    let live = true;
    resolvePhoto(p, lang).then((ph) => live && setPhoto({ key: pkey, ph }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkey]);

  const near = useMemo(() => nearbyOf(id, 2), [id]);
  // precarga las portadas de los lugares cercanos (los siguientes clics más probables)
  useEffect(() => {
    const tm = setTimeout(() => near.forEach(([q]) => prefetchPhoto(q, lang)), 1800);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lang]);
  const c = CATEGORIES[p.cat];
  const wk = wiki && wiki.key === wkey ? wiki : null;
  const name = L(p.name);
  const other = altName(lang, p.name);
  const f = p.facts ?? {};
  const known = knownPhoto(p, lang);
  // undefined = todavía buscando; null = no hay foto
  const ph: PlacePhoto | null | undefined =
    known !== undefined ? known : photo && photo.key === pkey ? photo.ph : undefined;

  // datos clave (chips bajo el título)
  const measure = f.alt
    ? { icon: 'mountain', k: t('altitude'), v: fmt(lang, f.alt) }
    : f.area
      ? { icon: 'box', k: t('area'), v: fmt(lang, f.area) }
      : f.depth
        ? { icon: 'waves', k: t('depth'), v: fmt(lang, f.depth) }
        : null;

  const rows: [string, React.ReactNode][] = [];
  if (f.alt) rows.push([t('altitude'), fmt(lang, f.alt)]);
  if (f.area) rows.push([t('area'), fmt(lang, f.area)]);
  if (f.depth) rows.push([t('depth'), fmt(lang, f.depth)]);
  if (f.year) rows.push([t('year'), fmt(lang, L(f.year))]);
  if (f.tag) rows.push([t('type_lbl'), fmt(lang, L(f.tag))]);
  const x = p.x ?? {};
  if (!f.alt && x.elev != null) rows.push([t('altitude'), `${Math.round(x.elev).toLocaleString(lang)} m`]);
  if (!f.area && x.area != null && x.area > 0)
    rows.push([t('area'), `${x.area.toLocaleString(lang, { maximumFractionDigits: 1 })} km²`]);
  if (x.pop) rows.push([t('population'), x.pop.toLocaleString(lang)]);
  if (!f.year && x.inception) rows.push([t('inception'), x.inception]);
  if (x.her) rows.push([t('heritage'), L(x.her)]);
  // provincia y la medida principal ya van en los chips de arriba: no se repiten en la tabla
  if (measure) {
    const i = rows.findIndex(([k]) => k === measure.k);
    if (i >= 0) rows.splice(i, 1);
  }
  const nr = nickRow(p.nick, t as (k: string) => string);
  if (nr) rows.push(nr);
  rows.push([t('coords_lbl'), <span className="mono">{`${p.lat.toFixed(4)}°, ${p.lng.toFixed(4)}°`}</span>]);

  return (
    <section className="tab-pane detail active" data-pane="detail" id="detail" ref={ref}>
      {ph === null ? (
        <NoPhotoHero key={p.id} p={p} pending={false} />
      ) : (
        <PhotoHero key={pkey} p={p} ph={ph} w={w} />
      )}
      <div className="detail-body">
        <h2>{name}</h2>
        <NickSub n={p.nick} />
        {other && (
          <div className="alt-name" lang={lang === 'es' ? 'en' : 'es'}>
            {other}
          </div>
        )}
        <ul className="chips" aria-label={t('details')}>
          <li
            className="chip cat"
            style={{ '--c': c.color } as React.CSSProperties}
            title={t('category_lbl')}
          >
            <MiniMarker cat={p.cat} size={18} />
            {catOne(p.cat)}
          </li>
          {p.also?.map((a) => (
            <li
              key={a}
              className="chip cat"
              style={{ '--c': CATEGORIES[a].color } as React.CSSProperties}
              title={t('category_lbl')}
            >
              <MiniMarker cat={a} size={18} />
              {catOne(a)}
            </li>
          ))}
          <li className="chip" title={t('province_lbl')}>
            <Icon name="map-pin" />
            {provName(p.prov)}
          </li>
          {measure && (
            <li className="chip" title={measure.k}>
              <Icon name={measure.icon} />
              {measure.v}
            </li>
          )}
          {f.year && (
            <li className="chip" title={t('year')}>
              <Icon name="clock" />
              {fmt(lang, L(f.year))}
            </li>
          )}
        </ul>
        <div className="quick">
          <Qa href={directionsUrl(p)} icon="navigation" label={t('directions')} cls="primary" />
          <Qa
            icon="bookmark"
            label={fav ? (lang === 'es' ? 'Guardado' : 'Saved') : lang === 'es' ? 'Guardar' : 'Save'}
            cls={fav ? 'on fav' : ''}
            pressed={fav}
            onClick={() => toggleFav(id)}
          />
          <Qa
            icon={inRoute ? 'check' : 'route'}
            label={inRoute ? t('in_route') : t('tab_route')}
            cls={inRoute ? 'on' : ''}
            pressed={inRoute}
            onClick={() => toggleRoute(id)}
          />
          <Qa icon="share-2" label={t('share')} onClick={() => share(id)} />
        </div>
        {p.desc && L(p.desc) && !sameText(L(p.desc), wk?.ex) && <p className="lead">{L(p.desc)}</p>}
        {w && !wk?.failed && (
          <WikiBlock key={p.id + (wk?.ex ? ':1' : ':0')} text={wk?.ex} href={wikiUrl(w)} />
        )}
        {p.surf && (
          <p className="surf-note">
            <MiniMarker cat="surf" size={18} />
            <span>
              {t('surf_note')}
              {p.surf.osm && (
                <>
                  {' '}
                  <a href={'https://www.openstreetmap.org/' + p.surf.osm} target="_blank" rel="noopener">
                    © OpenStreetMap contributors
                  </a>{' '}
                  (ODbL)
                </>
              )}
            </span>
          </p>
        )}
        <Facts rows={rows} />
        <PlaceSources p={p} />
        {p.osm && (
          <p className="osm-attr">
            {t('osm_data')}{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
              © OpenStreetMap contributors
            </a>{' '}
            (ODbL)
          </p>
        )}
        {(w || p.link) && (
          <div className="link-row">
            {w && (
              <a href={wikiUrl(w)} target="_blank" rel="noopener">
                <Icon name="globe" />
                Wikipedia
                <Icon name="arrow-up-right" />
              </a>
            )}
            {p.link && (
              <a href={p.link} target="_blank" rel="noopener">
                <Icon name="external-link" />
                {t('more_info')}
                <Icon name="arrow-up-right" />
              </a>
            )}
          </div>
        )}
        {p.visit && <VisitBlock v={p.visit} />}
        {p.tips && <TipsBlock tips={p.tips} />}
        {!!p.related?.length && <RelatedBlock ids={p.related} title={t('fauna_related')} />}
        <div className="nearby">
          <h3 className="section-title">{t('nearby')}</h3>
          <ul className="list compact">
            {near.map(([q, d]) => (
              <PlaceItem key={q.id} p={q} dist={d} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** el resumen de Wikipedia ya dice lo mismo que la descripción corta (evita texto repetido) */
const plain = (x: string) =>
  x
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
function sameText(a: string, b?: string) {
  if (!b) return false;
  const x = plain(a),
    y = plain(b);
  return x.length > 25 && (y.startsWith(x.slice(0, 60)) || y.includes(x));
}

/** Panel de fuentes: Wikivoyage, Wikidata, sitio oficial y SINAC */
function PlaceSources({ p }: { p: Place }) {
  const { t, lang } = useT();
  const x = p.x ?? {};
  const qid = x.qid ?? p.q;
  const voy = x.voy?.[lang] ?? x.voy?.[lang === 'es' ? 'en' : 'es'];
  const src: { name: string; url: string; license?: string }[] = [];
  if (voy) src.push({ name: 'Wikivoyage', url: voy, license: 'CC BY-SA 4.0' });
  if (qid) src.push({ name: 'Wikidata', url: `https://www.wikidata.org/wiki/${qid}`, license: 'CC0' });
  if (p.osm)
    src.push({
      name: '© OpenStreetMap contributors',
      url: `https://www.openstreetmap.org/${p.osm}`,
      license: 'ODbL',
    });
  if (x.sinac) src.push({ name: 'SINAC', url: x.sinac });
  else if (x.web) src.push({ name: t('official_site'), url: x.web });
  if (!src.length) return null;
  return (
    <SourceBox label={t('sources_more')} icon="book-open" sources={src} className="place-src">
      {voy && <p className="muted small">{t('voy_hint')}</p>}
    </SourceBox>
  );
}

/** Resumen de Wikipedia recortado a 3 líneas con "Leer más" */
function WikiBlock({ text, href }: { text?: string; href: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOver(el.scrollHeight > el.clientHeight + 2);
  }, [text, open]);
  return (
    <SourceBox label={t('from_wiki')} icon="globe">
      {text != null ? (
        <>
          {text && (
            <p ref={ref} className={open ? '' : 'clamp'}>
              {text}
            </p>
          )}
          <div className="wiki-actions">
            {(over || open) && (
              <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? t('read_less') : t('read_more')}
                <Icon name={open ? 'chevron-up' : 'chevron-down'} />
              </button>
            )}
            <a href={href} target="_blank" rel="noopener">
              {t('wiki_article')}
              <Icon name="arrow-up-right" />
            </a>
          </div>
        </>
      ) : (
        <p className="muted">{t('loading')}</p>
      )}
    </SourceBox>
  );
}

/** Portada sin foto: degradado del color de la categoría con patrón de íconos y,
 *  encima, una vista satelital estática del punto con su marcador */
function NoPhotoHero({ p, pending }: { p: Place; pending: boolean }) {
  const { lang, t } = useT();
  // restaurantes y sodas: marcador ilustrado de la categoría, sin satélite ni fotos ajenas
  const food = p.cat === 'gastronomia';
  const c = CATEGORIES[p.cat];
  const [sat, setSat] = useState<'loading' | 'ok' | 'err'>('loading');
  const pat = useMemo(
    () =>
      `url("data:image/svg+xml,${encodeURIComponent(iconSvg(c.icon, { size: 28, color: '#fff', stroke: 1.4 }))}")`,
    [c.icon],
  );
  const src = useMemo(() => satelliteSnapshot(p), [p]);
  return (
    <div
      className={'hero noimg' + (sat === 'ok' ? ' sat' : '')}
      style={{ '--c': c.color, '--pat': pat } as React.CSSProperties}
    >
      <span className="hero-pat" aria-hidden="true" />
      <span className="hero-big" aria-hidden="true">
        <Icon name={c.icon} />
      </span>
      {food && <span className="hero-note">{t('photo_none_food')}</span>}
      {!pending && !food && sat !== 'err' && (
        <img
          className="hero-sat"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setSat('ok')}
          onError={() => setSat('err')}
        />
      )}
      <span className="hero-pin" aria-hidden="true">
        <MiniMarker cat={p.cat} size={34} />
      </span>
      <HeroTop />
      {sat === 'ok' && (
        <div className="attrib">
          {lang === 'es' ? 'Vista satelital' : 'Satellite view'} ·{' '}
          <a href="https://www.esri.com/" target="_blank" rel="noopener">
            Esri, Maxar, Earthstar
          </a>
        </div>
      )}
    </div>
  );
}

type Wiki = ReturnType<typeof wikiTarget>;

/** Portada con foto: espacio fijo + placeholder neutro hasta que la imagen está
 *  decodificada; luego aparece con un fundido. Se monta de nuevo por lugar, así
 *  nunca queda la foto del lugar anterior debajo del nombre nuevo. */
function PhotoHero({ p, ph, w }: { p: Place; ph: PlacePhoto | undefined; w: Wiki }) {
  const c = CATEGORIES[p.cat];
  const src = ph ? sizedThumb(ph.src, HERO_W) : '';
  const [state, setState] = useState<'wait' | 'ok' | 'err'>(() => (src && isImageReady(src) ? 'ok' : 'wait'));
  const [instant] = useState(() => !!src && isImageReady(src));
  useEffect(() => {
    if (!src || state === 'ok') return;
    let live = true;
    preloadImage(src).then((ok) => live && setState(ok ? 'ok' : 'err'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  if (state === 'err') return <NoPhotoHero p={p} pending={false} />;
  return (
    <div
      className={'hero ph' + (state === 'ok' ? ' loaded' : ' loading') + (instant ? ' instant' : '')}
      style={{ '--c': c.color } as React.CSSProperties}
      aria-busy={state !== 'ok'}
    >
      <span className="hero-skel" aria-hidden="true" />
      {state === 'ok' && (
        <img className="hero-img" src={src} alt="" decoding="async" referrerPolicy="no-referrer" />
      )}
      <HeroTop />
      {state === 'ok' &&
        ph &&
        (ph.kind === 'img' && p.img ? (
          <Attrib img={p.img} />
        ) : ph.kind === 'wiki' && w ? (
          <Attrib href={wikiUrl(w)} label="Wikipedia" />
        ) : (
          <Attrib href={ph.href} label={ph.credit} license={ph.license ?? 'Wikimedia Commons'} />
        ))}
    </div>
  );
}

function VisitBlock({ v }: { v: NonNullable<Place['visit']> }) {
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

function TipsBlock({ tips }: { tips: NonNullable<Place['tips']> }) {
  const { t, lang } = useT();
  const L = (x?: { es?: string; en?: string }) =>
    x ? (lang === 'es' ? x.es : x.en) || x.es || x.en || '' : '';
  const rows: [string, string][] = [];
  if (tips.view) rows.push([t('fauna_view_tip'), L(tips.view)]);
  if (tips.care) rows.push([t('fauna_care_tip'), L(tips.care)]);
  if (!rows.length) return null;
  return <Facts rows={rows} />;
}

function RelatedBlock({ ids, title }: { ids: string[]; title: string }) {
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
